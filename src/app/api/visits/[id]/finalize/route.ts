import { json, route } from "@/server/http/api";
import { finalizeVisit } from "@/server/services/visits";

/** POST /api/visits/:id/finalize — lock the record and complete the appointment. */
export const POST = route({ permission: "visit:write" }, async ({ user, params }) => json(await finalizeVisit(user, params.id)));
