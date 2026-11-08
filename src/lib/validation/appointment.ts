import { z } from "zod";
import { isoDate, optionalText, pageQuery } from "./common";

export const APPOINTMENT_STATUSES = ["SCHEDULED", "CHECKED_IN", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

const instant = z.string().datetime({ offset: true, message: "Use an ISO-8601 timestamp" }).transform((s) => new Date(s));

export const bookAppointmentInput = z.object({
  patientId: z.string().min(1, "Choose a patient"),
  doctorId: z.string().min(1, "Choose a doctor"),
  startTime: instant,
  reason: optionalText(300),
});
export type BookAppointmentInput = z.infer<typeof bookAppointmentInput>;

export const rescheduleInput = z.object({ startTime: instant, version: z.number().int().min(1) });
export const cancelInput = z.object({ reason: z.string().trim().min(3, "Give a short reason").max(300), version: z.number().int().min(1) });
export const statusInput = z.object({
  status: z.enum(["CHECKED_IN", "NO_SHOW", "COMPLETED"]),
  version: z.number().int().min(1),
});

export const availabilityQuery = z.object({ date: isoDate });

export const appointmentListQuery = pageQuery.extend({
  date: isoDate.optional().or(z.literal("").transform(() => undefined)),
  doctorId: z.string().optional().transform((v) => v || undefined),
  patientId: z.string().optional().transform((v) => v || undefined),
  status: z.enum(APPOINTMENT_STATUSES).optional().or(z.literal("").transform(() => undefined)),
  scope: z.enum(["upcoming", "past", "all"]).default("all"),
});
export type AppointmentListQuery = z.infer<typeof appointmentListQuery>;

/** Idempotency keys: 8–100 visible ASCII characters (UUIDs recommended). */
export const idempotencyKey = z.string().regex(/^[\x21-\x7e]{8,100}$/, "Invalid Idempotency-Key header");
