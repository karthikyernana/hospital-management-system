import { json, route } from "@/server/http/api";
import { getVisit } from "@/server/services/visits";

/** GET /api/visits/:id — full visit record (audited). */
export const GET = route({ permission: "visit:read" }, async ({ user, params }) => json(await getVisit(user, params.id)));
