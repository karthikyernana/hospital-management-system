import { json, route } from "@/server/http/api";
import { issueInvoice } from "@/server/services/billing";

/** POST /api/invoices/:id/issue — DRAFT → ISSUED (line items become immutable). */
export const POST = route({ permission: "billing:write" }, async ({ user, params }) => json(await issueInvoice(user, params.id)));
