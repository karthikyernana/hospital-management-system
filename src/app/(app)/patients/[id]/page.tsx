import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { getPatient } from "@/server/services/patients";
import { AppError } from "@/server/http/errors";
import { Alert, Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { ageFrom, fullName, titleCase } from "@/lib/format";
import { formatLocalDate } from "@/lib/time";

export const metadata: Metadata = { title: "Patient" };

export default async function PatientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const user = await requirePermission("patient:read");
  const { id } = await params;
  const { saved } = await searchParams;
  // getPatient writes a READ audit entry for this chart access.
  const p = await getPatient(user, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });

  const rows: [string, string | null][] = [
    ["Date of birth", `${formatLocalDate(p.dateOfBirth)} (${ageFrom(p.dateOfBirth)} y)`],
    ["Gender", titleCase(p.gender)],
    ["Phone", p.phone],
    ["Email", p.email],
    ["Address", p.address],
    ["Blood group", p.bloodGroup],
    ["Emergency contact", p.emergencyContact],
  ];

  return (
    <>
      <PageHeader
        title={fullName(p)}
        description={`${p.mrn} · registered ${formatLocalDate(p.createdAt)}`}
        actions={
          <>
            {can(user.role, "appointment:write") && <ButtonLink href={`/appointments/new?patientId=${p.id}`}>Book appointment</ButtonLink>}
            {can(user.role, "patient:write") && <ButtonLink variant="secondary" href={`/patients/${p.id}/edit`}>Edit</ButtonLink>}
          </>
        }
      />
      {saved && <div className="mb-4"><Alert tone="success">Patient record saved.</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Demographics" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[130px_1fr] gap-2">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-slate-900">{v || "—"}</dd>
              </div>
            ))}
            <div className="grid grid-cols-[130px_1fr] gap-2">
              <dt className="text-slate-500">Allergies</dt>
              <dd>{p.allergies ? <Badge tone="red">{p.allergies}</Badge> : "None recorded"}</dd>
            </div>
          </dl>
        </Card>
        <div className="space-y-6 lg:col-span-2" id="patient-activity" />
      </div>
    </>
  );
}
