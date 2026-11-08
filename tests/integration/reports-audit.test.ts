import { beforeAll, describe, expect, it } from "vitest";
import { GET as auditRoute } from "@/app/api/audit-logs/route";
import { GET as apptReportRoute } from "@/app/api/reports/appointments/route";
import { GET as billingReportRoute } from "@/app/api/reports/billing/route";
import { GET as getPatientRoute } from "@/app/api/patients/[id]/route";
import { prisma } from "@/server/db";
import { computeLine, computeTotals } from "@/lib/money";
import { addDays, toLocalDateString } from "@/lib/time";
import { call } from "../helpers";
import { seedFixtures, type Fixtures } from "../fixtures";

let f: Fixtures;
const today = toLocalDateString(new Date());

beforeAll(async () => {
  f = await seedFixtures();
  const base = new Date(Date.now() - 86_400_000);
  base.setUTCMinutes(0, 0, 0);
  const mk = (h: number, status: "COMPLETED" | "CANCELLED" | "NO_SHOW", doctorId = f.doctor.id, patientId = f.patient.id) =>
    prisma.appointment.create({ data: { patientId, doctorId, status, startTime: new Date(base.getTime() + h * 3_600_000), endTime: new Date(base.getTime() + h * 3_600_000 + 1_800_000) } });
  const a1 = await mk(0, "COMPLETED");
  await mk(1, "CANCELLED");
  await mk(2, "NO_SHOW", f.doctor2.id, f.patient2.id);
  await mk(3, "COMPLETED", f.doctor2.id, f.patient2.id);

  const lines = [{ category: "CONSULTATION" as const, description: "Consult", quantity: 1, unitPriceCents: 50_000, taxRateBps: 0 }];
  const totals = computeTotals(lines);
  await prisma.invoice.create({
    data: { number: "INV-T-1", patientId: f.patient.id, appointmentId: a1.id, status: "PAID", ...totals, amountPaidCents: totals.totalCents, lineItems: { create: lines.map((l) => ({ ...l, ...computeLine(l) })) }, payments: { create: [{ amountCents: totals.totalCents, method: "UPI", status: "SUCCEEDED", providerRef: "sandbox_t1", idempotencyKey: "t1" }] } },
  });
  await prisma.invoice.create({
    data: { number: "INV-T-2", patientId: f.patient2.id, status: "ISSUED", ...totals, lineItems: { create: lines.map((l) => ({ ...l, ...computeLine(l) })) } },
  });
});

describe("appointment & billing reports", () => {
  it("summarises appointments by status, doctor and rates", async () => {
    const { status, json } = await call(apptReportRoute, { user: f.users.admin, url: `/api/reports/appointments?from=${addDays(today, -3)}&to=${today}` });
    expect(status).toBe(200);
    expect(json.data).toMatchObject({ total: 4, byStatus: { COMPLETED: 2, CANCELLED: 1, NO_SHOW: 1 }, completionRate: 50, cancellationRate: 25, noShowRate: 25 });
    expect(json.data.byDoctor).toHaveLength(2);
  });

  it("summarises billing and confirms every invoice reconciles", async () => {
    const { json } = await call(billingReportRoute, { user: f.users.desk, url: `/api/reports/billing?from=${addDays(today, -3)}&to=${today}` });
    expect(json.data).toMatchObject({ invoiceCount: 2, invoicedCents: 100_000, collectedCents: 50_000, outstandingCents: 50_000, collectionRate: 50 });
    expect(json.data.reconciliation).toEqual({ checked: 2, unreconciled: [] });
  });

  it("validates the date range and restricts billing reports", async () => {
    expect((await call(apptReportRoute, { user: f.users.admin, url: `/api/reports/appointments?from=${today}&to=${addDays(today, -5)}` })).status).toBe(422);
    expect((await call(billingReportRoute, { user: f.users.clinician, url: "/api/reports/billing" })).status).toBe(403);
  });
});

describe("audit log API", () => {
  it("is readable by administrators only", async () => {
    expect((await call(auditRoute, { user: f.users.desk, url: "/api/audit-logs" })).status).toBe(403);
    expect((await call(auditRoute, { user: f.users.clinician, url: "/api/audit-logs" })).status).toBe(403);
    expect((await call(auditRoute, { user: f.users.admin, url: "/api/audit-logs" })).status).toBe(200);
  });

  it("filters entries by patient and action", async () => {
    await call(getPatientRoute, { user: f.users.desk, params: { id: f.patient2.id } });
    const { json } = await call(auditRoute, { user: f.users.admin, url: `/api/audit-logs?patientId=${f.patient2.id}&action=READ` });
    expect(json.data.total).toBe(1);
    expect(json.data.items[0]).toMatchObject({ action: "READ", entityType: "Patient", actorId: f.users.desk.id, actor: { email: "desk@test.local" } });
  });
});
