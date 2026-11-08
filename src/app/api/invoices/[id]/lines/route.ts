import { json, route } from "@/server/http/api";
import { lineInput } from "@/lib/validation/billing";
import { addLine } from "@/server/services/billing";

/** POST /api/invoices/:id/lines — add a line item to a draft (totals recomputed). */
export const POST = route({ permission: "billing:write", body: lineInput }, async ({ user, params, body }) => json(await addLine(user, params.id, body), 201));
