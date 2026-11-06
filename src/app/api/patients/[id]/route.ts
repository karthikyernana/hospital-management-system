import { json, route } from "@/server/http/api";
import { patientUpdate } from "@/lib/validation/patient";
import { getPatient, updatePatient } from "@/server/services/patients";

/** GET /api/patients/:id — full profile (audited). Patients may read only their own. */
export const GET = route({}, async ({ user, params }) => json(await getPatient(user, params.id)));

/** PATCH /api/patients/:id — update demographics (audited). */
export const PATCH = route({ permission: "patient:write", body: patientUpdate }, async ({ user, params, body }) =>
  json(await updatePatient(user, params.id, body)),
);
