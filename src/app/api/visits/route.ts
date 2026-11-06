import { json, route } from "@/server/http/api";
import { startVisitInput, visitListQuery } from "@/lib/validation/visit";
import { listVisits, startVisit } from "@/server/services/visits";

/** GET /api/visits?patientId=&status=&page= — scoped by role and care relationship. */
export const GET = route({ permission: "visit:read", query: visitListQuery }, async ({ user, query }) => json(await listVisits(user, query)));

/** POST /api/visits { appointmentId } — clinician starts the visit for a checked-in appointment. */
export const POST = route({ permission: "visit:write", body: startVisitInput }, async ({ user, body }) =>
  json(await startVisit(user, body.appointmentId), 201),
);
