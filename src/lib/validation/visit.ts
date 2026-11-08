import { z } from "zod";
import { optionalText, pageQuery } from "./common";

export const startVisitInput = z.object({ appointmentId: z.string().min(1) });
export const noteInput = z.object({ body: z.string().trim().min(3, "Note is too short").max(5000) });
export const prescriptionInput = z.object({
  medication: z.string().trim().min(2).max(120),
  dosage: z.string().trim().min(1).max(60),
  frequency: z.string().trim().min(2).max(120),
  durationDays: z.coerce.number().int().min(1).max(365),
  instructions: optionalText(300),
});
export const diagnosticOrderInput = z.object({ testName: z.string().trim().min(2).max(120) });
export const diagnosticResultInput = z.object({
  resultSummary: z.string().trim().min(2).max(2000),
  fileName: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(200).regex(/^[\w.\- ]+$/, "Letters, numbers, dot, dash only").optional()),
});
export const visitListQuery = pageQuery.extend({
  patientId: z.string().optional().transform((v) => v || undefined),
  status: z.enum(["OPEN", "FINALIZED"]).optional().or(z.literal("").transform(() => undefined)),
});
export type VisitListQuery = z.infer<typeof visitListQuery>;
