import { json, route } from "@/server/http/api";
import { noteInput } from "@/lib/validation/visit";
import { addNote } from "@/server/services/visits";

/** POST /api/visits/:id/notes { body } */
export const POST = route({ permission: "visit:write", body: noteInput }, async ({ user, params, body }) =>
  json(await addNote(user, params.id, body.body), 201),
);
