/**
 * Minimal fixture graph used by integration tests:
 * one department, one doctor (with a Mon–Sat 09:00–13:00 schedule, 30-min slots),
 * a second doctor, two patients and a user for every role.
 */
import { prisma } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";
import { createUser, resetDb } from "./helpers";

export async function seedFixtures() {
  await resetDb();
  const dept = await prisma.department.create({ data: { code: "GEN", name: "General Medicine" } });
  const admin = await createUser("ADMIN", "admin@test.local");
  const desk = await createUser("FRONT_DESK", "desk@test.local");
  const clinUser = await createUser("CLINICIAN", "doc@test.local");
  const otherClinUser = await createUser("CLINICIAN", "doc2@test.local");
  const patientUser = await createUser("PATIENT", "pat@test.local");

  const allDays = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startMinute: 9 * 60, endMinute: 13 * 60 }));
  const doctor = await prisma.doctor.create({
    data: {
      userId: clinUser.id, departmentId: dept.id, firstName: "Asha", lastName: "Test", specialty: "GP",
      licenseNo: "LIC-1", email: "doc@test.local", phone: "+91 90000 00001", slotMinutes: 30, consultationFeeCents: 50000,
      schedules: { create: allDays },
    },
  });
  const doctor2 = await prisma.doctor.create({
    data: {
      userId: otherClinUser.id, departmentId: dept.id, firstName: "Bala", lastName: "Other", specialty: "GP",
      licenseNo: "LIC-2", email: "doc2@test.local", phone: "+91 90000 00002", slotMinutes: 30, consultationFeeCents: 40000,
      schedules: { create: allDays },
    },
  });
  const patient = await prisma.patient.create({
    data: { mrn: "MRN-100001", userId: patientUser.id, firstName: "Ravi", lastName: "Kumar", dateOfBirth: new Date("1990-05-01"), gender: "MALE", phone: "+91 99999 00001" },
  });
  const patient2 = await prisma.patient.create({
    data: { mrn: "MRN-100002", firstName: "Sita", lastName: "Devi", dateOfBirth: new Date("1985-02-11"), gender: "FEMALE", phone: "+91 99999 00002" },
  });

  const users = {
    admin,
    desk,
    clinician: { ...clinUser, doctorId: doctor.id } as SessionUser,
    otherClinician: { ...otherClinUser, doctorId: doctor2.id } as SessionUser,
    patient: { ...patientUser, patientId: patient.id } as SessionUser,
  };
  return { dept, doctor, doctor2, patient, patient2, users };
}
export type Fixtures = Awaited<ReturnType<typeof seedFixtures>>;
