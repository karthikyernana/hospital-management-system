import { json, route } from "@/server/http/api";
import { prescriptionInput } from "@/lib/validation/visit";
import { addPrescription } from "@/server/services/visits";

/** POST /api/visits/:id/prescriptions */
export const POST = route({ permission: "visit:write", body: prescriptionInput }, async ({ user, params, body }) =>
  json(await addPrescription(user, params.id, body), 201),
);
