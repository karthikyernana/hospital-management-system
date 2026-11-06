/**
 * Acceptance test 4: an invoice reconciles with its line items and payment status.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { POST as createRoute } from "@/app/api/invoices/route";
import { GET as getRoute, PATCH as patchRoute } from "@/app/api/invoices/[id]/route";
import { POST as addLineRoute } from "@/app/api/invoices/[id]/lines/route";
import { DELETE as removeLineRoute } from "@/app/api/invoices/[id]/lines/[lineId]/route";
import { POST as issueRoute } from "@/app/api/invoices/[id]/issue/route";
import { POST as voidRoute } from "@/app/api/invoices/[id]/void/route";
import { POST as payRoute } from "@/app/api/invoices/[id]/payments/route";
import { prisma } from "@/server/db";
import { call } from "../helpers";
import { seedFixtures, type Fixtures } from "../fixtures";

let f: Fixtures;
let completedApptId: string;

beforeAll(async () => {
  f = await seedFixtures();
  const start = new Date(Date.now() - 3 * 86_400_000);
  start.setUTCMinutes(0, 0, 0);
  completedApptId = (
    await prisma.appointment.create({
      data: { patientId: f.patient.id, doctorId: f.doctor.id, startTime: start, endTime: new Date(start.getTime() + 1_800_000), status: "COMPLETED" },
    })
  ).id;
});

const pay = (user: Fixtures["users"][keyof Fixtures["users"]], id: string, body: Record<string, unknown>, key?: string) =>
  call(payRoute, { user, params: { id }, body, headers: key ? { "idempotency-key": key } : {} });

describe("AT-4: invoice reconciles with line items and payment status", () => {
  let invoiceId: string;

  it("creates a draft from a completed appointment with the consultation fee", async () => {
    const res = await call(createRoute, { user: f.users.desk, body: { appointmentId: completedApptId } });
    expect(res.status).toBe(201);
    invoiceId = res.json.data.id;
    expect(res.json.data).toMatchObject({ status: "DRAFT", subtotalCents: 50_000, totalCents: 50_000 });
    expect(res.json.data.number).toMatch(/^INV-\d{4}-\d{6}$/);
    // One invoice per appointment.
    expect((await call(createRoute, { user: f.users.desk, body: { appointmentId: completedApptId } })).status).toBe(409);
  });

  it("recomputes totals as line items, tax and discount change", async () => {
    await call(addLineRoute, { user: f.users.desk, params: { id: invoiceId }, body: { category: "PHARMACY", description: "Paracetamol 500mg strip", quantity: 3, unitPriceCents: 2_499, taxRateBps: 1_200 } });
    const lab = await call(addLineRoute, { user: f.users.desk, params: { id: invoiceId }, body: { category: "LAB", description: "CBC", quantity: 1, unitPriceCents: 40_000 } });
    expect(lab.json.data).toMatchObject({ subtotalCents: 50_000 + 7_497 + 40_000, taxCents: 900, totalCents: 98_397 });
    const disc = await call(patchRoute, { user: f.users.desk, method: "PATCH", params: { id: invoiceId }, body: { discountCents: 8_397 } });
    expect(disc.json.data.totalCents).toBe(90_000);

    const labLine = await prisma.invoiceLineItem.findFirstOrThrow({ where: { invoiceId, category: "LAB" } });
    const removed = await call(removeLineRoute, { user: f.users.desk, method: "DELETE", params: { id: invoiceId, lineId: labLine.id } });
    expect(removed.json.data.totalCents).toBe(50_000);

    const detail = await call(getRoute, { user: f.users.desk, params: { id: invoiceId } });
    const lines = detail.json.data.lineItems as { lineTotalCents: number }[];
    const { subtotalCents, taxCents, discountCents, totalCents } = detail.json.data;
    expect(lines.reduce((s, l) => s + l.lineTotalCents, 0)).toBe(subtotalCents + taxCents);
    expect(totalCents).toBe(subtotalCents + taxCents - discountCents);
    expect(detail.json.data.reconciliation.ok).toBe(true);
  });

  it("rejects a discount larger than the invoice", async () => {
    const res = await call(patchRoute, { user: f.users.desk, method: "PATCH", params: { id: invoiceId }, body: { discountCents: 10_000_000 } });
    expect(res.status).toBe(422);
  });

  it("cannot be paid while DRAFT; issuing locks the line items", async () => {
    expect((await pay(f.users.desk, invoiceId, { amountCents: 1_000, method: "CASH" }, "pay-draft-0001")).json.error.code).toBe("INVALID_STATE");
    expect((await call(issueRoute, { user: f.users.desk, params: { id: invoiceId } })).json.data.status).toBe("ISSUED");
    const edit = await call(addLineRoute, { user: f.users.desk, params: { id: invoiceId }, body: { category: "OTHER", description: "Late add", quantity: 1, unitPriceCents: 100 } });
    expect(edit.json.error.code).toBe("INVALID_STATE");
  });

  it("requires an Idempotency-Key for payments", async () => {
    const res = await pay(f.users.desk, invoiceId, { amountCents: 1_000, method: "CASH" });
    expect(res.status).toBe(422);
  });

  it("a declined sandbox payment is recorded as FAILED and leaves the balance unchanged", async () => {
    const res = await pay(f.users.patient, invoiceId, { amountCents: 50_000, method: "CARD", simulate: "decline" }, "pay-decline-0001");
    expect(res.status).toBe(201);
    expect(res.json.data).toMatchObject({ status: "FAILED", failureReason: expect.stringMatching(/declined/i) });
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(inv).toMatchObject({ status: "ISSUED", amountPaidCents: 0 });
  });

  it("partial then final payment moves the invoice to PAID; retries are idempotent", async () => {
    const part = await pay(f.users.desk, invoiceId, { amountCents: 20_000, method: "UPI" }, "pay-part-00001");
    expect(part.json.data.status).toBe("SUCCEEDED");
    const retry = await pay(f.users.desk, invoiceId, { amountCents: 20_000, method: "UPI" }, "pay-part-00001");
    expect(retry.status).toBe(200);
    expect(retry.json.data.id).toBe(part.json.data.id);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).amountPaidCents).toBe(20_000);

    const over = await pay(f.users.desk, invoiceId, { amountCents: 30_001, method: "CASH" }, "pay-over-00001");
    expect(over.status).toBe(422);

    const rest = await pay(f.users.patient, invoiceId, { amountCents: 30_000, method: "CARD" }, "pay-rest-00001");
    expect(rest.json.data.status).toBe("SUCCEEDED");
    const detail = await call(getRoute, { user: f.users.desk, params: { id: invoiceId } });
    expect(detail.json.data).toMatchObject({ status: "PAID", amountPaidCents: 50_000, totalCents: 50_000 });
    expect(detail.json.data.reconciliation).toMatchObject({ ok: true, issues: [] });
    expect(detail.json.data.payments.map((p: { status: string }) => p.status)).toEqual(["FAILED", "SUCCEEDED", "SUCCEEDED"]);
    expect(await prisma.auditLog.count({ where: { action: "PAYMENT", entityId: invoiceId } })).toBe(3);

    expect((await pay(f.users.desk, invoiceId, { amountCents: 1, method: "CASH" }, "pay-after-0001")).json.error.message).toMatch(/already paid/);
    expect((await call(voidRoute, { user: f.users.admin, params: { id: invoiceId }, body: { reason: "test void" } })).json.error.code).toBe("INVALID_STATE");
  });

  it("concurrent payments can never over-pay an invoice", async () => {
    const inv = await call(createRoute, { user: f.users.desk, body: { patientId: f.patient2.id, lines: [{ category: "PROCEDURE", description: "Dressing", quantity: 1, unitPriceCents: 10_000 }] } });
    const id = inv.json.data.id;
    await call(issueRoute, { user: f.users.desk, params: { id } });
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => pay(f.users.desk, id, { amountCents: 10_000, method: "CASH" }, `concurrent-pay-${i}0000`)),
    );
    expect(results.filter((r) => r.json.data?.status === "SUCCEEDED")).toHaveLength(1);
    const final = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    expect(final).toMatchObject({ status: "PAID", amountPaidCents: 10_000 });
  });
});

describe("billing authorization", () => {
  it("clinicians cannot access billing; patients only their own invoices and cannot create them", async () => {
    const inv = await prisma.invoice.findFirstOrThrow({ where: { patientId: f.patient2.id } });
    expect((await call(getRoute, { user: f.users.clinician, params: { id: inv.id } })).status).toBe(403);
    expect((await call(getRoute, { user: f.users.patient, params: { id: inv.id } })).status).toBe(403);
    expect((await call(createRoute, { user: f.users.patient, body: { patientId: f.patient.id, lines: [] } })).status).toBe(403);
  });

  it("invoice reads are audited", async () => {
    const inv = await prisma.invoice.findFirstOrThrow();
    const before = await prisma.auditLog.count({ where: { action: "READ", entityType: "Invoice", entityId: inv.id } });
    await call(getRoute, { user: f.users.admin, params: { id: inv.id } });
    expect(await prisma.auditLog.count({ where: { action: "READ", entityType: "Invoice", entityId: inv.id } })).toBe(before + 1);
  });

  it("only draft/issued invoices without payments can be voided", async () => {
    const inv = await call(createRoute, { user: f.users.desk, body: { patientId: f.patient.id, lines: [{ category: "OTHER", description: "Certificate", quantity: 1, unitPriceCents: 5_000 }] } });
    const v = await call(voidRoute, { user: f.users.desk, params: { id: inv.json.data.id }, body: { reason: "Raised in error" } });
    expect(v.json.data.status).toBe("VOID");
  });
});
