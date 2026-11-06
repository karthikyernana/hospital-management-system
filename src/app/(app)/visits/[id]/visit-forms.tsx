"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { apiFetch, ApiError, fieldError } from "@/lib/api-client";

/** Shared submit logic: POST/PATCH JSON, show field errors, refresh server data on success. */
function useAction() {
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(url: string, body: unknown, success: string, method = "POST", form?: HTMLFormElement) {
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch(url, { method, body });
      setOk(success);
      form?.reset();
      router.refresh();
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setLoading(false);
    }
  }
  const status: ReactNode = error ? <Alert>{error instanceof ApiError ? error.message : "Request failed"}</Alert> : ok ? <Alert tone="success">{ok}</Alert> : null;
  return { submit, error, loading, status };
}

const values = (e: FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;

export function NoteForm({ visitId }: { visitId: string }) {
  const a = useAction();
  return (
    <form className="space-y-2" noValidate onSubmit={(e) => { e.preventDefault(); void a.submit(`/api/visits/${visitId}/notes`, values(e), "Note added.", "POST", e.currentTarget); }}>
      {a.status}
      <Field label="Add clinical note" name="body" error={fieldError(a.error, "body")}>
        <Textarea name="body" rows={4} required error={fieldError(a.error, "body")} />
      </Field>
      <Button type="submit" loading={a.loading}>Save note</Button>
    </form>
  );
}

export function PrescriptionForm({ visitId }: { visitId: string }) {
  const a = useAction();
  return (
    <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); const v = values(e); void a.submit(`/api/visits/${visitId}/prescriptions`, { ...v, durationDays: Number(v.durationDays) }, "Prescription added.", "POST", e.currentTarget); }}>
      {a.status}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Medication" name="medication" required error={fieldError(a.error, "medication")}><Input name="medication" required error={fieldError(a.error, "medication")} /></Field>
        <Field label="Dosage" name="dosage" required error={fieldError(a.error, "dosage")}><Input name="dosage" placeholder="500 mg" required /></Field>
        <Field label="Frequency" name="frequency" required error={fieldError(a.error, "frequency")}><Input name="frequency" placeholder="Twice daily" required /></Field>
        <Field label="Duration (days)" name="durationDays" required error={fieldError(a.error, "durationDays")}><Input name="durationDays" type="number" min={1} max={365} defaultValue={5} /></Field>
      </div>
      <Field label="Instructions" name="instructions"><Input name="instructions" placeholder="After food" /></Field>
      <Button type="submit" loading={a.loading}>Add prescription</Button>
    </form>
  );
}

export function DiagnosticOrderForm({ visitId }: { visitId: string }) {
  const a = useAction();
  return (
    <form className="flex flex-wrap items-end gap-2" noValidate onSubmit={(e) => { e.preventDefault(); void a.submit(`/api/visits/${visitId}/diagnostics`, values(e), "Test ordered.", "POST", e.currentTarget); }}>
      <div className="min-w-[200px] flex-1"><Field label="Order a test" name="testName" error={fieldError(a.error, "testName")}><Input name="testName" placeholder="e.g. Lipid profile" required /></Field></div>
      <Button type="submit" variant="secondary" loading={a.loading}>Order</Button>
      <div className="w-full">{a.status}</div>
    </form>
  );
}

export function DiagnosticResultForm({ visitId, reportId }: { visitId: string; reportId: string }) {
  const a = useAction();
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="text-xs font-medium text-teal-700 underline" onClick={() => setOpen(true)}>Record result</button>;
  return (
    <form className="space-y-2 rounded-md bg-slate-50 p-3" noValidate onSubmit={async (e) => { e.preventDefault(); if (await a.submit(`/api/visits/${visitId}/diagnostics/${reportId}`, values(e), "Result recorded.", "PATCH")) setOpen(false); }}>
      {a.status}
      <Field label="Result summary (clinician-entered)" name={`resultSummary-${reportId}`} error={fieldError(a.error, "resultSummary")}><Textarea id={`resultSummary-${reportId}`} name="resultSummary" rows={2} /></Field>
      <Field label="Attached file name (metadata only)" name={`fileName-${reportId}`} error={fieldError(a.error, "fileName")}><Input id={`fileName-${reportId}`} name="fileName" placeholder="report.pdf" /></Field>
      <Button type="submit" loading={a.loading}>Save result</Button>
    </form>
  );
}

export function FinalizeButton({ visitId }: { visitId: string }) {
  const a = useAction();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-col items-end gap-2">
      {confirm ? (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setConfirm(false)}>Keep editing</Button>
          <Button loading={a.loading} onClick={() => a.submit(`/api/visits/${visitId}/finalize`, undefined, "Visit finalized.")}>Confirm finalize</Button>
        </div>
      ) : (
        <Button onClick={() => setConfirm(true)}>Finalize visit</Button>
      )}
      {a.status}
    </div>
  );
}
