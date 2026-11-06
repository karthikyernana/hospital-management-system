import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { listAppointments } from "@/server/services/appointments";
import { prisma } from "@/server/db";
import { APPOINTMENT_STATUSES, appointmentListQuery } from "@/lib/validation/appointment";
import { formatLocal } from "@/lib/time";
import { titleCase } from "@/lib/format";
import { Button, ButtonLink, Card, EmptyState, Input, PageHeader, Pagination, Select, Table, Td } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Appointments" };

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePermission("appointment:read");
  if (user.role === "PATIENT") redirect("/portal");
  const sp = await searchParams;
  const q = appointmentListQuery.parse({ scope: "upcoming", ...sp, pageSize: 15 });
  const [result, doctors] = await Promise.all([
    listAppointments(user, q),
    user.role === "CLINICIAN" ? [] : prisma.doctor.findMany({ where: { isActive: true }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title={user.role === "CLINICIAN" ? "My appointments" : "Appointments"}
        description="Filter by day, doctor and status. Times in IST."
        actions={can(user.role, "appointment:write") ? <ButtonLink href="/appointments/new">Book appointment</ButtonLink> : null}
      />
      <Card>
        <form className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[160px_1fr_160px_160px_auto]" aria-label="Filter appointments">
          <label className="sr-only" htmlFor="date">Date</label>
          <Input name="date" type="date" defaultValue={q.date ?? ""} />
          {user.role !== "CLINICIAN" ? (
            <>
              <label className="sr-only" htmlFor="doctorId">Doctor</label>
              <Select name="doctorId" defaultValue={q.doctorId ?? ""}>
                <option value="">All doctors</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>)}
              </Select>
            </>
          ) : <span className="hidden lg:block" />}
          <label className="sr-only" htmlFor="status">Status</label>
          <Select name="status" defaultValue={q.status ?? ""}>
            <option value="">Any status</option>
            {APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
          <label className="sr-only" htmlFor="scope">Period</label>
          <Select name="scope" defaultValue={q.scope}>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All</option>
          </Select>
          <Button type="submit" variant="secondary">Apply</Button>
        </form>
        {result.items.length === 0 ? (
          <EmptyState title="No appointments match these filters">Try another day, or widen the period to “All”.</EmptyState>
        ) : (
          <Table head={["When", "Patient", "Doctor", "Reason", "Status", ""]} caption="Appointments">
            {result.items.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <Td className="tabular-nums">{formatLocal(a.startTime)}</Td>
                <Td>{a.patient.firstName} {a.patient.lastName} <span className="font-mono text-xs text-slate-500">{a.patient.mrn}</span></Td>
                <Td>Dr. {a.doctor.firstName} {a.doctor.lastName}</Td>
                <Td className="max-w-[220px] truncate">{a.reason ?? "—"}</Td>
                <Td><StatusBadge status={a.status} /></Td>
                <Td><Link href={`/appointments/${a.id}`} className="text-sm font-medium text-teal-700 hover:underline">Open</Link></Td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/appointments" params={{ date: q.date, doctorId: q.doctorId, status: q.status, scope: q.scope }} />
      </Card>
    </>
  );
}
