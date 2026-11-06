import { z } from "zod";
import { isoDate, optionalText, pageQuery, phone } from "./common";

export const GENDERS = ["FEMALE", "MALE", "OTHER", "UNDISCLOSED"] as const;
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;

export const patientInput = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  dateOfBirth: isoDate.refine((d) => new Date(d) <= new Date(), "Date of birth cannot be in the future"),
  gender: z.enum(GENDERS),
  phone,
  email: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().email("Enter a valid email").optional()),
  address: optionalText(300),
  bloodGroup: z.preprocess((v) => (v === "" ? undefined : v), z.enum(BLOOD_GROUPS).optional()),
  emergencyContact: optionalText(200),
  allergies: optionalText(300),
});
export type PatientInput = z.infer<typeof patientInput>;

export const patientUpdate = patientInput.partial();

export const patientListQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  gender: z.enum(GENDERS).optional().or(z.literal("").transform(() => undefined)),
});
export type PatientListQuery = z.infer<typeof patientListQuery>;
