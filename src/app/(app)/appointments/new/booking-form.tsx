"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SlotPicker } from "@/components/slot-picker";
import { PatientPicker, type PickedPatient } from "@/components/patient-picker";
import { apiFetch, ApiError, fieldError } from "@/lib/api-client";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function BookingForm(props: {
  doctors: { id: string; label: string }[];
  initialDoctorId: string;
  initialPatient: PickedPatient | null;
  patientLocked: boolean;
  today: string;
  afterBookHref: string | null;
}) {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState(props.initialDoctorId);
  const [date, setDate] = useState(props.today);
  const [slot, setSlot] = useState<string | null>(null);
  const [patient, setPatient] = useState<PickedPatient | null>(props.initialPatient);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // One idempotency key per booking attempt: double-clicks and network retries
  // reuse it, so the server can never create two appointments for one intent.
  const [idemKey, setIdemKey] = useState(newKey);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!patient || !slot) {
      setError(new ApiError("VALIDATION_ERROR", !patient ? "Choose a patient" : "Choose a time slot", 422));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const appt = await apiFetch<{ id: string }>("/api/appointments", {
        method: "POST",
        idempotencyKey: idemKey,
        body: { patientId: patient.id, doctorId, startTime: slot, reason },
      });
      setIdemKey(newKey());
      router.push(props.afterBookHref ? `${props.afterBookHref}?booked=1` : `/appointments/${appt.id}?booked=1`);
      router.refresh();
    } catch (err) {
      setError(err);
      setSubmitting(false);
      if (err instanceof ApiError && err.status === 409) {
        // Our availability view was stale (someone else took the slot): reload it.
        setIdemKey(newKey());
        setRefreshKey((k) => k + 1);
      }
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title="1. Doctor and date">
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <Field label="Doctor" name="doctorId" required error={fieldError(error, "doctorId")}>
              <Select name="doctorId" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
                <option value="">Choose a doctor…</option>
                {props.doctors.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </Select>
            </Field>
            <Field label="Date" name="date" required>
              <Input name="date" type="date" min={props.today} value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
          </div>
        </Card>
        <Card title="2. Time slot">
          <SlotPicker doctorId={doctorId} date={date} value={slot} onChange={setSlot} refreshKey={refreshKey} />
        </Card>
      </div>
      <div className="space-y-6">
        <Card title="3. Patient and reason">
          <div className="space-y-4">
            <Field label="Patient" name="patientSearch" required error={fieldError(error, "patientId")}>
              {props.patientLocked && patient ? (
                <p className="rounded-md bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">{patient.firstName} {patient.lastName} ({patient.mrn})</p>
              ) : (
                <PatientPicker value={patient} onChange={setPatient} />
              )}
            </Field>
            <Field label="Reason for visit" name="reason" error={fieldError(error, "reason")}>
              <Textarea name="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
            </Field>
            {error ? <Alert title={error instanceof ApiError && error.status === 409 ? "Slot no longer available" : undefined}>{error instanceof ApiError ? error.message : "Could not book. Please retry."}{error instanceof ApiError && error.status === 409 ? " Availability has been refreshed — pick another slot." : ""}</Alert> : null}
            <Button type="submit" className="w-full" loading={submitting} disabled={!slot || !patient}>
              {submitting ? "Booking…" : "Confirm booking"}
            </Button>
          </div>
        </Card>
      </div>
    </form>
  );
}
