/**
 * Patient registry. Demographics are readable by staff roles; every read of a
 * single patient record and every change is audited. Audit metadata lists the
 * *names* of changed fields, never their values, to keep PHI out of the log.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { assertCan } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import { forbidden, notFound } from "../http/errors";
import { audit } from "./audit";
import type { PatientInput, PatientListQuery } from "@/lib/validation/patient";
import type { Paginated } from "@/lib/validation/common";

export const patientSummarySelect = {
  id: true,
  mrn: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  gender: true,
  phone: true,
} satisfies Prisma.PatientSelect;
export type PatientSummary = Prisma.PatientGetPayload<{ select: typeof patientSummarySelect }>;

export async function listPatients(actor: SessionUser, q: PatientListQuery): Promise<Paginated<PatientSummary>> {
  assertCan(actor.role, "patient:read");
  const terms = q.q?.split(/\s+/).filter(Boolean) ?? [];
  const where: Prisma.PatientWhereInput = {
    gender: q.gender,
    AND: terms.map((t) => ({
      OR: [
        { firstName: { contains: t, mode: "insensitive" } },
        { lastName: { contains: t, mode: "insensitive" } },
        { mrn: { contains: t, mode: "insensitive" } },
        { phone: { contains: t } },
      ],
    })),
  };
  const [items, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      select: patientSummarySelect,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.patient.count({ where }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

/** Full patient profile. Patients may read their own record only. */
export async function getPatient(actor: SessionUser, id: string) {
  if (actor.role === "PATIENT") {
    if (actor.patientId !== id) throw forbidden("Patients can only view their own record");
  } else {
    assertCan(actor.role, "patient:read");
  }
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) throw notFound("Patient");
  await audit(actor, { action: "READ", entityType: "Patient", entityId: id, patientId: id });
  return patient;
}

async function nextMrn(tx: Prisma.TransactionClient): Promise<string> {
  const last = await tx.patient.findFirst({ orderBy: { mrn: "desc" }, select: { mrn: true } });
  const n = last ? Number(last.mrn.replace(/\D/g, "")) + 1 : 100001;
  return `MRN-${n}`;
}

export async function createPatient(actor: SessionUser, input: PatientInput) {
  assertCan(actor.role, "patient:write");
  // MRN = max + 1. Two concurrent registrations could pick the same number;
  // the UNIQUE(mrn) constraint rejects one and we simply retry.
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const patient = await tx.patient.create({
          data: { ...input, dateOfBirth: new Date(input.dateOfBirth), mrn: await nextMrn(tx) },
        });
        await audit(actor, { action: "CREATE", entityType: "Patient", entityId: patient.id, patientId: patient.id }, tx);
        return patient;
      });
    } catch (e) {
      const mrnClash = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && String(e.meta?.target).includes("mrn");
      if (!mrnClash || attempt >= 4) throw e;
    }
  }
}

export async function updatePatient(actor: SessionUser, id: string, input: Partial<PatientInput>) {
  assertCan(actor.role, "patient:write");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.patient.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound("Patient");
    const patient = await tx.patient.update({
      where: { id },
      data: { ...input, dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined },
    });
    await audit(
      actor,
      { action: "UPDATE", entityType: "Patient", entityId: id, patientId: id, metadata: { fields: Object.keys(input) } },
      tx,
    );
    return patient;
  });
}
