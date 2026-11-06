import { z } from "zod";
import { optionalText, pageQuery } from "./common";

export const LINE_CATEGORIES = ["CONSULTATION", "PROCEDURE", "LAB", "PHARMACY", "ROOM", "OTHER"] as const;
export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PAID", "VOID"] as const;
export const PAYMENT_METHODS = ["CARD", "UPI", "CASH"] as const;

export const lineInput = z.object({
  category: z.enum(LINE_CATEGORIES),
  description: z.string().trim().min(2).max(200),
  quantity: z.coerce.number().int().min(1).max(1000),
  unitPriceCents: z.coerce.number().int().min(0).max(100_000_000),
  taxRateBps: z.coerce.number().int().min(0).max(10_000).default(0),
});
export type LineInputT = z.infer<typeof lineInput>;

export const createInvoiceInput = z
  .object({
    patientId: z.string().optional(),
    appointmentId: z.string().optional(),
    lines: z.array(lineInput).max(50).default([]),
    discountCents: z.coerce.number().int().min(0).default(0),
    notes: optionalText(500),
  })
  .refine((v) => v.patientId || v.appointmentId, { message: "Provide a patient or an appointment", path: ["patientId"] });
export type CreateInvoiceInput = z.infer<typeof createInvoiceInput>;

export const updateInvoiceInput = z.object({ discountCents: z.coerce.number().int().min(0).optional(), notes: optionalText(500) });
export const voidInput = z.object({ reason: z.string().trim().min(3).max(300) });

export const paymentInput = z.object({
  amountCents: z.coerce.number().int().min(1, "Amount must be positive"),
  method: z.enum(PAYMENT_METHODS),
  /** Sandbox only: choose whether the simulated gateway approves or declines. */
  simulate: z.enum(["approve", "decline"]).default("approve"),
});
export type PaymentInputT = z.infer<typeof paymentInput>;

export const invoiceListQuery = pageQuery.extend({
  status: z.enum(INVOICE_STATUSES).optional().or(z.literal("").transform(() => undefined)),
  patientId: z.string().optional().transform((v) => v || undefined),
  q: z.string().trim().max(60).optional(),
});
export type InvoiceListQuery = z.infer<typeof invoiceListQuery>;
