/**
 * Billing: itemized invoices and a simulated payment flow.
 *
 * Invoice lifecycle:  DRAFT ──issue──▶ ISSUED ──(payments = total)──▶ PAID
 *                       └────────void (no successful payments)────▶ VOID
 *
 * Integrity:
 *  - Totals are always recomputed from line items inside the same transaction
 *    that changes them; CHECK constraints in Postgres reject any mismatch.
 *  - Lines can only change while DRAFT; issued invoices are immutable.
 *  - Payments need an Idempotency-Key. The invoice row is locked
 *    (SELECT … FOR UPDATE) while the balance is checked, so concurrent
 *    payments cannot over-pay; the DB CHECK (amountPaid <= total) backs it up.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { assertCan } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import { AppError, conflict, forbidden, invalidState, notFound, validationError } from "../http/errors";
import { audit } from "./audit";
import { computeLine, computeTotals } from "@/lib/money";
import { reconcileInvoice } from "../domain/billing";
import { chargeSandbox } from "../payments/sandbox-gateway";
import type { CreateInvoiceInput, InvoiceListQuery, LineInputT, PaymentInputT } from "@/lib/validation/billing";
import type { Paginated } from "@/lib/validation/common";

type Tx = Prisma.TransactionClient;

const invoiceInclude = {
  patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
  appointment: { select: { id: true, startTime: true, doctor: { select: { firstName: true, lastName: true } } } },
  lineItems: { orderBy: { id: "asc" } },
  payments: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.InvoiceInclude;
export type InvoiceDetail = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

/** Staff-only operations (patients may only view and pay their own invoices). */
function assertStaffBilling(actor: SessionUser) {
  assertCan(actor.role, "billing:write");
  if (actor.role !== "ADMIN" && actor.role !== "FRONT_DESK") throw forbidden("Only billing staff can change invoices");
}

function assertInvoiceScope(actor: SessionUser, inv: { patientId: string }) {
  if (actor.role === "PATIENT" && inv.patientId !== actor.patientId) throw forbidden("You can only access your own invoices");
}

async function lockInvoice(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
  const inv = await tx.invoice.findUnique({ where: { id }, include: { lineItems: true } });
  if (!inv) throw notFound("Invoice");
  return inv;
}

/** Recompute and store totals from the current line items. */
async function recalculate(tx: Tx, invoiceId: string, discountCents: number) {
  const lines = await tx.invoiceLineItem.findMany({ where: { invoiceId } });
  let totals;
  try {
    totals = computeTotals(lines, discountCents);
  } catch (e) {
    throw validationError((e as Error).message);
  }
  return tx.invoice.update({ where: { id: invoiceId }, data: totals });
}

async function nextInvoiceNumber(tx: Tx): Promise<string> {
  const year = new Date().getUTCFullYear();
  const last = await tx.invoice.findFirst({ where: { number: { startsWith: `INV-${year}-` } }, orderBy: { number: "desc" }, select: { number: true } });
  const n = last ? Number(last.number.split("-")[2]) + 1 : 1;
  return `INV-${year}-${String(n).padStart(6, "0")}`;
}

// --------------------------------------------------------------------------

export async function listInvoices(actor: SessionUser, q: InvoiceListQuery): Promise<Paginated<InvoiceDetail>> {
  assertCan(actor.role, "billing:read");
  const where: Prisma.InvoiceWhereInput = {
    // Patients never see unfinished drafts.
    status: actor.role === "PATIENT" ? (q.status && q.status !== "DRAFT" ? q.status : { not: "DRAFT" }) : q.status,
    patientId: actor.role === "PATIENT" ? (actor.patientId ?? "__none__") : q.patientId,
    ...(q.q
      ? {
          OR: [
            { number: { contains: q.q, mode: "insensitive" } },
            { patient: { lastName: { contains: q.q, mode: "insensitive" } } },
            { patient: { mrn: { contains: q.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({ where, include: invoiceInclude, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.invoice.count({ where }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function getInvoice(actor: SessionUser, id: string) {
  assertCan(actor.role, "billing:read");
  const inv = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!inv) throw notFound("Invoice");
  assertInvoiceScope(actor, inv);
  if (actor.role === "PATIENT" && inv.status === "DRAFT") throw notFound("Invoice");
  await audit(actor, { action: "READ", entityType: "Invoice", entityId: id, patientId: inv.patientId });
  return { ...inv, reconciliation: reconcileInvoice(inv) };
}

export async function createInvoice(actor: SessionUser, input: CreateInvoiceInput) {
  assertStaffBilling(actor);
  let patientId = input.patientId;
  const lines: LineInputT[] = [...input.lines];
  let encounterId: string | undefined;

  if (input.appointmentId) {
    const appt = await prisma.appointment.findUnique({ where: { id: input.appointmentId }, include: { doctor: true, encounter: { select: { id: true } } } });
    if (!appt) throw notFound("Appointment");
    if (appt.status !== "COMPLETED") throw invalidState("Only completed appointments can be billed");
    if (patientId && patientId !== appt.patientId) throw validationError("Patient does not match the appointment");
    patientId = appt.patientId;
    encounterId = appt.encounter?.id;
    // Consultation fee is added automatically from the doctor's tariff.
    lines.unshift({ category: "CONSULTATION", description: `Consultation — Dr. ${appt.doctor.firstName} ${appt.doctor.lastName}`, quantity: 1, unitPriceCents: appt.doctor.consultationFeeCents, taxRateBps: 0 });
  }
  const patient = await prisma.patient.findUnique({ where: { id: patientId! }, select: { id: true } });
  if (!patient) throw notFound("Patient");

  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const created = await tx.invoice.create({
          data: {
            number: await nextInvoiceNumber(tx),
            patientId: patient.id,
            appointmentId: input.appointmentId,
            encounterId,
            notes: input.notes,
            createdById: actor.id,
            lineItems: { create: lines.map((l) => ({ ...l, ...computeLine(l) })) },
          },
        });
        const inv = await recalculate(tx, created.id, input.discountCents);
        await audit(actor, { action: "CREATE", entityType: "Invoice", entityId: inv.id, patientId: inv.patientId, metadata: { number: inv.number, totalCents: inv.totalCents } }, tx);
        return inv;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String(e.meta?.target ?? "");
        if (target.includes("appointmentId")) throw conflict("This appointment already has an invoice");
        if (target.includes("number") && attempt < 4) continue; // concurrent numbering — retry
      }
      throw e;
    }
  }
}

async function mutateDraft<T>(actor: SessionUser, invoiceId: string, fn: (tx: Tx, inv: Awaited<ReturnType<typeof lockInvoice>>) => Promise<T>) {
  assertStaffBilling(actor);
  return prisma.$transaction(async (tx) => {
    const inv = await lockInvoice(tx, invoiceId);
    if (inv.status !== "DRAFT") throw invalidState("Only draft invoices can be edited");
    return fn(tx, inv);
  });
}

export async function addLine(actor: SessionUser, invoiceId: string, line: LineInputT) {
  return mutateDraft(actor, invoiceId, async (tx, inv) => {
    await tx.invoiceLineItem.create({ data: { ...line, ...computeLine(line), invoiceId } });
    const updated = await recalculate(tx, invoiceId, inv.discountCents);
    await audit(actor, { action: "UPDATE", entityType: "Invoice", entityId: invoiceId, patientId: inv.patientId, metadata: { change: "add_line" } }, tx);
    return updated;
  });
}

export async function removeLine(actor: SessionUser, invoiceId: string, lineId: string) {
  return mutateDraft(actor, invoiceId, async (tx, inv) => {
    const res = await tx.invoiceLineItem.deleteMany({ where: { id: lineId, invoiceId } });
    if (res.count !== 1) throw notFound("Line item");
    const updated = await recalculate(tx, invoiceId, inv.discountCents);
    await audit(actor, { action: "UPDATE", entityType: "Invoice", entityId: invoiceId, patientId: inv.patientId, metadata: { change: "remove_line" } }, tx);
    return updated;
  });
}

export async function updateDraft(actor: SessionUser, invoiceId: string, input: { discountCents?: number; notes?: string }) {
  return mutateDraft(actor, invoiceId, async (tx, inv) => {
    if (input.notes !== undefined) await tx.invoice.update({ where: { id: invoiceId }, data: { notes: input.notes } });
    const updated = await recalculate(tx, invoiceId, input.discountCents ?? inv.discountCents);
    await audit(actor, { action: "UPDATE", entityType: "Invoice", entityId: invoiceId, patientId: inv.patientId, metadata: { fields: Object.keys(input) } }, tx);
    return updated;
  });
}

export async function issueInvoice(actor: SessionUser, invoiceId: string) {
  return mutateDraft(actor, invoiceId, async (tx, inv) => {
    if (inv.lineItems.length === 0) throw validationError("Add at least one line item before issuing");
    if (inv.totalCents <= 0) throw validationError("Invoice total must be greater than zero");
    const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { status: "ISSUED", issuedAt: new Date() } });
    await audit(actor, { action: "STATUS_CHANGE", entityType: "Invoice", entityId: invoiceId, patientId: inv.patientId, metadata: { from: "DRAFT", to: "ISSUED" } }, tx);
    return updated;
  });
}

export async function voidInvoice(actor: SessionUser, invoiceId: string, reason: string) {
  assertStaffBilling(actor);
  return prisma.$transaction(async (tx) => {
    const inv = await lockInvoice(tx, invoiceId);
    if (inv.status !== "DRAFT" && inv.status !== "ISSUED") throw invalidState(`A ${inv.status} invoice cannot be voided`);
    const live = await tx.payment.count({ where: { invoiceId, status: { in: ["SUCCEEDED", "PENDING"] } } });
    if (live > 0 || inv.amountPaidCents > 0) throw invalidState("Invoices with payments cannot be voided");
    const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { status: "VOID", notes: [inv.notes, `Voided: ${reason}`].filter(Boolean).join("\n") } });
    await audit(actor, { action: "STATUS_CHANGE", entityType: "Invoice", entityId: invoiceId, patientId: inv.patientId, metadata: { from: inv.status, to: "VOID" } }, tx);
    return updated;
  });
}

// --------------------------------------------------------------------------
// Payments (sandbox)
// --------------------------------------------------------------------------

export async function payInvoice(actor: SessionUser, invoiceId: string, input: PaymentInputT, idempotencyKey: string) {
  assertCan(actor.role, "billing:write");

  // 1) Idempotent replay.
  const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
  if (existing) {
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: existing.invoiceId }, select: { patientId: true } });
    assertInvoiceScope(actor, inv);
    if (existing.invoiceId !== invoiceId || existing.amountCents !== input.amountCents) {
      throw new AppError("IDEMPOTENCY_MISMATCH", 422, "This Idempotency-Key was already used for a different payment");
    }
    return { payment: existing, replayed: true };
  }

  // 2) Reserve: lock the invoice, check the outstanding balance (including
  //    in-flight PENDING payments) and record a PENDING payment.
  let pending;
  try {
    pending = await prisma.$transaction(async (tx) => {
      const inv = await lockInvoice(tx, invoiceId);
      assertInvoiceScope(actor, inv);
      if (inv.status !== "ISSUED") throw invalidState(inv.status === "PAID" ? "Invoice is already paid" : `Cannot pay a ${inv.status} invoice`);
      const inFlight = await tx.payment.aggregate({ where: { invoiceId, status: "PENDING" }, _sum: { amountCents: true } });
      const balance = inv.totalCents - inv.amountPaidCents - (inFlight._sum.amountCents ?? 0);
      if (input.amountCents > balance) throw validationError(`Amount exceeds the outstanding balance (${balance} paise)`);
      return tx.payment.create({
        data: { invoiceId, amountCents: input.amountCents, method: input.method, idempotencyKey, providerRef: `pending_${idempotencyKey}`, createdById: actor.id },
      });
    });
  } catch (e) {
    // A concurrent request with the same key won the race: replay it.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const winner = await prisma.payment.findUnique({ where: { idempotencyKey } });
      if (winner) return { payment: winner, replayed: true };
    }
    throw e;
  }

  // 3) Call the (simulated) gateway outside the DB transaction.
  const result = await chargeSandbox(input.amountCents, input.simulate);

  // 4) Settle: record the outcome and update the invoice atomically.
  const payment = await prisma.$transaction(async (tx) => {
    const inv = await lockInvoice(tx, invoiceId);
    const settled = await tx.payment.update({
      where: { id: pending.id },
      data: { status: result.approved ? "SUCCEEDED" : "FAILED", providerRef: result.providerRef, failureReason: result.failureReason },
    });
    if (result.approved) {
      const amountPaidCents = inv.amountPaidCents + input.amountCents;
      const paidInFull = amountPaidCents === inv.totalCents;
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { amountPaidCents, ...(paidInFull ? { status: "PAID", paidAt: new Date() } : {}) },
      });
    }
    await audit(actor, {
      action: "PAYMENT", entityType: "Invoice", entityId: invoiceId, patientId: inv.patientId,
      metadata: { paymentId: settled.id, amountCents: input.amountCents, status: settled.status, method: input.method },
    }, tx);
    return settled;
  });
  return { payment, replayed: false };
}
