/**
 * Visit (encounter) records: clinician-entered notes, prescriptions and
 * diagnostic-report metadata. The system stores what clinicians write; it
 * never suggests or generates a diagnosis.
 *
 * Access rules (on top of the RBAC matrix):
 *  - CLINICIAN: reads visits of patients they have a care relationship with
 *    (an appointment or visit with them); writes only their own OPEN visits.
 *  - ADMIN: read-only oversight; every read is audited.
 *  - PATIENT: reads their own FINALIZED visits, without clinician notes.
 *  - FRONT_DESK: no access to clinical content at all.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { assertCan } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import { conflict, forbidden, invalidState, notFound } from "../http/errors";
import { audit } from "./audit";
import { transitionAppointment } from "./appointments";
import type { Paginated } from "@/lib/validation/common";
import type { VisitListQuery } from "@/lib/validation/visit";
import type { z } from "zod";
import type { diagnosticResultInput, prescriptionInput } from "@/lib/validation/visit";

const visitInclude = {
  patient: { select: { id: true, mrn: true, firstName: true, lastName: true, dateOfBirth: true, gender: true, allergies: true } },
  doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
  appointment: { select: { id: true, startTime: true, status: true, version: true } },
  notes: { orderBy: { createdAt: "asc" } },
  prescriptions: { orderBy: { createdAt: "asc" } },
  diagnosticReports: { orderBy: { orderedAt: "asc" } },
  invoice: { select: { id: true, number: true, status: true } },
} satisfies Prisma.EncounterInclude;
export type VisitDetail = Prisma.EncounterGetPayload<{ include: typeof visitInclude }>;

async function hasCareRelationship(doctorId: string, patientId: string) {
  const link = await prisma.appointment.findFirst({ where: { doctorId, patientId }, select: { id: true } });
  return !!link;
}

/** Throws unless `actor` may read this visit. */
async function assertCanReadVisit(actor: SessionUser, v: { patientId: string; doctorId: string; status: string }) {
  assertCan(actor.role, "visit:read");
  if (actor.role === "PATIENT") {
    if (v.patientId !== actor.patientId || v.status !== "FINALIZED") throw forbidden("You can only view your own completed visits");
  } else if (actor.role === "CLINICIAN") {
    if (!actor.doctorId) throw forbidden();
    if (v.doctorId !== actor.doctorId && !(await hasCareRelationship(actor.doctorId, v.patientId))) {
      throw forbidden("You are not part of this patient's care team");
    }
  }
}

/** Throws unless `actor` may write to this visit (own, still open). */
function assertCanWriteVisit(actor: SessionUser, v: { doctorId: string; status: string }, allowFinalized = false) {
  assertCan(actor.role, "visit:write");
  if (v.doctorId !== actor.doctorId) throw forbidden("Only the treating clinician can edit this visit");
  if (v.status !== "OPEN" && !allowFinalized) throw invalidState("This visit is finalized and can no longer be edited");
}

async function loadVisit(id: string) {
  const v = await prisma.encounter.findUnique({ where: { id }, select: { id: true, patientId: true, doctorId: true, status: true, appointmentId: true } });
  if (!v) throw notFound("Visit");
  return v;
}

export async function listVisits(actor: SessionUser, q: VisitListQuery): Promise<Paginated<VisitDetail>> {
  assertCan(actor.role, "visit:read");
  let where: Prisma.EncounterWhereInput = { patientId: q.patientId, status: q.status };
  if (actor.role === "PATIENT") where = { ...where, patientId: actor.patientId ?? "__none__", status: "FINALIZED" };
  if (actor.role === "CLINICIAN") {
    // Own visits, or (when looking at one patient) that patient's visits if a care relationship exists.
    const related = q.patientId && actor.doctorId ? await hasCareRelationship(actor.doctorId, q.patientId) : false;
    if (!related) where = { ...where, doctorId: actor.doctorId ?? "__none__" };
  }
  const [items, total] = await Promise.all([
    prisma.encounter.findMany({ where, include: visitInclude, orderBy: { startedAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.encounter.count({ where }),
  ]);
  if (actor.role === "PATIENT") items.forEach((i) => (i.notes = []));
  if (q.patientId && items.length > 0) {
    await audit(actor, { action: "READ", entityType: "VisitList", patientId: q.patientId, metadata: { count: items.length } });
  }
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function getVisit(actor: SessionUser, id: string): Promise<VisitDetail> {
  const v = await loadVisit(id);
  await assertCanReadVisit(actor, v);
  const visit = await prisma.encounter.findUniqueOrThrow({ where: { id }, include: visitInclude });
  await audit(actor, { action: "READ", entityType: "Encounter", entityId: id, patientId: v.patientId });
  if (actor.role === "PATIENT") visit.notes = []; // clinician notes are not shown in the portal
  return visit;
}

/** Clinician starts the visit for a checked-in appointment. One visit per appointment. */
export async function startVisit(actor: SessionUser, appointmentId: string) {
  assertCan(actor.role, "visit:write");
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) throw notFound("Appointment");
  if (appt.doctorId !== actor.doctorId) throw forbidden("You can only start visits for your own appointments");
  if (appt.status !== "CHECKED_IN") throw invalidState("The patient must be checked in before the visit starts");
  try {
    return await prisma.$transaction(async (tx) => {
      const visit = await tx.encounter.create({
        data: { appointmentId, patientId: appt.patientId, doctorId: appt.doctorId, chiefComplaint: appt.reason },
      });
      await audit(actor, { action: "CREATE", entityType: "Encounter", entityId: visit.id, patientId: appt.patientId }, tx);
      return visit;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict("A visit already exists for this appointment");
    throw e;
  }
}

export async function addNote(actor: SessionUser, visitId: string, body: string) {
  const v = await loadVisit(visitId);
  assertCanWriteVisit(actor, v);
  return prisma.$transaction(async (tx) => {
    const note = await tx.clinicalNote.create({ data: { encounterId: visitId, authorId: actor.id, body } });
    await audit(actor, { action: "CREATE", entityType: "ClinicalNote", entityId: note.id, patientId: v.patientId, metadata: { visitId } }, tx);
    return note;
  });
}

export async function addPrescription(actor: SessionUser, visitId: string, input: z.infer<typeof prescriptionInput>) {
  const v = await loadVisit(visitId);
  assertCanWriteVisit(actor, v);
  return prisma.$transaction(async (tx) => {
    const rx = await tx.prescription.create({ data: { ...input, encounterId: visitId } });
    await audit(actor, { action: "CREATE", entityType: "Prescription", entityId: rx.id, patientId: v.patientId, metadata: { visitId } }, tx);
    return rx;
  });
}

export async function orderDiagnostic(actor: SessionUser, visitId: string, testName: string) {
  const v = await loadVisit(visitId);
  assertCanWriteVisit(actor, v);
  return prisma.$transaction(async (tx) => {
    const report = await tx.diagnosticReport.create({ data: { encounterId: visitId, testName } });
    await audit(actor, { action: "CREATE", entityType: "DiagnosticReport", entityId: report.id, patientId: v.patientId, metadata: { visitId } }, tx);
    return report;
  });
}

/** Results often arrive after the visit is closed, so recording them is allowed on finalized visits. */
export async function recordDiagnosticResult(actor: SessionUser, visitId: string, reportId: string, input: z.infer<typeof diagnosticResultInput>) {
  const v = await loadVisit(visitId);
  assertCanWriteVisit(actor, v, true);
  return prisma.$transaction(async (tx) => {
    const res = await tx.diagnosticReport.updateMany({
      where: { id: reportId, encounterId: visitId, status: "ORDERED" },
      data: { status: "RESULTED", resultSummary: input.resultSummary, fileName: input.fileName, resultedAt: new Date() },
    });
    if (res.count !== 1) throw invalidState("Report not found or already resulted");
    await audit(actor, { action: "UPDATE", entityType: "DiagnosticReport", entityId: reportId, patientId: v.patientId, metadata: { visitId, change: "result" } }, tx);
    return tx.diagnosticReport.findUniqueOrThrow({ where: { id: reportId } });
  });
}

/** Close the visit and complete its appointment atomically. */
export async function finalizeVisit(actor: SessionUser, visitId: string) {
  const v = await loadVisit(visitId);
  assertCanWriteVisit(actor, v);
  return prisma.$transaction(async (tx) => {
    const res = await tx.encounter.updateMany({ where: { id: visitId, status: "OPEN" }, data: { status: "FINALIZED", finalizedAt: new Date() } });
    if (res.count !== 1) throw invalidState("Visit already finalized");
    if (v.appointmentId) {
      const appt = await tx.appointment.findUniqueOrThrow({ where: { id: v.appointmentId } });
      if (appt.status === "CHECKED_IN") await transitionAppointment(actor, appt.id, "COMPLETED", appt.version, { db: tx });
    }
    await audit(actor, { action: "STATUS_CHANGE", entityType: "Encounter", entityId: visitId, patientId: v.patientId, metadata: { to: "FINALIZED" } }, tx);
    return tx.encounter.findUniqueOrThrow({ where: { id: visitId } });
  });
}
