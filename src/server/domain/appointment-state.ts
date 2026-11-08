/**
 * Appointment state machine.
 *
 *   SCHEDULED ──check-in──▶ CHECKED_IN ──complete──▶ COMPLETED
 *       │  └──no-show──▶ NO_SHOW
 *       └──cancel──▶ CANCELLED
 *
 * COMPLETED, CANCELLED and NO_SHOW are terminal. Rescheduling is only
 * possible while SCHEDULED (it changes the time, not the state).
 */
import type { AppointmentStatus, Role } from "@prisma/client";
import { invalidState } from "../http/errors";

export const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/** Which roles may move an appointment *into* a given state. */
export const TRANSITION_ROLES: Partial<Record<AppointmentStatus, Role[]>> = {
  CHECKED_IN: ["ADMIN", "FRONT_DESK"],
  NO_SHOW: ["ADMIN", "FRONT_DESK"],
  CANCELLED: ["ADMIN", "FRONT_DESK", "PATIENT"],
  COMPLETED: ["ADMIN", "CLINICIAN"],
};

/** Statuses that occupy the doctor's time (mirrors the DB exclusion constraint). */
export const ACTIVE_STATUSES: AppointmentStatus[] = ["SCHEDULED", "CHECKED_IN", "COMPLETED"];

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: AppointmentStatus, to: AppointmentStatus): void {
  if (!canTransition(from, to)) throw invalidState(`Cannot change an appointment from ${from} to ${to}`);
}
