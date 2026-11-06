import { json, route } from "@/server/http/api";
import { getAppointment } from "@/server/services/appointments";

/** GET /api/appointments/:id */
export const GET = route({ permission: "appointment:read" }, async ({ user, params }) => json(await getAppointment(user, params.id)));
