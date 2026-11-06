import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/current-user";
import { getAppointment } from "@/server/services/appointments";
import { AppError } from "@/server/http/errors";
import { TRANSITIONS, TRANSITION_ROLES } from "@/server/domain/appointment-state";
import { formatLocal, toLocalDateString } from "@/lib/time";
import { Alert, Card, PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { AppointmentActions } from "./appointment-actions";

export const metadata: Metadata = { title: "Appointment" };

export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ booked?: string }> }) {
  const user = await requirePermission("appointment:read");
  const { id } = await params;
  const { booked } = await searchParams;
  const a = await getAppointment(user, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });

  // Offer only the actions this role may take from the current state (server re-validates).
  const next = TRANSITIONS[a.status].filter((s) => TRANSITION_ROLES[s]?.includes(user.role));
  const canReschedule = a.status === "SCHEDULED" && ["ADMIN", "FRONT_DESK", "PATIENT"].includes(user.role);

  return (
    <>
      <PageHeader title={`Appointment · ${formatLocal(a.startTime)}`} description={`Dr. ${a.doctor.firstName} ${a.doctor.lastName} · ${a.doctor.department.name}`} />
      {booked && <div className="mb-4"><Alert tone="success">Appointment booked.</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            <div className="grid grid-cols-[110px_1fr]"><dt className="text-slate-500">Status</dt><dd><StatusBadge status={a.status} /></dd></div>
            <div className="grid grid-cols-[110px_1fr]"><dt className="text-slate-500">Patient</dt><dd>{user.role === "PATIENT" ? `${a.patient.firstName} ${a.patient.lastName}` : <Link className="text-teal-700 hover:underline" href={`/patients/${a.patient.id}`}>{a.patient.firstName} {a.patient.lastName}</Link>} <span className="font-mono text-xs text-slate-500">{a.patient.mrn}</span></dd></div>
            <div className="grid grid-cols-[110px_1fr]"><dt className="text-slate-500">Time</dt><dd>{formatLocal(a.startTime)} ({a.doctor.slotMinutes} min)</dd></div>
            <div className="grid grid-cols-[110px_1fr]"><dt className="text-slate-500">Reason</dt><dd>{a.reason ?? "—"}</dd></div>
            {a.cancelReason && <div className="grid grid-cols-[110px_1fr]"><dt className="text-slate-500">Cancelled</dt><dd>{a.cancelReason}</dd></div>}
            {a.encounter && user.role !== "PATIENT" && user.role !== "FRONT_DESK" && <div className="grid grid-cols-[110px_1fr]"><dt className="text-slate-500">Visit</dt><dd><Link className="text-teal-700 hover:underline" href={`/visits/${a.encounter.id}`}>Open visit record</Link></dd></div>}
            {a.invoice && user.role !== "CLINICIAN" && <div className="grid grid-cols-[110px_1fr]"><dt className="text-slate-500">Invoice</dt><dd><Link className="text-teal-700 hover:underline" href={user.role === "PATIENT" ? `/portal/invoices/${a.invoice.id}` : `/billing/${a.invoice.id}`}>{a.invoice.number}</Link> <StatusBadge status={a.invoice.status} /></dd></div>}
          </dl>
        </Card>
        <Card title="Actions" className="lg:col-span-2">
          <AppointmentActions
            appointment={{ id: a.id, version: a.version, status: a.status, doctorId: a.doctorId, date: toLocalDateString(a.startTime), hasEncounter: !!a.encounter, hasInvoice: !!a.invoice }}
            role={user.role}
            nextStatuses={next}
            canReschedule={canReschedule}
          />
        </Card>
      </div>
    </>
  );
}
