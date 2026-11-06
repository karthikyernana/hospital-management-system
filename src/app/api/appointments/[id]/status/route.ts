import { json, route } from "@/server/http/api";
import { statusInput } from "@/lib/validation/appointment";
import { transitionAppointment } from "@/server/services/appointments";

/** POST /api/appointments/:id/status { status: CHECKED_IN | NO_SHOW | COMPLETED, version } */
export const POST = route({ permission: "appointment:write", body: statusInput }, async ({ user, params, body }) =>
  json(await transitionAppointment(user, params.id, body.status, body.version)),
);
