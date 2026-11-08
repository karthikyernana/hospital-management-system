import { json, route } from "@/server/http/api";
import { voidInput } from "@/lib/validation/billing";
import { voidInvoice } from "@/server/services/billing";

/** POST /api/invoices/:id/void { reason } — only without payments. */
export const POST = route({ permission: "billing:write", body: voidInput }, async ({ user, params, body }) => json(await voidInvoice(user, params.id, body.reason)));
