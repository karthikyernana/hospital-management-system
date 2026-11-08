import { json, route } from "@/server/http/api";
import { dateRangeQuery } from "@/lib/validation/reports";
import { appointmentSummary } from "@/server/services/reports";

/** GET /api/reports/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD (defaults to the last 30 days) */
export const GET = route({ permission: "report:read", query: dateRangeQuery }, async ({ user, query }) => json(await appointmentSummary(user, query)));
