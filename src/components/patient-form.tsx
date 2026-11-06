"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { apiFetch, ApiError, fieldError } from "@/lib/api-client";
import { BLOOD_GROUPS, GENDERS } from "@/lib/validation/patient";
import { titleCase } from "@/lib/format";

export interface PatientFormValues {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  bloodGroup: string;
  emergencyContact: string;
  allergies: string;
}

const EMPTY: PatientFormValues = {
  firstName: "", lastName: "", dateOfBirth: "", gender: "UNDISCLOSED", phone: "", email: "",
  address: "", bloodGroup: "", emergencyContact: "", allergies: "",
};

export function PatientForm({ patientId, initial }: { patientId?: string; initial?: Partial<PatientFormValues> }) {
  const router = useRouter();
  const [values, setValues] = useState<PatientFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof PatientFormValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const err = (k: string) => fieldError(error, k);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await apiFetch<{ id: string }>(patientId ? `/api/patients/${patientId}` : "/api/patients", {
        method: patientId ? "PATCH" : "POST",
        body: values,
      });
      router.push(`/patients/${saved.id}?saved=1`);
      router.refresh();
    } catch (e) {
      setError(e);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error ? (
        <Alert>{error instanceof ApiError ? error.message : "Could not save. Check your connection and try again."}</Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" required error={err("firstName")}>
          <Input name="firstName" value={values.firstName} onChange={set("firstName")} error={err("firstName")} required autoComplete="off" />
        </Field>
        <Field label="Last name" name="lastName" required error={err("lastName")}>
          <Input name="lastName" value={values.lastName} onChange={set("lastName")} error={err("lastName")} required autoComplete="off" />
        </Field>
        <Field label="Date of birth" name="dateOfBirth" required error={err("dateOfBirth")}>
          <Input name="dateOfBirth" type="date" value={values.dateOfBirth} onChange={set("dateOfBirth")} error={err("dateOfBirth")} required />
        </Field>
        <Field label="Gender" name="gender" required error={err("gender")}>
          <Select name="gender" value={values.gender} onChange={set("gender")} error={err("gender")}>
            {GENDERS.map((g) => <option key={g} value={g}>{titleCase(g)}</option>)}
          </Select>
        </Field>
        <Field label="Phone" name="phone" required error={err("phone")} hint="e.g. +91 98765 43210">
          <Input name="phone" type="tel" value={values.phone} onChange={set("phone")} error={err("phone")} required />
        </Field>
        <Field label="Email" name="email" error={err("email")}>
          <Input name="email" type="email" value={values.email} onChange={set("email")} error={err("email")} />
        </Field>
        <Field label="Blood group" name="bloodGroup" error={err("bloodGroup")}>
          <Select name="bloodGroup" value={values.bloodGroup} onChange={set("bloodGroup")}>
            <option value="">Unknown</option>
            {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="Emergency contact" name="emergencyContact" error={err("emergencyContact")}>
          <Input name="emergencyContact" value={values.emergencyContact} onChange={set("emergencyContact")} />
        </Field>
      </div>
      <Field label="Address" name="address" error={err("address")}>
        <Textarea name="address" value={values.address} onChange={set("address")} rows={2} />
      </Field>
      <Field label="Known allergies" name="allergies" error={err("allergies")}>
        <Input name="allergies" value={values.allergies} onChange={set("allergies")} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>{patientId ? "Save changes" : "Register patient"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
