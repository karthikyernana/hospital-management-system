import { json, route } from "@/server/http/api";
import { rescheduleInput } from "@/lib/validation/appointment";
import { rescheduleAppointment } from "@/server/services/appointments";

/** POST /api/appointments/:id/reschedule { startTime, version } */
export const POST = route({ permission: "appointment:write", body: rescheduleInput }, async ({ user, params, body }) =>
  json(await rescheduleAppointment(user, params.id, body)),
);
