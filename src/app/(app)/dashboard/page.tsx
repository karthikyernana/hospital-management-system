import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { dashboardSnapshot } from "@/server/services/reports";
import { listAppointments } from "@/server/services/appointments";
import { formatINR } from "@/lib/money";
import { formatLocal } from "@/lib/time";
import { ButtonLink, Card, EmptyState, PageHeader, Table, Td } from "@/components/ui";
import { Stat } from "@/components/bar-list";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.role === "PATIENT") redirect("/portal");
  const [snap, today] = await Promise.all([
    dashboardSnapshot(user),
    listAppointments(user, { date: undefined, scope: "upcoming", page: 1, pageSize: 8 }),
  ]);

  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(" ").slice(0, 2).join(" ")}`}
        description={`Today is ${snap.today} (IST).`}
        actions={can(user.role, "appointment:write") ? <ButtonLink href="/appointments/new">Book appointment</ButtonLink> : null}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={user.role === "CLINICIAN" ? "My appointments today" : "Appointments today"} value={snap.todayTotal} />
        <Stat label="Checked in, waiting" value={snap.waiting} />
        <Stat label="Booked next 7 days" value={snap.upcomingWeek} />
        {snap.openVisits !== null && <Stat label="My open visits" value={snap.openVisits} hint="Finalize when done" />}
        {snap.outstanding && <Stat label="Outstanding bills" value={formatINR(snap.outstanding.cents)} hint={`${snap.outstanding.count} issued invoices`} />}
      </div>
      <Card title="Next appointments" actions={<Link className="text-sm text-teal-700 hover:underline" href="/appointments">View all</Link>}>
        {today.items.length === 0 ? (
          <EmptyState title="Nothing scheduled" />
        ) : (
          <Table head={["When", "Patient", "Doctor", "Status", ""]} caption="Next appointments">
            {today.items.map((a) => (
              <tr key={a.id}>
                <Td className="tabular-nums">{formatLocal(a.startTime)}</Td>
                <Td>{a.patient.firstName} {a.patient.lastName}</Td>
                <Td>Dr. {a.doctor.lastName}</Td>
                <Td><StatusBadge status={a.status} /></Td>
                <Td><Link className="text-teal-700 hover:underline" href={`/appointments/${a.id}`}>Open</Link></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
