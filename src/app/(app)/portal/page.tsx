import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { listAppointments } from "@/server/services/appointments";
import { listVisits } from "@/server/services/visits";
import { formatLocal } from "@/lib/time";
import { Alert, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "My health" };

/** Patient self-service view. Every query is scoped to the signed-in patient by the services. */
export default async function PortalPage({ searchParams }: { searchParams: Promise<{ booked?: string }> }) {
  const user = await requireUser();
  if (user.role !== "PATIENT") redirect("/dashboard");
  const { booked } = await searchParams;
  const [upcoming, past, visits] = await Promise.all([
    listAppointments(user, { scope: "upcoming", page: 1, pageSize: 10 }),
    listAppointments(user, { scope: "past", page: 1, pageSize: 10 }),
    listVisits(user, { page: 1, pageSize: 5 }),
  ]);
  const prescriptions = visits.items.flatMap((v) => v.prescriptions.map((p) => ({ ...p, doctor: v.doctor, date: v.startedAt })));

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} description="Your appointments, prescriptions and bills." actions={<ButtonLink href="/appointments/new">Book appointment</ButtonLink>} />
      {booked && <div className="mb-4"><Alert tone="success">Your appointment is booked.</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Upcoming appointments">
          {upcoming.items.length === 0 ? (
            <EmptyState title="No upcoming appointments"><Link className="text-teal-700 underline" href="/appointments/new">Book one now</Link></EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.items.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{formatLocal(a.startTime)}</p>
                    <p className="text-slate-600">Dr. {a.doctor.firstName} {a.doctor.lastName} · {a.doctor.department.name}</p>
                  </div>
                  <div className="flex items-center gap-3"><StatusBadge status={a.status} /><Link className="text-teal-700 hover:underline" href={`/appointments/${a.id}`}>Manage</Link></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Past visits">
          {past.items.length === 0 ? (
            <EmptyState title="No past visits yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {past.items.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{formatLocal(a.startTime)}</p>
                    <p className="text-slate-600">Dr. {a.doctor.firstName} {a.doctor.lastName}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recent prescriptions" className="lg:col-span-2">
          {prescriptions.length === 0 ? (
            <EmptyState title="No prescriptions on record" />
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {prescriptions.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span><span className="font-medium">{p.medication}</span> {p.dosage} — {p.frequency}, {p.durationDays} days</span>
                  <span className="text-slate-500">Dr. {p.doctor.lastName} · {formatLocal(p.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
