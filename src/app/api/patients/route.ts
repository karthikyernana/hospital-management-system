import { json, route } from "@/server/http/api";
import { patientInput, patientListQuery } from "@/lib/validation/patient";
import { createPatient, listPatients } from "@/server/services/patients";

/** GET /api/patients?q=&gender=&page=&pageSize= — search patients. */
export const GET = route({ permission: "patient:read", query: patientListQuery }, async ({ user, query }) =>
  json(await listPatients(user, query)),
);

/** POST /api/patients — register a patient (MRN is assigned by the server). */
export const POST = route({ permission: "patient:write", body: patientInput }, async ({ user, body }) =>
  json(await createPatient(user, body), 201),
);
