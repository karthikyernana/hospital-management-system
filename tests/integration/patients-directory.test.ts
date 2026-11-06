import { beforeAll, describe, expect, it } from "vitest";
import { GET as listPatientsRoute, POST as createPatientRoute } from "@/app/api/patients/route";
import { GET as getPatientRoute, PATCH as patchPatientRoute } from "@/app/api/patients/[id]/route";
import { GET as listDoctorsRoute } from "@/app/api/doctors/route";
import { PUT as scheduleRoute } from "@/app/api/doctors/[id]/schedule/route";
import { prisma } from "@/server/db";
import { findScheduleOverlap } from "@/server/services/directory";
import { call } from "../helpers";
import { seedFixtures, type Fixtures } from "../fixtures";

let f: Fixtures;
beforeAll(async () => {
  f = await seedFixtures();
});

const newPatient = { firstName: "Test", lastName: "Person", dateOfBirth: "2000-01-15", gender: "FEMALE", phone: "+91 98765 43210" };

describe("patient registry", () => {
  it("front desk registers a patient and the server assigns the next MRN", async () => {
    const { status, json } = await call(createPatientRoute, { user: f.users.desk, body: newPatient });
    expect(status).toBe(201);
    expect(json.data.mrn).toBe("MRN-100003");
    expect(await prisma.auditLog.count({ where: { action: "CREATE", entityType: "Patient", entityId: json.data.id } })).toBe(1);
  });

  it("rejects invalid input with field-level errors", async () => {
    const { status, json } = await call(createPatientRoute, { user: f.users.desk, body: { ...newPatient, phone: "abc", dateOfBirth: "2999-01-01" } });
    expect(status).toBe(422);
    expect(Object.keys(json.error.details.fieldErrors)).toEqual(expect.arrayContaining(["phone", "dateOfBirth"]));
  });

  it("clinicians cannot register patients (server-side 403, audited)", async () => {
    const { status } = await call(createPatientRoute, { user: f.users.clinician, body: newPatient });
    expect(status).toBe(403);
    expect(await prisma.auditLog.count({ where: { action: "ACCESS_DENIED", actorId: f.users.clinician.id } })).toBeGreaterThan(0);
  });

  it("searches by name, MRN or phone with pagination", async () => {
    const byName = await call(listPatientsRoute, { user: f.users.desk, url: "/api/patients?q=kumar" });
    expect(byName.json.data.items.map((p: { mrn: string }) => p.mrn)).toEqual(["MRN-100001"]);
    const byMrn = await call(listPatientsRoute, { user: f.users.desk, url: "/api/patients?q=100002" });
    expect(byMrn.json.data.total).toBe(1);
    const page = await call(listPatientsRoute, { user: f.users.desk, url: "/api/patients?pageSize=2&page=2" });
    expect(page.json.data).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(page.json.data.items).toHaveLength(1);
  });

  it("reading a patient chart writes a READ audit entry", async () => {
    const before = await prisma.auditLog.count({ where: { action: "READ", patientId: f.patient.id } });
    const { status } = await call(getPatientRoute, { user: f.users.clinician, params: { id: f.patient.id } });
    expect(status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: "READ", patientId: f.patient.id } })).toBe(before + 1);
  });

  it("a patient can read their own record but not another patient's", async () => {
    expect((await call(getPatientRoute, { user: f.users.patient, params: { id: f.patient.id } })).status).toBe(200);
    expect((await call(getPatientRoute, { user: f.users.patient, params: { id: f.patient2.id } })).status).toBe(403);
  });

  it("updates are audited with field names only (no PHI values)", async () => {
    const { status } = await call(patchPatientRoute, { user: f.users.desk, method: "PATCH", params: { id: f.patient2.id }, body: { phone: "+91 90000 12345" } });
    expect(status).toBe(200);
    const entry = await prisma.auditLog.findFirst({ where: { action: "UPDATE", entityId: f.patient2.id } });
    expect(entry?.metadata).toEqual({ fields: ["phone"] });
    expect(JSON.stringify(entry?.metadata)).not.toContain("12345");
  });

  it("returns 404 for an unknown patient", async () => {
    expect((await call(getPatientRoute, { user: f.users.desk, params: { id: "nope" } })).status).toBe(404);
  });
});

describe("directory & schedules", () => {
  it("lists doctors filtered by department", async () => {
    const { json } = await call(listDoctorsRoute, { user: f.users.desk, url: `/api/doctors?departmentId=${f.dept.id}` });
    expect(json.data.total).toBe(2);
  });

  it("detects overlapping schedule windows", () => {
    expect(findScheduleOverlap([{ dayOfWeek: 1, startMinute: 540, endMinute: 720 }, { dayOfWeek: 1, startMinute: 700, endMinute: 800 }])).toMatch(/overlap/);
    expect(findScheduleOverlap([{ dayOfWeek: 1, startMinute: 540, endMinute: 720 }, { dayOfWeek: 2, startMinute: 600, endMinute: 800 }])).toBeNull();
  });

  it("only admins can replace a schedule; overlapping windows are rejected", async () => {
    const body = { windows: [{ dayOfWeek: 1, startMinute: 540, endMinute: 600 }] };
    expect((await call(scheduleRoute, { user: f.users.desk, method: "PUT", params: { id: f.doctor2.id }, body })).status).toBe(403);
    const bad = { windows: [...body.windows, { dayOfWeek: 1, startMinute: 570, endMinute: 660 }] };
    expect((await call(scheduleRoute, { user: f.users.admin, method: "PUT", params: { id: f.doctor2.id }, body: bad })).status).toBe(422);
    const ok = await call(scheduleRoute, { user: f.users.admin, method: "PUT", params: { id: f.doctor2.id }, body });
    expect(ok.status).toBe(200);
    expect(ok.json.data).toHaveLength(1);
  });
});
