import { json, route } from "@/server/http/api";
import { dateRangeQuery } from "@/lib/validation/reports";
import { billingSummary } from "@/server/services/reports";

/** GET /api/reports/billing?from=&to= — invoiced, collected, outstanding and reconciliation status. */
export const GET = route({ permission: "report:read", query: dateRangeQuery }, async ({ user, query }) => json(await billingSummary(user, query)));
