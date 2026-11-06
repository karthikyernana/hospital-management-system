import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/current-user";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/ui";
import { BookingForm } from "./booking-form";
import { toLocalDateString } from "@/lib/time";

export const metadata: Metadata = { title: "Book appointment" };

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ patientId?: string; doctorId?: string }> }) {
  const user = await requirePermission("appointment:write");
  const sp = await searchParams;

  // Clinicians book follow-ups in their own diary; everyone else picks any active doctor.
  const doctors = await prisma.doctor.findMany({
    where: { isActive: true, ...(user.role === "CLINICIAN" ? { id: user.doctorId ?? "__none__" } : {}) },
    select: { id: true, firstName: true, lastName: true, specialty: true, slotMinutes: true, department: { select: { name: true } } },
    orderBy: [{ department: { name: "asc" } }, { lastName: "asc" }],
  });

  // Patients always book for themselves; staff may arrive with a pre-selected patient.
  const fixedPatientId = user.role === "PATIENT" ? user.patientId : sp.patientId;
  const patient = fixedPatientId
    ? await prisma.patient.findUnique({ where: { id: fixedPatientId }, select: { id: true, mrn: true, firstName: true, lastName: true } })
    : null;

  return (
    <>
      <PageHeader title="Book appointment" description="Pick a doctor, a day and an open slot. Times are shown in IST." />
      <BookingForm
        doctors={doctors.map((d) => ({ id: d.id, label: `Dr. ${d.firstName} ${d.lastName} — ${d.specialty} (${d.department.name})` }))}
        initialDoctorId={sp.doctorId ?? (doctors.length === 1 ? doctors[0].id : "")}
        initialPatient={patient}
        patientLocked={user.role === "PATIENT"}
        today={toLocalDateString(new Date())}
        afterBookHref={user.role === "PATIENT" ? "/portal" : null}
      />
    </>
  );
}
