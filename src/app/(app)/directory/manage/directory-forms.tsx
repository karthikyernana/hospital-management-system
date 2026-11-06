"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { apiFetch, ApiError, fieldError } from "@/lib/api-client";
import { STAFF_ROLES } from "@/lib/validation/directory";
import { titleCase } from "@/lib/format";

type Dept = { id: string; name: string };

function useSubmit(url: string, toBody: (fd: FormData) => unknown) {
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch(url, { method: "POST", body: toBody(new FormData(form)) });
      form.reset();
      setOk("Saved.");
      router.refresh();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }
  return { onSubmit, error, ok, loading };
}

function Status({ error, ok }: { error: unknown; ok: string | null }): ReactNode {
  if (ok) return <Alert tone="success">{ok}</Alert>;
  if (error) return <Alert>{error instanceof ApiError ? error.message : "Request failed"}</Alert>;
  return null;
}

export function DirectoryForms({ departments }: { departments: Dept[] }) {
  const dept = useSubmit("/api/departments", (fd) => Object.fromEntries(fd));
  const staff = useSubmit("/api/staff", (fd) => Object.fromEntries(fd));
  const doctor = useSubmit("/api/doctors", (fd) => {
    const o = Object.fromEntries(fd) as Record<string, string>;
    return {
      ...o,
      slotMinutes: Number(o.slotMinutes),
      consultationFeeCents: Math.round(Number(o.feeRupees) * 100),
      createLogin: o.createLogin === "on",
      initialPassword: o.initialPassword || undefined,
    };
  });

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="New doctor" className="xl:row-span-2">
        <form onSubmit={doctor.onSubmit} className="space-y-3" noValidate>
          <Status error={doctor.error} ok={doctor.ok} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" name="d-firstName" required error={fieldError(doctor.error, "firstName")}><Input id="d-firstName" name="firstName" required /></Field>
            <Field label="Last name" name="d-lastName" required error={fieldError(doctor.error, "lastName")}><Input id="d-lastName" name="lastName" required /></Field>
            <Field label="Department" name="d-departmentId" required error={fieldError(doctor.error, "departmentId")}>
              <Select id="d-departmentId" name="departmentId" required>
                <option value="">Choose…</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Specialty" name="d-specialty" required error={fieldError(doctor.error, "specialty")}><Input id="d-specialty" name="specialty" required /></Field>
            <Field label="License no." name="d-licenseNo" required error={fieldError(doctor.error, "licenseNo")}><Input id="d-licenseNo" name="licenseNo" required /></Field>
            <Field label="Email" name="d-email" required error={fieldError(doctor.error, "email")}><Input id="d-email" name="email" type="email" required /></Field>
            <Field label="Phone" name="d-phone" required error={fieldError(doctor.error, "phone")}><Input id="d-phone" name="phone" type="tel" required /></Field>
            <Field label="Slot length (min)" name="d-slotMinutes" required><Input id="d-slotMinutes" name="slotMinutes" type="number" min={5} max={240} defaultValue={30} /></Field>
            <Field label="Consultation fee (₹)" name="d-feeRupees" required error={fieldError(doctor.error, "consultationFeeCents")}><Input id="d-feeRupees" name="feeRupees" type="number" min={0} step="1" defaultValue={500} /></Field>
            <Field label="Initial password (if creating login)" name="d-initialPassword" error={fieldError(doctor.error, "initialPassword")}><Input id="d-initialPassword" name="initialPassword" type="password" autoComplete="new-password" /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="createLogin" className="h-4 w-4" /> Create a clinician login</label>
          <p className="text-xs text-slate-500">Set working hours on the doctor&apos;s page after saving.</p>
          <Button type="submit" loading={doctor.loading}>Add doctor</Button>
        </form>
      </Card>
      <Card title="New department">
        <form onSubmit={dept.onSubmit} className="space-y-3" noValidate>
          <Status error={dept.error} ok={dept.ok} />
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <Field label="Code" name="dep-code" required error={fieldError(dept.error, "code")}><Input id="dep-code" name="code" placeholder="NEU" required /></Field>
            <Field label="Name" name="dep-name" required error={fieldError(dept.error, "name")}><Input id="dep-name" name="name" required /></Field>
          </div>
          <Field label="Description" name="dep-description"><Input id="dep-description" name="description" /></Field>
          <Button type="submit" loading={dept.loading}>Add department</Button>
        </form>
      </Card>
      <Card title="New staff member">
        <form onSubmit={staff.onSubmit} className="space-y-3" noValidate>
          <Status error={staff.error} ok={staff.ok} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" name="s-firstName" required error={fieldError(staff.error, "firstName")}><Input id="s-firstName" name="firstName" required /></Field>
            <Field label="Last name" name="s-lastName" required error={fieldError(staff.error, "lastName")}><Input id="s-lastName" name="lastName" required /></Field>
            <Field label="Role" name="s-staffRole" required>
              <Select id="s-staffRole" name="staffRole">{STAFF_ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</Select>
            </Field>
            <Field label="Department" name="s-departmentId">
              <Select id="s-departmentId" name="departmentId"><option value="">None</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
            </Field>
            <Field label="Email" name="s-email" required error={fieldError(staff.error, "email")}><Input id="s-email" name="email" type="email" required /></Field>
            <Field label="Phone" name="s-phone" required error={fieldError(staff.error, "phone")}><Input id="s-phone" name="phone" type="tel" required /></Field>
          </div>
          <Button type="submit" loading={staff.loading}>Add staff member</Button>
        </form>
      </Card>
    </div>
  );
}
