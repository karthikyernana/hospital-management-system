import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/current-user";
import { getVisit } from "@/server/services/visits";
import { AppError } from "@/server/http/errors";
import { formatLocal, formatLocalDate } from "@/lib/time";
import { ageFrom, titleCase } from "@/lib/format";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { NoteForm, PrescriptionForm, DiagnosticOrderForm, DiagnosticResultForm, FinalizeButton } from "./visit-forms";

export const metadata: Metadata = { title: "Visit" };

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("visit:read");
  const { id } = await params;
  const v = await getVisit(user, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const canEdit = user.role === "CLINICIAN" && v.doctorId === user.doctorId;
  const open = v.status === "OPEN";

  return (
    <>
      <PageHeader
        title={`Visit · ${v.patient.firstName} ${v.patient.lastName}`}
        description={`${v.patient.mrn} · ${ageFrom(v.patient.dateOfBirth)} y · ${titleCase(v.patient.gender)} · Dr. ${v.doctor.firstName} ${v.doctor.lastName} · started ${formatLocal(v.startedAt)}`}
        actions={canEdit && open ? <FinalizeButton visitId={v.id} /> : <StatusBadge status={v.status} />}
      />
      {v.patient.allergies && <div className="mb-4"><Alert title="Allergies">{v.patient.allergies}</Alert></div>}
      {!canEdit && user.role !== "PATIENT" && <div className="mb-4"><Alert tone="info">Read-only view. Your access to this record has been logged.</Alert></div>}
      <p className="mb-4 text-xs text-slate-500">This system records clinician-entered information only. It does not generate or suggest diagnoses.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {user.role !== "PATIENT" && (
          <Card title="Clinical notes" className="lg:col-span-2">
            {v.chiefComplaint && <p className="mb-3 text-sm"><span className="text-slate-500">Chief complaint:</span> {v.chiefComplaint}</p>}
            {v.notes.length === 0 ? <EmptyState title="No notes yet" /> : (
              <ol className="space-y-3">
                {v.notes.map((n) => (
                  <li key={n.id} className="rounded-md bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatLocal(n.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
            {canEdit && open && <div className="mt-4"><NoteForm visitId={v.id} /></div>}
          </Card>
        )}
        <Card title="Prescriptions">
          {v.prescriptions.length === 0 ? <EmptyState title="No prescriptions" /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {v.prescriptions.map((p) => (
                <li key={p.id} className="py-2">
                  <p className="font-medium">{p.medication} <span className="font-normal text-slate-600">{p.dosage}</span></p>
                  <p className="text-slate-600">{p.frequency} · {p.durationDays} days{p.instructions ? ` · ${p.instructions}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
          {canEdit && open && <div className="mt-4 border-t border-slate-100 pt-4"><PrescriptionForm visitId={v.id} /></div>}
        </Card>
        <Card title="Diagnostic reports (metadata)">
          {v.diagnosticReports.length === 0 ? <EmptyState title="No tests ordered" /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {v.diagnosticReports.map((r) => (
                <li key={r.id} className="space-y-1 py-2">
                  <div className="flex items-center justify-between gap-2"><span className="font-medium">{r.testName}</span><StatusBadge status={r.status} /></div>
                  <p className="text-xs text-slate-500">Ordered {formatLocalDate(r.orderedAt)}{r.resultedAt ? ` · resulted ${formatLocalDate(r.resultedAt)}` : ""}</p>
                  {r.resultSummary && <p className="text-slate-700">{r.resultSummary}</p>}
                  {r.fileName && <Badge>{r.fileName}</Badge>}
                  {canEdit && r.status === "ORDERED" && <DiagnosticResultForm visitId={v.id} reportId={r.id} />}
                </li>
              ))}
            </ul>
          )}
          {canEdit && open && <div className="mt-4 border-t border-slate-100 pt-4"><DiagnosticOrderForm visitId={v.id} /></div>}
        </Card>
      </div>
      {v.appointment && user.role !== "PATIENT" && <p className="mt-6 text-sm"><Link className="text-teal-700 hover:underline" href={`/appointments/${v.appointment.id}`}>Back to appointment</Link></p>}
    </>
  );
}
