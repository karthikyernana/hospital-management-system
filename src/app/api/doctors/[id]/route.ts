import { json, route } from "@/server/http/api";
import { getDoctor } from "@/server/services/directory";

/** GET /api/doctors/:id — doctor profile with weekly schedule. */
export const GET = route({ permission: "directory:read" }, async ({ user, params }) => json(await getDoctor(user, params.id)));
