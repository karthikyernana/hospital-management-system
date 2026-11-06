import { json, route } from "@/server/http/api";
import { doctorInput, doctorListQuery } from "@/lib/validation/directory";
import { createDoctor, listDoctors } from "@/server/services/directory";

/** GET /api/doctors?q=&departmentId=&page= */
export const GET = route({ permission: "directory:read", query: doctorListQuery }, async ({ user, query }) =>
  json(await listDoctors(user, query)),
);
export const POST = route({ permission: "directory:write", body: doctorInput }, async ({ user, body }) =>
  json(await createDoctor(user, body), 201),
);
