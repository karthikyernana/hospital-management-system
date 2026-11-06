import { json, route } from "@/server/http/api";
import { auditListQuery } from "@/lib/validation/reports";
import { listAuditLogs } from "@/server/services/audit-query";

/** GET /api/audit-logs?action=&entityType=&actorId=&patientId=&from=&to=&page= (admin only) */
export const GET = route({ permission: "audit:read", query: auditListQuery }, async ({ user, query }) => json(await listAuditLogs(user, query)));
