import { json, route } from "@/server/http/api";
import { scheduleInput } from "@/lib/validation/directory";
import { replaceSchedule } from "@/server/services/directory";

/** PUT /api/doctors/:id/schedule — replace weekly working windows (admin). */
export const PUT = route({ permission: "directory:write", body: scheduleInput }, async ({ user, params, body }) =>
  json(await replaceSchedule(user, params.id, body.windows)),
);
