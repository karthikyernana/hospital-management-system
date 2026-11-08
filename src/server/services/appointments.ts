/**
 * Appointment scheduling — the core business workflow.
 *
 * Double-booking is prevented in three layers:
 *  1. Validation: the start must be a future slot boundary inside the doctor's
 *     working hours, and the slot must look free when we check.
 *  2. Database: an EXCLUDE constraint rejects any overlapping *active*
 *     appointment for the same doctor (or patient), atomically, even when two
 *     requests pass step 1 at the same time (stale availability / races).
 *  3. Idempotency: a client-supplied Idempotency-Key makes retries and
 *     double-clicks return the original appointment instead of a duplicate.
 *
 * State changes use optimistic locking (`version`) so a user acting on a
 * stale screen gets a clear 409 instead of overwriting someone else's change.
 */
import { Prisma, type AppointmentStatus } from "@prisma/client";
import { prisma } from "../db";
import { assertCan } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import { AppError, forbidden, notFound, slotUnavailable, staleVersion, validationError } from "../http/errors";
import { audit } from "./audit";
import { generateSlots, isValidSlotStart } from "../domain/slots";
import { ACTIVE_STATUSES, assertTransition, TRANSITION_ROLES } from "../domain/appointment-state";
import { addMinutes, localMidnightUtc, addDays } from "@/lib/time";
import type { AppointmentListQuery, BookAppointmentInput } from "@/lib/validation/appointment";
import type { Paginated } from "@/lib/validation/common";

export const appointmentInclude = {
  patient: { select: { id: true, mrn: true, firstName: true, lastName: true, phone: true } },
  doctor: { select: { id: true, firstName: true, lastName: true, specialty: true, slotMinutes: true, consultationFeeCents: true, department: { select: { name: true } } } },
  encounter: { select: { id: true, status: true } },
  invoice: { select: { id: true, number: true, status: true } },
} satisfies Prisma.AppointmentInclude;
export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

/** Record-level scope: clinicians see their own list, patients only themselves. */
function scopeWhere(actor: SessionUser): Prisma.AppointmentWhereInput {
  if (actor.role === "PATIENT") return { patientId: actor.patientId ?? "__none__" };
  if (actor.role === "CLINICIAN") return { doctorId: actor.doctorId ?? "__none__" };
  return {};
}

function assertInScope(actor: SessionUser, appt: { patientId: string; doctorId: string }) {
  if (actor.role === "PATIENT" && appt.patientId !== actor.patientId) throw forbidden("Patients can only access their own appointments");
  if (actor.role === "CLINICIAN" && appt.doctorId !== actor.doctorId) throw forbidden("Clinicians can only manage their own appointments");
}

// --------------------------------------------------------------------------
// Availability
// --------------------------------------------------------------------------

export async function getAvailability(actor: SessionUser, doctorId: string, date: string, now = new Date()) {
  assertCan(actor.role, "appointment:read");
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId }, include: { schedules: true } });
  if (!doctor || !doctor.isActive) throw notFound("Doctor");

  const dayStart = localMidnightUtc(date);
  const dayEnd = localMidnightUtc(addDays(date, 1));
  const taken = await prisma.appointment.findMany({
    where: { doctorId, status: { in: ACTIVE_STATUSES }, startTime: { lt: dayEnd }, endTime: { gt: dayStart } },
    select: { startTime: true, endTime: true },
  });
  const slots = generateSlots(date, doctor.schedules, doctor.slotMinutes).map((s) => {
    const booked = taken.some((t) => t.startTime < s.end && s.start < t.endTime);
    return { start: s.start.toISOString(), end: s.end.toISOString(), available: !booked && s.start > now, booked };
  });
  return { doctorId, date, slotMinutes: doctor.slotMinutes, slots };
}

// --------------------------------------------------------------------------
// Queries
// --------------------------------------------------------------------------

export async function listAppointments(actor: SessionUser, q: AppointmentListQuery, now = new Date()): Promise<Paginated<AppointmentWithRelations>> {
  assertCan(actor.role, "appointment:read");
  const where: Prisma.AppointmentWhereInput = {
    ...scopeWhere(actor),
    ...(q.doctorId && actor.role !== "CLINICIAN" ? { doctorId: q.doctorId } : {}),
    ...(q.patientId && actor.role !== "PATIENT" ? { patientId: q.patientId } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.date ? { startTime: { gte: localMidnightUtc(q.date), lt: localMidnightUtc(addDays(q.date, 1)) } } : {}),
    ...(q.scope === "upcoming" ? { endTime: { gte: now } } : q.scope === "past" ? { endTime: { lt: now } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: appointmentInclude,
      orderBy: { startTime: q.scope === "past" ? "desc" : "asc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.appointment.count({ where }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function getAppointment(actor: SessionUser, id: string) {
  assertCan(actor.role, "appointment:read");
  const appt = await prisma.appointment.findUnique({ where: { id }, include: appointmentInclude });
  if (!appt) throw notFound("Appointment");
  assertInScope(actor, appt);
  return appt;
}

// --------------------------------------------------------------------------
// Commands
// --------------------------------------------------------------------------

/** Map Postgres exclusion-constraint violations to friendly 409s. */
function mapOverlapError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("appointment_patient_no_overlap")) {
    throw new AppError("CONFLICT", 409, "The patient already has an appointment that overlaps this time");
  }
  if (msg.includes("appointment_doctor_no_overlap") || msg.includes("23P01")) throw slotUnavailable();
  throw e;
}

async function assertBookableSlot(doctorId: string, start: Date, now: Date) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId }, include: { schedules: true } });
  if (!doctor || !doctor.isActive) throw notFound("Doctor");
  if (start <= now) throw validationError("Appointments must be booked in the future");
  if (!isValidSlotStart(start, doctor.schedules, doctor.slotMinutes)) {
    throw validationError("The requested time is not one of the doctor's available slots");
  }
  return { doctor, end: addMinutes(start, doctor.slotMinutes) };
}

export interface BookResult {
  appointment: AppointmentWithRelations;
  replayed: boolean;
}

export async function bookAppointment(
  actor: SessionUser,
  input: BookAppointmentInput,
  idempotencyKey?: string,
  now = new Date(),
): Promise<BookResult> {
  assertCan(actor.role, "appointment:write");
  if (actor.role === "PATIENT" && input.patientId !== actor.patientId) throw forbidden("Patients can only book for themselves");
  if (actor.role === "CLINICIAN" && input.doctorId !== actor.doctorId) throw forbidden("Clinicians can only book follow-ups in their own schedule");

  // Idempotent replay: the same key returns the original result.
  if (idempotencyKey) {
    const existing = await prisma.appointment.findUnique({ where: { idempotencyKey }, include: appointmentInclude });
    if (existing) return replay(existing, input);
  }

  const { end } = await assertBookableSlot(input.doctorId, input.startTime, now);
  const patient = await prisma.patient.findUnique({ where: { id: input.patientId }, select: { id: true } });
  if (!patient) throw notFound("Patient");

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      const created = await tx.appointment.create({
        data: {
          patientId: input.patientId,
          doctorId: input.doctorId,
          startTime: input.startTime,
          endTime: end,
          reason: input.reason,
          idempotencyKey,
          createdById: actor.id,
        },
        include: appointmentInclude,
      });
      await audit(actor, {
        action: "CREATE", entityType: "Appointment", entityId: created.id, patientId: created.patientId,
        metadata: { doctorId: created.doctorId, startTime: created.startTime.toISOString() },
      }, tx);
      return created;
    });
    return { appointment, replayed: false };
  } catch (e) {
    // Two identical requests raced: the loser hits UNIQUE(idempotencyKey) -> replay the winner.
    if (idempotencyKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.appointment.findUnique({ where: { idempotencyKey }, include: appointmentInclude });
      if (existing) return replay(existing, input);
    }
    mapOverlapError(e);
  }
}

function replay(existing: AppointmentWithRelations, input: BookAppointmentInput): BookResult {
  const same =
    existing.patientId === input.patientId &&
    existing.doctorId === input.doctorId &&
    existing.startTime.getTime() === input.startTime.getTime();
  if (!same) throw new AppError("IDEMPOTENCY_MISMATCH", 422, "This Idempotency-Key was already used for a different booking");
  return { appointment: existing, replayed: true };
}

export async function rescheduleAppointment(actor: SessionUser, id: string, input: { startTime: Date; version: number }, now = new Date()) {
  assertCan(actor.role, "appointment:write");
  const appt = await prisma.appointment.findUnique({ where: { id } });
  if (!appt) throw notFound("Appointment");
  assertInScope(actor, appt);
  if (appt.status !== "SCHEDULED") throw new AppError("INVALID_STATE", 409, `Only scheduled appointments can be rescheduled (current: ${appt.status})`);
  if (appt.version !== input.version) throw staleVersion();
  const { end } = await assertBookableSlot(appt.doctorId, input.startTime, now);

  try {
    return await prisma.$transaction(async (tx) => {
      // Optimistic lock: only succeeds if nobody changed the row since it was read.
      const res = await tx.appointment.updateMany({
        where: { id, version: input.version, status: "SCHEDULED" },
        data: { startTime: input.startTime, endTime: end, version: { increment: 1 } },
      });
      if (res.count !== 1) throw staleVersion();
      await audit(actor, {
        action: "UPDATE", entityType: "Appointment", entityId: id, patientId: appt.patientId,
        metadata: { change: "reschedule", from: appt.startTime.toISOString(), to: input.startTime.toISOString() },
      }, tx);
      return tx.appointment.findUniqueOrThrow({ where: { id }, include: appointmentInclude });
    });
  } catch (e) {
    mapOverlapError(e);
  }
}

/** Cancel / check-in / no-show / complete, validated against the state machine. */
export async function transitionAppointment(
  actor: SessionUser,
  id: string,
  to: AppointmentStatus,
  version: number,
  opts: { reason?: string; now?: Date; db?: Prisma.TransactionClient } = {},
) {
  assertCan(actor.role, "appointment:write");
  const allowed = TRANSITION_ROLES[to] ?? [];
  if (!allowed.includes(actor.role)) throw forbidden(`Role ${actor.role} cannot mark an appointment ${to}`);

  const run = async (tx: Prisma.TransactionClient) => {
    const appt = await tx.appointment.findUnique({ where: { id } });
    if (!appt) throw notFound("Appointment");
    assertInScope(actor, appt);
    assertTransition(appt.status, to);
    if (appt.version !== version) throw staleVersion();
    const now = opts.now ?? new Date();
    if (to === "NO_SHOW" && appt.startTime > now) throw validationError("A no-show can only be recorded after the appointment time");
    if (to === "CANCELLED" && actor.role === "PATIENT" && appt.startTime <= now) throw validationError("Past appointments cannot be cancelled online");

    const res = await tx.appointment.updateMany({
      where: { id, version, status: appt.status },
      data: { status: to, version: { increment: 1 }, ...(to === "CANCELLED" ? { cancelReason: opts.reason } : {}) },
    });
    if (res.count !== 1) throw staleVersion();
    await audit(actor, {
      action: "STATUS_CHANGE", entityType: "Appointment", entityId: id, patientId: appt.patientId,
      metadata: { from: appt.status, to },
    }, tx);
    return tx.appointment.findUniqueOrThrow({ where: { id }, include: appointmentInclude });
  };
  return opts.db ? run(opts.db) : prisma.$transaction(run);
}
