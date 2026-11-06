import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { getDoctor } from "@/server/services/directory";
import { AppError } from "@/server/http/errors";
import { formatINR } from "@/lib/money";
import { minuteToHHMM, WEEKDAYS } from "@/lib/time";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { ScheduleEditor } from "./schedule-editor";

export default async function DoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("directory:read");
  const { id } = await params;
  const d = await getDoctor(user, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  return (
    <>
      <PageHeader
        title={`Dr. ${d.firstName} ${d.lastName}`}
        description={`${d.specialty} · ${d.department.name}`}
        actions={can(user.role, "appointment:write") ? <ButtonLink href={`/appointments/new?doctorId=${d.id}`}>Book with this doctor</ButtonLink> : null}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Profile">
          <dl className="space-y-2 text-sm">
            {[
              ["License", d.licenseNo],
              ["Email", d.email],
              ["Phone", d.phone],
              ["Slot length", `${d.slotMinutes} minutes`],
              ["Consultation fee", formatINR(d.consultationFeeCents)],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[130px_1fr]"><dt className="text-slate-500">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </Card>
        <Card title="Weekly schedule (IST)" className="lg:col-span-2">
          {can(user.role, "directory:write") ? (
            <ScheduleEditor doctorId={d.id} initial={d.schedules.map(({ dayOfWeek, startMinute, endMinute }) => ({ dayOfWeek, startMinute, endMinute }))} />
          ) : d.schedules.length === 0 ? (
            <EmptyState title="No working hours set" />
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {d.schedules.map((s) => (
                <li key={s.id} className="flex justify-between py-2">
                  <span>{WEEKDAYS[s.dayOfWeek]}</span>
                  <span className="tabular-nums">{minuteToHHMM(s.startMinute)} – {minuteToHHMM(s.endMinute)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
