import { z } from "zod";
import { optionalText, pageQuery, phone } from "./common";

export const STAFF_ROLES = ["RECEPTIONIST", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "ADMINISTRATOR"] as const;

export const departmentInput = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2,6}$/, "2–6 letters"),
  name: z.string().trim().min(2).max(80),
  description: optionalText(300),
});

export const doctorInput = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  departmentId: z.string().min(1, "Choose a department"),
  specialty: z.string().trim().min(2).max(120),
  licenseNo: z.string().trim().min(3).max(40),
  email: z.string().trim().toLowerCase().email(),
  phone,
  slotMinutes: z.coerce.number().int().min(5).max(240).default(30),
  consultationFeeCents: z.coerce.number().int().min(0).max(10_000_000),
  /** When true a CLINICIAN login is created with the given initial password. */
  createLogin: z.boolean().default(false),
  initialPassword: z.string().min(8).max(100).optional(),
});

export const scheduleWindow = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startMinute: z.coerce.number().int().min(0).max(1439),
    endMinute: z.coerce.number().int().min(1).max(1440),
  })
  .refine((w) => w.endMinute > w.startMinute, { message: "End must be after start", path: ["endMinute"] });

export const scheduleInput = z.object({ windows: z.array(scheduleWindow).max(28) });
export type ScheduleWindow = z.infer<typeof scheduleWindow>;

export const staffInput = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  staffRole: z.enum(STAFF_ROLES),
  departmentId: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  email: z.string().trim().toLowerCase().email(),
  phone,
});

export const doctorListQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  departmentId: z.string().optional(),
});
export const staffListQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  staffRole: z.enum(STAFF_ROLES).optional().or(z.literal("").transform(() => undefined)),
  departmentId: z.string().optional(),
});
