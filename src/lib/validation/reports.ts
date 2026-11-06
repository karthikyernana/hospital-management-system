import { z } from "zod";
import { isoDate, pageQuery } from "./common";

export const dateRangeQuery = z
  .object({ from: isoDate.optional(), to: isoDate.optional() })
  .refine((r) => !r.from || !r.to || r.from <= r.to, { message: "`from` must be on or before `to`", path: ["to"] });
export type DateRange = z.infer<typeof dateRangeQuery>;

export const auditListQuery = pageQuery.extend({
  action: z.string().trim().max(40).optional().transform((v) => v || undefined),
  entityType: z.string().trim().max(40).optional().transform((v) => v || undefined),
  actorId: z.string().optional().transform((v) => v || undefined),
  patientId: z.string().optional().transform((v) => v || undefined),
  from: isoDate.optional().or(z.literal("").transform(() => undefined)),
  to: isoDate.optional().or(z.literal("").transform(() => undefined)),
});
export type AuditListQuery = z.infer<typeof auditListQuery>;
