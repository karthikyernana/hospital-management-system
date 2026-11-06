import { json, route } from "@/server/http/api";
import { removeLine } from "@/server/services/billing";

/** DELETE /api/invoices/:id/lines/:lineId — draft only. */
export const DELETE = route({ permission: "billing:write" }, async ({ user, params }) => json(await removeLine(user, params.id, params.lineId)));
