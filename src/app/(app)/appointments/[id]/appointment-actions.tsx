"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { SlotPicker } from "@/components/slot-picker";
import { apiFetch, ApiError } from "@/lib/api-client";

interface Props {
  appointment: { id: string; version: number; status: string; doctorId: string; date: string; hasEncounter: boolean; hasInvoice: boolean };
  role: string;
  nextStatuses: string[];
  canReschedule: boolean;
}

export function AppointmentActions({ appointment: a, role, nextStatuses, canReschedule }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [mode, setMode] = useState<"none" | "cancel" | "reschedule">("none");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(a.date);
  const [slot, setSlot] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  async function run(label: string, url: string, body: unknown, success: string, after?: (data: { id: string }) => void) {
    setBusy(label);
    setMsg(null);
    try {
      const data = await apiFetch<{ id: string }>(url, { method: "POST", body });
      setMsg({ tone: "success", text: success });
      setMode("none");
      if (after) after(data);
      else router.refresh();
    } catch (e) {
      const text = e instanceof ApiError ? e.message : "Request failed";
      setMsg({ tone: "error", text });
      if (e instanceof ApiError && e.code === "SLOT_UNAVAILABLE") setRefreshKey((k) => k + 1);
    } finally {
      setBusy(null);
    }
  }

  const status = (s: string, label: string) =>
    run(s, `/api/appointments/${a.id}/status`, { status: s, version: a.version }, `${label} recorded.`);

  const nothing = nextStatuses.length === 0 && !canReschedule && !(role === "CLINICIAN" && a.status === "CHECKED_IN") && !(["ADMIN", "FRONT_DESK"].includes(role) && a.status === "COMPLETED" && !a.hasInvoice);

  return (
    <div className="space-y-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {nothing && <p className="text-sm text-slate-600">No further actions are available for this appointment.</p>}
      <div className="flex flex-wrap gap-2">
        {nextStatuses.includes("CHECKED_IN") && <Button loading={busy === "CHECKED_IN"} onClick={() => status("CHECKED_IN", "Check-in")}>Check in</Button>}
        {role === "CLINICIAN" && a.status === "CHECKED_IN" && !a.hasEncounter && (
          <Button loading={busy === "visit"} onClick={() => run("visit", "/api/visits", { appointmentId: a.id }, "Visit started.", (v) => router.push(`/visits/${v.id}`))}>Start visit</Button>
        )}
        {nextStatuses.includes("COMPLETED") && !(role === "CLINICIAN" && !a.hasEncounter) && <Button variant="secondary" loading={busy === "COMPLETED"} onClick={() => status("COMPLETED", "Completion")}>Mark completed</Button>}
        {["ADMIN", "FRONT_DESK"].includes(role) && a.status === "COMPLETED" && !a.hasInvoice && (
          <Button loading={busy === "invoice"} onClick={() => run("invoice", "/api/invoices", { appointmentId: a.id }, "Draft invoice created.", (inv) => router.push(`/billing/${inv.id}`))}>Create invoice</Button>
        )}
        {canReschedule && <Button variant="secondary" onClick={() => setMode(mode === "reschedule" ? "none" : "reschedule")} aria-expanded={mode === "reschedule"}>Reschedule</Button>}
        {nextStatuses.includes("NO_SHOW") && <Button variant="secondary" loading={busy === "NO_SHOW"} onClick={() => status("NO_SHOW", "No-show")}>Mark no-show</Button>}
        {nextStatuses.includes("CANCELLED") && <Button variant="danger" onClick={() => setMode(mode === "cancel" ? "none" : "cancel")} aria-expanded={mode === "cancel"}>Cancel appointment</Button>}
      </div>

      {mode === "cancel" && (
        <div className="space-y-3 rounded-md bg-rose-50/50 p-4 ring-1 ring-rose-100">
          <Field label="Reason for cancellation" name="cancelReason" required>
            <Textarea name="cancelReason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button variant="danger" loading={busy === "cancel"} disabled={reason.trim().length < 3} onClick={() => run("cancel", `/api/appointments/${a.id}/cancel`, { reason, version: a.version }, "Appointment cancelled.")}>Confirm cancellation</Button>
        </div>
      )}

      {mode === "reschedule" && (
        <div className="space-y-3 rounded-md bg-slate-50 p-4 ring-1 ring-slate-200">
          <Field label="New date" name="newDate">
            <Input name="newDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-[200px]" />
          </Field>
          <SlotPicker doctorId={a.doctorId} date={date} value={slot} onChange={setSlot} refreshKey={refreshKey} />
          <Button loading={busy === "reschedule"} disabled={!slot} onClick={() => run("reschedule", `/api/appointments/${a.id}/reschedule`, { startTime: slot, version: a.version }, "Appointment rescheduled.")}>Confirm new time</Button>
        </div>
      )}
    </div>
  );
}
