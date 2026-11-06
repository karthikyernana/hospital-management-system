/**
 * Acceptance tests 1 & 2: booking an available slot, and preventing
 * conflicting appointments — including truly concurrent attempts.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { POST as bookRoute, GET as listRoute } from "@/app/api/appointments/route";
import { POST as rescheduleRoute } from "@/app/api/appointments/[id]/reschedule/route";
import { POST as cancelRoute } from "@/app/api/appointments/[id]/cancel/route";
import { POST as statusRoute } from "@/app/api/appointments/[id]/status/route";
import { GET as availabilityRoute } from "@/app/api/doctors/[id]/availability/route";
import { prisma } from "@/server/db";
import { addDays, addMinutes, localMidnightUtc, toLocalDateString } from "@/lib/time";
import { call } from "../helpers";
import { seedFixtures, type Fixtures } from "../fixtures";

let f: Fixtures;
const DAY = addDays(toLocalDateString(new Date()), 10);
/** ISO start of an IST time on the test day, e.g. at("09:30"). */
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return addMinutes(localMidnightUtc(DAY), h * 60 + m).toISOString();
};

beforeEach(async () => {
  f = await seedFixtures();
});

const book = (user: Fixtures["users"][keyof Fixtures["users"]], body: Record<string, unknown>, key?: string) =>
  call(bookRoute, { user, body, headers: key ? { "idempotency-key": key } : {} });

describe("AT-1: booking an available slot", () => {
  it("books a free slot, marks it unavailable and audits the creation", async () => {
    const res = await book(f.users.desk, { patientId: f.patient.id, doctorId: f.doctor.id, startTime: at("09:30"), reason: "Check-up" });
    expect(res.status).toBe(201);
    expect(res.json.data).toMatchObject({ status: "SCHEDULED", version: 1, patientId: f.patient.id });
    expect(new Date(res.json.data.endTime).getTime() - new Date(res.json.data.startTime).getTime()).toBe(30 * 60_000);

    const avail = await call(availabilityRoute, { user: f.users.desk, url: `/api/doctors/x/availability?date=${DAY}`, params: { id: f.doctor.id } });
    const slot = avail.json.data.slots.find((s: { start: string }) => s.start === at("09:30"));
    expect(slot).toMatchObject({ available: false, booked: true });
    expect(avail.json.data.slots.filter((s: { available: boolean }) => s.available)).toHaveLength(7);

    expect(await prisma.auditLog.count({ where: { action: "CREATE", entityType: "Appointment", entityId: res.json.data.id } })).toBe(1);
  });

  it("lets a patient book for themselves but not for someone else", async () => {
    expect((await book(f.users.patient, { patientId: f.patient.id, doctorId: f.doctor.id, startTime: at("10:00") })).status).toBe(201);
    expect((await book(f.users.patient, { patientId: f.patient2.id, doctorId: f.doctor.id, startTime: at("10:30") })).status).toBe(403);
  });

  it("rejects past, misaligned and out-of-hours times with 422", async () => {
    const past = new Date(Date.now() - 86_400_000);
    past.setUTCMinutes(0, 0, 0);
    for (const startTime of [past.toISOString(), at("09:10"), at("15:00"), at("12:45")]) {
      const res = await book(f.users.desk, { patientId: f.patient.id, doctorId: f.doctor.id, startTime });
      expect(res.status).toBe(422);
    }
  });
});

describe("AT-2: conflicting appointments are prevented", () => {
  it("rejects a second booking for the same doctor and slot with 409 SLOT_UNAVAILABLE", async () => {
    expect((await book(f.users.desk, { patientId: f.patient.id, doctorId: f.doctor.id, startTime: at("11:00") })).status).toBe(201);
    const second = await book(f.users.desk, { patientId: f.patient2.id, doctorId: f.doctor.id, startTime: at("11:00") });
    expect(second.status).toBe(409);
    expect(second.json.error.code).toBe("SLOT_UNAVAILABLE");
  });

  it("allows exactly one of 10 concurrent bookings for the same slot", async () => {
    const patients = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        prisma.patient.create({ data: { mrn: `MRN-9${i}`, firstName: "C", lastName: `P${i}`, dateOfBirth: new Date("1990-01-01"), gender: "OTHER", phone: "+91 90000 00000" } }),
      ),
    );
    const results = await Promise.all(
      patients.map((p) => book(f.users.desk, { patientId: p.id, doctorId: f.doctor.id, startTime: at("12:00") })),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    expect(results.filter((r) => r.status === 409).every((r) => r.json.error.code === "SLOT_UNAVAILABLE")).toBe(true);
    expect(await prisma.appointment.count({ where: { doctorId: f.doctor.id, startTime: new Date(at("12:00")) } })).toBe(1);
  });

  it("prevents double-booking the same patient with two doctors at once", async () => {
    expect((await book(f.users.desk, { patientId: f.patient.id, doctorId: f.doctor.id, startTime: at("09:00") })).status).toBe(201);
    const clash = await book(f.users.desk, { patientId: f.patient.id, doctorId: f.doctor2.id, startTime: at("09:00") });
    expect(clash.status).toBe(409);
    expect(clash.json.error.message).toMatch(/patient already has an appointment/i);
  });

  it("frees the slot when an appointment is cancelled", async () => {
    const first = await book(f.users.desk, { patientId: f.patient.id, doctorId: f.doctor.id, startTime: at("10:00") });
    const cancel = await call(cancelRoute, { user: f.users.desk, params: { id: first.json.data.id }, body: { reason: "Patient unwell", version: 1 } });
    expect(cancel.json.data.status).toBe("CANCELLED");
    expect((await book(f.users.desk, { patientId: f.patient2.id, doctorId: f.doctor.id, startTime: at("10:00") })).status).toBe(201);
  });
});

describe("idempotent booking", () => {
  it("replays the original appointment for a repeated Idempotency-Key", async () => {
    const body = { patientId: f.patient.id, doctorId: f.doctor.id, startTime: at("09:30") };
    const a = await book(f.users.desk, body, "key-abc-123456");
    const b = await book(f.users.desk, body, "key-abc-123456");
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.res.headers.get("Idempotent-Replayed")).toBe("true");
    expect(b.json.data.id).toBe(a.json.data.id);
    expect(await prisma.appointment.count()).toBe(1);
  });

  it("collapses concurrent duplicate submissions into one appointment", async () => {
    const body = { patientId: f.patient.id, doctorId: f.doctor.id, startTime: at("10:30") };
    const results = await Promise.all(Array.from({ length: 5 }, () => book(f.users.desk, body, "double-click-key-1")));
    expect(new Set(results.map((r) => r.json.data.id)).size).toBe(1);
    expect(results.every((r) => r.status === 201 || r.status === 200)).toBe(true);
    expect(await prisma.appointment.count()).toBe(1);
  });

  it("rejects reuse of a key for a different request", async () => {
    await book(f.users.desk, { patientId: f.patient.id, doctorId: f.doctor.id, startTime: at("09:30") }, "reused-key-0001");
    const other = await book(f.users.desk, { patientId: f.patient.id, doctorId: f.doctor.id, startTime: at("11:30") }, "reused-key-0001");
    expect(other.status).toBe(422);
    expect(other.json.error.code).toBe("IDEMPOTENCY_MISMATCH");
  });
});

describe("reschedule, cancel and state transitions", () => {
  async function booked(time: string, patientId = f.patient.id) {
    return (await book(f.users.desk, { patientId, doctorId: f.doctor.id, startTime: at(time) })).json.data;
  }

  it("reschedules to a free slot and bumps the version", async () => {
    const appt = await booked("09:00");
    const res = await call(rescheduleRoute, { user: f.users.desk, params: { id: appt.id }, body: { startTime: at("11:30"), version: 1 } });
    expect(res.status).toBe(200);
    expect(res.json.data).toMatchObject({ startTime: at("11:30"), version: 2 });
  });

  it("refuses to reschedule into a taken slot or with a stale version", async () => {
    const a = await booked("09:00");
    await booked("09:30", f.patient2.id);
    const taken = await call(rescheduleRoute, { user: f.users.desk, params: { id: a.id }, body: { startTime: at("09:30"), version: 1 } });
    expect(taken.status).toBe(409);
    expect(taken.json.error.code).toBe("SLOT_UNAVAILABLE");
    const stale = await call(rescheduleRoute, { user: f.users.desk, params: { id: a.id }, body: { startTime: at("12:30"), version: 7 } });
    expect(stale.json.error.code).toBe("STALE_VERSION");
  });

  it("enforces the state machine and role rules for transitions", async () => {
    const a = await booked("10:00");
    // Cannot complete before check-in.
    const jump = await call(statusRoute, { user: f.users.clinician, params: { id: a.id }, body: { status: "COMPLETED", version: 1 } });
    expect(jump.json.error.code).toBe("INVALID_STATE");
    // Patients cannot check themselves in.
    expect((await call(statusRoute, { user: f.users.patient, params: { id: a.id }, body: { status: "CHECKED_IN", version: 1 } })).status).toBe(403);
    // Front desk checks in; another doctor's clinician cannot complete it.
    expect((await call(statusRoute, { user: f.users.desk, params: { id: a.id }, body: { status: "CHECKED_IN", version: 1 } })).json.data.status).toBe("CHECKED_IN");
    expect((await call(statusRoute, { user: f.users.otherClinician, params: { id: a.id }, body: { status: "COMPLETED", version: 2 } })).status).toBe(403);
    expect((await call(statusRoute, { user: f.users.clinician, params: { id: a.id }, body: { status: "COMPLETED", version: 2 } })).json.data.status).toBe("COMPLETED");
    // Terminal: cannot cancel or reschedule a completed appointment.
    expect((await call(cancelRoute, { user: f.users.desk, params: { id: a.id }, body: { reason: "late cancel", version: 3 } })).json.error.code).toBe("INVALID_STATE");
    expect((await call(rescheduleRoute, { user: f.users.desk, params: { id: a.id }, body: { startTime: at("12:00"), version: 3 } })).json.error.code).toBe("INVALID_STATE");
    // No-show cannot be recorded for a future appointment.
    const b = await booked("12:30");
    expect((await call(statusRoute, { user: f.users.desk, params: { id: b.id }, body: { status: "NO_SHOW", version: 1 } })).status).toBe(422);
  });

  it("scopes appointment lists by role", async () => {
    await booked("09:00");
    await booked("09:30", f.patient2.id);
    const mine = await call(listRoute, { user: f.users.patient, url: "/api/appointments" });
    expect(mine.json.data.total).toBe(1);
    const other = await call(listRoute, { user: f.users.otherClinician, url: "/api/appointments" });
    expect(other.json.data.total).toBe(0);
    const desk = await call(listRoute, { user: f.users.desk, url: `/api/appointments?date=${DAY}` });
    expect(desk.json.data.total).toBe(2);
  });
});
