import { json, route } from "@/server/http/api";
import { diagnosticOrderInput } from "@/lib/validation/visit";
import { orderDiagnostic } from "@/server/services/visits";

/** POST /api/visits/:id/diagnostics { testName } — order a test (metadata only). */
export const POST = route({ permission: "visit:write", body: diagnosticOrderInput }, async ({ user, params, body }) =>
  json(await orderDiagnostic(user, params.id, body.testName), 201),
);
