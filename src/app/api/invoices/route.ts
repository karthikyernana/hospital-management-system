import { json, route } from "@/server/http/api";
import { createInvoiceInput, invoiceListQuery } from "@/lib/validation/billing";
import { createInvoice, listInvoices } from "@/server/services/billing";

/** GET /api/invoices?status=&patientId=&q=&page= (patients see only their own) */
export const GET = route({ permission: "billing:read", query: invoiceListQuery }, async ({ user, query }) => json(await listInvoices(user, query)));

/** POST /api/invoices { appointmentId } or { patientId, lines[] } — creates a DRAFT invoice. */
export const POST = route({ permission: "billing:write", body: createInvoiceInput }, async ({ user, body }) => json(await createInvoice(user, body), 201));
