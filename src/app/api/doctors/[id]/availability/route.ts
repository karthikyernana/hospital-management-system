import { json, route } from "@/server/http/api";
import { availabilityQuery } from "@/lib/validation/appointment";
import { getAvailability } from "@/server/services/appointments";

/** GET /api/doctors/:id/availability?date=YYYY-MM-DD — slots for one IST day. */
export const GET = route({ permission: "appointment:read", query: availabilityQuery }, async ({ user, params, query }) =>
  json(await getAvailability(user, params.id, query.date)),
);
