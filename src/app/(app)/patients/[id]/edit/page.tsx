import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/current-user";
import { getPatient } from "@/server/services/patients";
import { AppError } from "@/server/http/errors";
import { Card, PageHeader } from "@/components/ui";
import { PatientForm } from "@/components/patient-form";
import { dateInputValue } from "@/lib/format";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("patient:write");
  const { id } = await params;
  const p = await getPatient(user, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  return (
    <>
      <PageHeader title={`Edit ${p.firstName} ${p.lastName}`} description={p.mrn} />
      <Card className="max-w-3xl">
        <PatientForm
          patientId={p.id}
          initial={{
            firstName: p.firstName, lastName: p.lastName, dateOfBirth: dateInputValue(p.dateOfBirth), gender: p.gender,
            phone: p.phone, email: p.email ?? "", address: p.address ?? "", bloodGroup: p.bloodGroup ?? "",
            emergencyContact: p.emergencyContact ?? "", allergies: p.allergies ?? "",
          }}
        />
      </Card>
    </>
  );
}
