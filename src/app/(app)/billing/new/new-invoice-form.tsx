"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field } from "@/components/ui";
import { PatientPicker, type PickedPatient } from "@/components/patient-picker";
import { apiFetch, ApiError } from "@/lib/api-client";

export function NewInvoiceForm() {
  const router = useRouter();
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function create() {
    if (!patient) return;
    setLoading(true);
    setError(null);
    try {
      const inv = await apiFetch<{ id: string }>("/api/invoices", { method: "POST", body: { patientId: patient.id } });
      router.push(`/billing/${inv.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create invoice");
      setLoading(false);
    }
  }
  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Field label="Patient" name="patientSearch" required><PatientPicker value={patient} onChange={setPatient} /></Field>
      <Button onClick={create} disabled={!patient} loading={loading}>Create draft invoice</Button>
    </div>
  );
}
