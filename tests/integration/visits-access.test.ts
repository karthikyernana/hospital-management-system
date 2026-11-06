/**
 * Acceptance tests 3 & 5: only authorized roles can read/update patient visit
 * information, and sensitive access/edits produce audit entries.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { POST as startVisitRoute, GET as listVisitsRoute } from "@/app/api/visits/route";
import { GET as getVisitRoute } from "@/app/api/visits/[id]/route";
import { POST as noteRoute } from "@/app/api/visits/[id]/notes/route";
import { POST as rxRoute } from "@/app/api/visits/[id]/prescriptions/route";
import { POST as dxRoute } from "@/app/api/visits/[id]/diagnostics/route";
import { PATCH as dxResultRoute } from "@/app/api/visits/[id]/diagnostics/[reportId]/route";
import { POST as finalizeRoute } from "@/app/api/visits/[id]/finalize/route";
import { prisma } from "@/server/db";
import { call } from "../helpers";
import { seedFixtures, type Fixtures } from "../fixtures";

let f: Fixtures;
let visitId: string;
let appointmentId: string;

beforeAll(async () => {
  f = await seedFixtures();
  const start = new Date(Date.now() + 2 * 3600_000);
  start.setUTCMinutes(0, 0, 0);
  const appt = await prisma.appointment.create({
    data: { patientId: f.patient.id, doctorId: f.doctor.id, startTime: start, endTime: new Date(start.getTime() + 30 * 60_000), status: "CHECKED_IN", reason: "Headache" },
  });
  appointmentId = appt.id;
});

const auditCount = (where: Record<string, unknown>) => prisma.auditLog.count({ where });

describe("starting a visit", () => {
  it("front desk cannot start a visit (403)", async () => {
    expect((await call(startVisitRoute, { user: f.users.desk, body: { appointmentId } })).status).toBe(403);
  });
  it("a clinician cannot start a visit for another doctor's appointment", async () => {
    expect((await call(startVisitRoute, { user: f.users.otherClinician, body: { appointmentId } })).status).toBe(403);
  });
  it("the treating clinician starts exactly one visit per appointment", async () => {
    const res = await call(startVisitRoute, { user: f.users.clinician, body: { appointmentId } });
    expect(res.status).toBe(201);
    visitId = res.json.data.id;
    const dup = await call(startVisitRoute, { user: f.users.clinician, body: { appointmentId } });
    expect(dup.status).toBe(409);
  });
});

describe("AT-3: only authorized roles read/update visit information", () => {
  it("treating clinician writes notes, prescriptions and diagnostics — each audited", async () => {
    const note = await call(noteRoute, { user: f.users.clinician, params: { id: visitId }, body: { body: "Mild tension headache reported." } });
    expect(note.status).toBe(201);
    const rx = await call(rxRoute, { user: f.users.clinician, params: { id: visitId }, body: { medication: "Paracetamol", dosage: "500 mg", frequency: "Twice daily", durationDays: 3 } });
    expect(rx.status).toBe(201);
    const dx = await call(dxRoute, { user: f.users.clinician, params: { id: visitId }, body: { testName: "CBC" } });
    expect(dx.status).toBe(201);
    for (const entityType of ["ClinicalNote", "Prescription", "DiagnosticReport"]) {
      expect(await auditCount({ action: "CREATE", entityType, patientId: f.patient.id, actorId: f.users.clinician.id })).toBe(1);
    }
  });

  it("front desk can neither read nor write clinical content", async () => {
    expect((await call(getVisitRoute, { user: f.users.desk, params: { id: visitId } })).status).toBe(403);
    expect((await call(listVisitsRoute, { user: f.users.desk, url: `/api/visits?patientId=${f.patient.id}` })).status).toBe(403);
    expect((await call(noteRoute, { user: f.users.desk, params: { id: visitId }, body: { body: "I should not write this" } })).status).toBe(403);
  });

  it("a clinician without a care relationship cannot read the visit; the denial is audited", async () => {
    const before = await auditCount({ action: "ACCESS_DENIED", actorId: f.users.otherClinician.id });
    const res = await call(getVisitRoute, { user: f.users.otherClinician, params: { id: visitId } });
    expect(res.status).toBe(403);
    expect(await auditCount({ action: "ACCESS_DENIED", actorId: f.users.otherClinician.id })).toBe(before + 1);
    // Nor can they write to it.
    expect((await call(noteRoute, { user: f.users.otherClinician, params: { id: visitId }, body: { body: "Not my patient" } })).status).toBe(403);
  });

  it("administrators get read-only access", async () => {
    expect((await call(getVisitRoute, { user: f.users.admin, params: { id: visitId } })).status).toBe(200);
    expect((await call(noteRoute, { user: f.users.admin, params: { id: visitId }, body: { body: "Admin note attempt" } })).status).toBe(403);
  });

  it("patients cannot see an open visit, and see finalized visits without clinician notes", async () => {
    expect((await call(getVisitRoute, { user: f.users.patient, params: { id: visitId } })).status).toBe(403);
    const fin = await call(finalizeRoute, { user: f.users.clinician, params: { id: visitId } });
    expect(fin.status).toBe(200);
    const mine = await call(getVisitRoute, { user: f.users.patient, params: { id: visitId } });
    expect(mine.status).toBe(200);
    expect(mine.json.data.notes).toEqual([]);
    expect(mine.json.data.prescriptions).toHaveLength(1);
  });

  it("finalizing completes the appointment and locks the record", async () => {
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } })).status).toBe("COMPLETED");
    const late = await call(noteRoute, { user: f.users.clinician, params: { id: visitId }, body: { body: "Late addition" } });
    expect(late.status).toBe(409);
    expect(late.json.error.code).toBe("INVALID_STATE");
  });

  it("diagnostic results can still be recorded after finalization, exactly once", async () => {
    const report = await prisma.diagnosticReport.findFirstOrThrow({ where: { encounterId: visitId } });
    const ok = await call(dxResultRoute, { user: f.users.clinician, method: "PATCH", params: { id: visitId, reportId: report.id }, body: { resultSummary: "Within range", fileName: "cbc.pdf" } });
    expect(ok.status).toBe(200);
    expect(ok.json.data.status).toBe("RESULTED");
    const again = await call(dxResultRoute, { user: f.users.clinician, method: "PATCH", params: { id: visitId, reportId: report.id }, body: { resultSummary: "Changed" } });
    expect(again.status).toBe(409);
  });
});

describe("AT-5: sensitive record access produces audit entries", () => {
  it("every successful visit read is logged with actor, role and patient", async () => {
    const before = await auditCount({ action: "READ", entityType: "Encounter", entityId: visitId });
    await call(getVisitRoute, { user: f.users.clinician, params: { id: visitId } });
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: "READ", entityType: "Encounter", entityId: visitId }, orderBy: { createdAt: "desc" } });
    expect(await auditCount({ action: "READ", entityType: "Encounter", entityId: visitId })).toBe(before + 1);
    expect(entry).toMatchObject({ actorId: f.users.clinician.id, actorRole: "CLINICIAN", patientId: f.patient.id });
  });

  it("the audit log is append-only at the database level", async () => {
    const entry = await prisma.auditLog.findFirstOrThrow();
    await expect(prisma.auditLog.update({ where: { id: entry.id }, data: { action: "TAMPERED" } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
  });
});
