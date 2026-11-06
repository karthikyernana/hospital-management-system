/**
 * Repeatable seed: wipes all tables and inserts deterministic SYNTHETIC data.
 * No real patient information is used anywhere. Appointments are generated
 * relative to "today" so the demo always has past history and open slots.
 *
 *   npm run db:seed
 */
import { PrismaClient, Role, Gender, StaffRole, LineCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addMinutes, localMidnightUtc, toLocalDateString, addDays, localDayOfWeek } from "../src/lib/time";
import { computeLine, computeTotals } from "../src/lib/money";

const prisma = new PrismaClient();
export const DEMO_PASSWORD = "Demo@12345";

// Small deterministic PRNG (mulberry32) so every seed run produces the same data.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(42);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

const FIRST = ["Aarav", "Diya", "Vihaan", "Ananya", "Arjun", "Isha", "Kabir", "Meera", "Rohan", "Saanvi", "Aditya", "Kavya", "Dev", "Nisha", "Rahul", "Pooja", "Siddharth", "Tara", "Yash", "Zara"];
const LAST = ["Sharma", "Reddy", "Nair", "Iyer", "Gupta", "Patel", "Das", "Khan", "Singh", "Menon", "Rao", "Joshi", "Bose", "Kulkarni", "Verma"];
const CITIES = ["Phagwara", "Jalandhar", "Ludhiana", "Amritsar", "Chandigarh"];
const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

async function wipe() {
  // TRUNCATE is statement-level, so the append-only trigger on AuditLog does not block it.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    "AuditLog","Payment","InvoiceLineItem","Invoice","DiagnosticReport","Prescription","ClinicalNote",
    "Encounter","Appointment","DoctorSchedule","Patient","StaffMember","Doctor","Department","User"
    RESTART IDENTITY CASCADE`);
}

async function main() {
  await wipe();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // --- Departments -------------------------------------------------------
  const deptData = [
    { code: "GEN", name: "General Medicine", description: "Primary care and internal medicine" },
    { code: "CAR", name: "Cardiology", description: "Heart and vascular care" },
    { code: "PED", name: "Pediatrics", description: "Care for infants, children and adolescents" },
    { code: "ORT", name: "Orthopedics", description: "Bones, joints and sports injuries" },
    { code: "DER", name: "Dermatology", description: "Skin, hair and nail conditions" },
  ];
  const depts = Object.fromEntries(
    await Promise.all(deptData.map(async (d) => [d.code, await prisma.department.create({ data: d })] as const)),
  );

  // --- Doctors (each has a CLINICIAN login) -------------------------------
  const doctorData = [
    { first: "Anika", last: "Mehta", dept: "CAR", specialty: "Interventional Cardiology", fee: 80000, slot: 30, sat: true },
    { first: "Ravi", last: "Iyer", dept: "GEN", specialty: "Internal Medicine", fee: 50000, slot: 20, sat: true },
    { first: "Farah", last: "Khan", dept: "PED", specialty: "General Pediatrics", fee: 60000, slot: 30, sat: false },
    { first: "Vikram", last: "Singh", dept: "ORT", specialty: "Sports Medicine", fee: 70000, slot: 30, sat: true },
    { first: "Lakshmi", last: "Nair", dept: "DER", specialty: "Clinical Dermatology", fee: 55000, slot: 20, sat: false },
    { first: "Sameer", last: "Joshi", dept: "GEN", specialty: "Family Medicine", fee: 45000, slot: 15, sat: false },
    { first: "Neha", last: "Kulkarni", dept: "CAR", specialty: "Cardiac Electrophysiology", fee: 90000, slot: 30, sat: false },
    { first: "Arun", last: "Bose", dept: "ORT", specialty: "Joint Replacement", fee: 75000, slot: 30, sat: true },
  ];
  const doctors = [];
  for (const [i, d] of doctorData.entries()) {
    const email = `dr.${d.last.toLowerCase()}@hms.test`;
    const user = await prisma.user.create({
      data: { email, passwordHash, name: `Dr. ${d.first} ${d.last}`, role: Role.CLINICIAN },
    });
    const doctor = await prisma.doctor.create({
      data: {
        userId: user.id,
        departmentId: depts[d.dept].id,
        firstName: d.first,
        lastName: d.last,
        specialty: d.specialty,
        licenseNo: `MCI-${(100231 + i * 17).toString()}`,
        email,
        phone: `+91 90000 ${String(10000 + i * 111).padStart(5, "0")}`,
        slotMinutes: d.slot,
        consultationFeeCents: d.fee,
        schedules: {
          create: [
            ...[1, 2, 3, 4, 5].flatMap((dow) => [
              { dayOfWeek: dow, startMinute: 9 * 60, endMinute: 13 * 60 },
              { dayOfWeek: dow, startMinute: 14 * 60, endMinute: 17 * 60 },
            ]),
            ...(d.sat ? [{ dayOfWeek: 6, startMinute: 9 * 60, endMinute: 13 * 60 }] : []),
          ],
        },
      },
    });
    doctors.push(doctor);
  }

  // --- Staff & admin -----------------------------------------------------
  const staffData = [
    { first: "Priya", last: "Sharma", role: StaffRole.RECEPTIONIST, dept: null, login: { email: "frontdesk@hms.test", role: Role.FRONT_DESK } },
    { first: "Imran", last: "Ali", role: StaffRole.ADMINISTRATOR, dept: null, login: { email: "admin@hms.test", role: Role.ADMIN } },
    { first: "Sunita", last: "Das", role: StaffRole.RECEPTIONIST, dept: null, login: { email: "frontdesk2@hms.test", role: Role.FRONT_DESK } },
    { first: "George", last: "Thomas", role: StaffRole.NURSE, dept: "CAR", login: null },
    { first: "Rekha", last: "Menon", role: StaffRole.NURSE, dept: "PED", login: null },
    { first: "Harish", last: "Verma", role: StaffRole.LAB_TECHNICIAN, dept: "GEN", login: null },
    { first: "Anjali", last: "Rao", role: StaffRole.PHARMACIST, dept: null, login: null },
  ];
  for (const [i, s] of staffData.entries()) {
    const user = s.login
      ? await prisma.user.create({
          data: { email: s.login.email, passwordHash, name: `${s.first} ${s.last}`, role: s.login.role },
        })
      : null;
    await prisma.staffMember.create({
      data: {
        userId: user?.id,
        departmentId: s.dept ? depts[s.dept].id : null,
        firstName: s.first,
        lastName: s.last,
        staffRole: s.role,
        email: s.login?.email ?? `${s.first.toLowerCase()}.${s.last.toLowerCase()}@hms.test`,
        phone: `+91 98000 ${String(20000 + i * 137).padStart(5, "0")}`,
      },
    });
  }

  // --- Patients (synthetic) ----------------------------------------------
  const patients = [];
  for (let i = 0; i < 40; i++) {
    const firstName = FIRST[i % FIRST.length];
    const lastName = LAST[(i * 7) % LAST.length];
    const year = 1950 + Math.floor(rand() * 70);
    const dob = new Date(Date.UTC(year, Math.floor(rand() * 12), 1 + Math.floor(rand() * 27)));
    const isPortalUser = i === 0;
    const user = isPortalUser
      ? await prisma.user.create({
          data: { email: "patient@hms.test", passwordHash, name: `${firstName} ${lastName}`, role: Role.PATIENT },
        })
      : null;
    patients.push(
      await prisma.patient.create({
        data: {
          mrn: `MRN-${String(100001 + i)}`,
          userId: user?.id,
          firstName,
          lastName,
          dateOfBirth: dob,
          gender: i % 2 === 0 ? Gender.MALE : Gender.FEMALE,
          phone: `+91 99${String(10000000 + i * 7919).slice(0, 8)}`,
          email: isPortalUser ? "patient@hms.test" : `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.test`,
          address: `${10 + i}, Synthetic Street, ${pick(CITIES)}, Punjab`,
          bloodGroup: pick(BLOOD),
          emergencyContact: `${pick(FIRST)} ${lastName} (+91 98${String(76543210 - i * 101).slice(0, 8)})`,
          allergies: i % 5 === 0 ? "Penicillin" : null,
        },
      }),
    );
  }

  // --- Appointments, encounters & invoices --------------------------------
  const today = toLocalDateString(new Date());
  const now = new Date();
  const busy = new Set<string>(); // patientId|date: at most one seeded visit per patient per day
  let invoiceSeq = 1;
  const medications = [
    ["Paracetamol", "500 mg", "Twice daily", 5],
    ["Amoxicillin", "250 mg", "Three times daily", 7],
    ["Cetirizine", "10 mg", "Once daily at night", 10],
    ["Atorvastatin", "10 mg", "Once daily", 30],
    ["Ibuprofen", "400 mg", "After meals, twice daily", 5],
  ] as const;
  const tests = ["Complete Blood Count", "Lipid Profile", "ECG", "X-Ray Knee (AP/Lat)", "HbA1c"];

  for (let offset = -14; offset <= 6; offset++) {
    const date = addDays(today, offset);
    const midnight = localMidnightUtc(date);
    const dow = localDayOfWeek(addMinutes(midnight, 12 * 60));
    for (const doctor of doctors) {
      const windows = await prisma.doctorSchedule.findMany({ where: { doctorId: doctor.id, dayOfWeek: dow } });
      for (const w of windows) {
        for (let m = w.startMinute; m + doctor.slotMinutes <= w.endMinute; m += doctor.slotMinutes) {
          // Fill ~22% of slots so plenty remain bookable in the demo.
          if (rand() > 0.22) continue;
          const start = addMinutes(midnight, m);
          const patient = pick(patients);
          const key = `${patient.id}|${date}`;
          if (busy.has(key)) continue;
          busy.add(key);
          const isPast = start < now;
          const status = isPast ? (rand() < 0.85 ? "COMPLETED" : rand() < 0.5 ? "CANCELLED" : "NO_SHOW") : "SCHEDULED";
          const appt = await prisma.appointment.create({
            data: {
              patientId: patient.id,
              doctorId: doctor.id,
              startTime: start,
              endTime: addMinutes(start, doctor.slotMinutes),
              status,
              reason: pick(["Follow-up", "Fever and cough", "Routine check-up", "Joint pain", "Skin rash", "Chest discomfort", "Vaccination"]),
              cancelReason: status === "CANCELLED" ? "Patient requested" : null,
            },
          });
          if (status !== "COMPLETED") continue;

          const [med, dose, freq, days] = pick(medications);
          const encounter = await prisma.encounter.create({
            data: {
              appointmentId: appt.id,
              patientId: patient.id,
              doctorId: doctor.id,
              status: "FINALIZED",
              chiefComplaint: appt.reason,
              startedAt: start,
              finalizedAt: addMinutes(start, doctor.slotMinutes),
              notes: { create: [{ authorId: doctor.userId!, body: "Synthetic note: vitals stable, patient counselled. Review as advised." }] },
              prescriptions: { create: [{ medication: med, dosage: dose, frequency: freq, durationDays: days, instructions: "Synthetic prescription" }] },
              diagnosticReports:
                rand() < 0.5
                  ? { create: [{ testName: pick(tests), status: "RESULTED", resultSummary: "Within reference range (synthetic).", fileName: "report.pdf", resultedAt: addMinutes(start, 120) }] }
                  : undefined,
            },
          });

          const lines = [
            { category: LineCategory.CONSULTATION, description: `Consultation — Dr. ${doctor.firstName} ${doctor.lastName}`, quantity: 1, unitPriceCents: doctor.consultationFeeCents, taxRateBps: 0 },
            ...(rand() < 0.6 ? [{ category: LineCategory.PHARMACY, description: `${med} ${dose}`, quantity: Math.ceil(days / 2), unitPriceCents: 2500, taxRateBps: 1200 }] : []),
            ...(rand() < 0.4 ? [{ category: LineCategory.LAB, description: pick(tests), quantity: 1, unitPriceCents: 45000, taxRateBps: 0 }] : []),
          ];
          const totals = computeTotals(lines, 0);
          const paid = rand() < 0.7;
          const invoice = await prisma.invoice.create({
            data: {
              number: `INV-${date.slice(0, 4)}-${String(invoiceSeq++).padStart(6, "0")}`,
              patientId: patient.id,
              appointmentId: appt.id,
              encounterId: encounter.id,
              status: paid ? "PAID" : "ISSUED",
              ...totals,
              amountPaidCents: paid ? totals.totalCents : 0,
              issuedAt: addMinutes(start, doctor.slotMinutes),
              paidAt: paid ? addMinutes(start, doctor.slotMinutes + 10) : null,
              lineItems: { create: lines.map((l) => ({ ...l, ...computeLine(l) })) },
            },
          });
          if (paid) {
            await prisma.payment.create({
              data: {
                invoiceId: invoice.id,
                amountCents: totals.totalCents,
                method: pick(["CARD", "UPI", "CASH"] as const),
                status: "SUCCEEDED",
                providerRef: `sandbox_${invoice.id}`,
                idempotencyKey: `seed-${invoice.id}`,
              },
            });
          }
        }
      }
    }
  }

  const counts = {
    users: await prisma.user.count(),
    doctors: await prisma.doctor.count(),
    patients: await prisma.patient.count(),
    appointments: await prisma.appointment.count(),
    encounters: await prisma.encounter.count(),
    invoices: await prisma.invoice.count(),
  };
  console.log("Seed complete:", counts);
  console.log(`Demo password for every account: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
