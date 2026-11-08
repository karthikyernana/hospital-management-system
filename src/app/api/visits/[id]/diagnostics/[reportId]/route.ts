import { json, route } from "@/server/http/api";
import { diagnosticResultInput } from "@/lib/validation/visit";
import { recordDiagnosticResult } from "@/server/services/visits";

/** PATCH /api/visits/:id/diagnostics/:reportId { resultSummary, fileName? } — clinician records the result. */
export const PATCH = route({ permission: "visit:write", body: diagnosticResultInput }, async ({ user, params, body }) =>
  json(await recordDiagnosticResult(user, params.id, params.reportId, body)),
);
