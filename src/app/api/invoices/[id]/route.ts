import { json, route } from "@/server/http/api";
import { updateInvoiceInput } from "@/lib/validation/billing";
import { getInvoice, updateDraft } from "@/server/services/billing";

/** GET /api/invoices/:id — invoice with line items, payments and a `reconciliation` check (audited). */
export const GET = route({ permission: "billing:read" }, async ({ user, params }) => json(await getInvoice(user, params.id)));

/** PATCH /api/invoices/:id { discountCents?, notes? } — draft only. */
export const PATCH = route({ permission: "billing:write", body: updateInvoiceInput }, async ({ user, params, body }) =>
  json(await updateDraft(user, params.id, body)),
);
