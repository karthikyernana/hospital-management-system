import { json, route } from "@/server/http/api";
import { cancelInput } from "@/lib/validation/appointment";
import { transitionAppointment } from "@/server/services/appointments";

/** POST /api/appointments/:id/cancel { reason, version } */
export const POST = route({ permission: "appointment:write", body: cancelInput }, async ({ user, params, body }) =>
  json(await transitionAppointment(user, params.id, "CANCELLED", body.version, { reason: body.reason })),
);
