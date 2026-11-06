/**
 * Operational reports. Aggregations run in the database (groupBy / SQL) so
 * they stay fast as data grows. Ranges are IST calendar days, inclusive.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { assertCan } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import { forbidden } from "../http/errors";
import { reconcileInvoice } from "../domain/billing";
import { addDays, localMidnightUtc, toLocalDateString } from "@/lib/time";
import type { DateRange } from "@/lib/validation/reports";

export function resolveRange(r: DateRange, defaultDays = 30) {
  const today = toLocalDateString(new Date());
  const to = r.to ?? today;
  const from = r.from ?? addDays(to, -(defaultDays - 1));
  return { from, to, start: localMidnightUtc(from), end: localMidnightUtc(addDays(to, 1)) };
}

export async function appointmentSummary(actor: SessionUser, range: DateRange) {
  assertCan(actor.role, "report:read");
  const { from, to, start, end } = resolveRange(range);
  const where = { startTime: { gte: start, lt: end } };

  const [byStatus, byDoctor, daily] = await Promise.all([
    prisma.appointment.groupBy({ by: ["status"], where, _count: true }),
    prisma.appointment.groupBy({ by: ["doctorId"], where, _count: true, orderBy: { _count: { doctorId: "desc" } } }),
    prisma.$queryRaw<{ day: string; count: bigint }[]>(Prisma.sql`
      SELECT to_char(("startTime" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day, COUNT(*) AS count
      FROM "Appointment" WHERE "startTime" >= ${start} AND "startTime" < ${end}
      GROUP BY 1 ORDER BY 1`),
  ]);
  const doctors = await prisma.doctor.findMany({
    where: { id: { in: byDoctor.map((d) => d.doctorId) } },
    select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } },
  });
  const statusCounts = Object.fromEntries(byStatus.map((s) => [s.status, s._count])) as Record<string, number>;
  const total = byStatus.reduce((s, x) => s + x._count, 0);
  const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);

  const deptMap = new Map<string, number>();
  const perDoctor = byDoctor.map((d) => {
    const doc = doctors.find((x) => x.id === d.doctorId)!;
    deptMap.set(doc.department.name, (deptMap.get(doc.department.name) ?? 0) + d._count);
    return { doctorId: d.doctorId, name: `Dr. ${doc.firstName} ${doc.lastName}`, department: doc.department.name, count: d._count };
  });

  return {
    from,
    to,
    total,
    byStatus: statusCounts,
    completionRate: pct(statusCounts.COMPLETED ?? 0),
    cancellationRate: pct(statusCounts.CANCELLED ?? 0),
    noShowRate: pct(statusCounts.NO_SHOW ?? 0),
    byDepartment: [...deptMap.entries()].map(([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count),
    byDoctor: perDoctor,
    daily: daily.map((d) => ({ day: d.day, count: Number(d.count) })),
  };
}

export async function billingSummary(actor: SessionUser, range: DateRange) {
  assertCan(actor.role, "report:read");
  if (actor.role !== "ADMIN" && actor.role !== "FRONT_DESK") throw forbidden("Billing reports are limited to billing staff");
  const { from, to, start, end } = resolveRange(range);
  const where: Prisma.InvoiceWhereInput = { createdAt: { gte: start, lt: end }, status: { not: "VOID" } };

  const [byStatus, totals, payments, invoices] = await Promise.all([
    prisma.invoice.groupBy({ by: ["status"], where: { createdAt: { gte: start, lt: end } }, _count: true, _sum: { totalCents: true } }),
    prisma.invoice.aggregate({ where: { ...where, status: { in: ["ISSUED", "PAID"] } }, _sum: { totalCents: true, amountPaidCents: true }, _count: true }),
    prisma.payment.groupBy({ by: ["method", "status"], where: { createdAt: { gte: start, lt: end } }, _count: true, _sum: { amountCents: true } }),
    prisma.invoice.findMany({ where, include: { lineItems: true, payments: true } }),
  ]);
  // Reconcile every invoice in the period against its line items and payments.
  const unreconciled = invoices.filter((i) => !reconcileInvoice(i).ok).map((i) => i.number);
  const invoiced = totals._sum.totalCents ?? 0;
  const collected = totals._sum.amountPaidCents ?? 0;

  return {
    from,
    to,
    invoiceCount: totals._count,
    invoicedCents: invoiced,
    collectedCents: collected,
    outstandingCents: invoiced - collected,
    collectionRate: invoiced ? Math.round((collected / invoiced) * 1000) / 10 : 0,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count, totalCents: s._sum.totalCents ?? 0 })),
    payments: payments.map((p) => ({ method: p.method, status: p.status, count: p._count, amountCents: p._sum.amountCents ?? 0 })),
    reconciliation: { checked: invoices.length, unreconciled },
  };
}

/** Small role-aware snapshot for the dashboard. */
export async function dashboardSnapshot(actor: SessionUser) {
  const today = toLocalDateString(new Date());
  const start = localMidnightUtc(today);
  const end = localMidnightUtc(addDays(today, 1));
  const scope: Prisma.AppointmentWhereInput = actor.role === "CLINICIAN" ? { doctorId: actor.doctorId ?? "__none__" } : {};
  const todayWhere = { ...scope, startTime: { gte: start, lt: end } };

  const [todayTotal, waiting, upcomingWeek, openVisits, outstanding, newPatients] = await Promise.all([
    prisma.appointment.count({ where: { ...todayWhere, status: { in: ["SCHEDULED", "CHECKED_IN", "COMPLETED"] } } }),
    prisma.appointment.count({ where: { ...todayWhere, status: "CHECKED_IN" } }),
    prisma.appointment.count({ where: { ...scope, status: "SCHEDULED", startTime: { gte: new Date(), lt: localMidnightUtc(addDays(today, 7)) } } }),
    actor.role === "CLINICIAN" ? prisma.encounter.count({ where: { doctorId: actor.doctorId ?? "__none__", status: "OPEN" } }) : Promise.resolve(null),
    actor.role === "CLINICIAN" ? Promise.resolve(null) : prisma.invoice.aggregate({ where: { status: "ISSUED" }, _sum: { totalCents: true, amountPaidCents: true }, _count: true }),
    actor.role === "CLINICIAN" ? Promise.resolve(null) : prisma.patient.count({ where: { createdAt: { gte: localMidnightUtc(addDays(today, -29)) } } }),
  ]);
  return {
    today,
    todayTotal,
    waiting,
    upcomingWeek,
    openVisits,
    outstanding: outstanding ? { count: outstanding._count, cents: (outstanding._sum.totalCents ?? 0) - (outstanding._sum.amountPaidCents ?? 0) } : null,
    newPatients,
  };
}
