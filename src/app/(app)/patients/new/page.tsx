import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/current-user";
import { Card, PageHeader } from "@/components/ui";
import { PatientForm } from "@/components/patient-form";

export const metadata: Metadata = { title: "Register patient" };

export default async function NewPatientPage() {
  await requirePermission("patient:write");
  return (
    <>
      <PageHeader title="Register patient" description="Use synthetic data only. An MRN is assigned automatically." />
      <Card className="max-w-3xl"><PatientForm /></Card>
    </>
  );
}
