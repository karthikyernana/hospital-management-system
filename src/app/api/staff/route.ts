import { json, route } from "@/server/http/api";
import { staffInput, staffListQuery } from "@/lib/validation/directory";
import { createStaff, listStaff } from "@/server/services/directory";

export const GET = route({ permission: "directory:read", query: staffListQuery }, async ({ user, query }) =>
  json(await listStaff(user, query)),
);
export const POST = route({ permission: "directory:write", body: staffInput }, async ({ user, body }) =>
  json(await createStaff(user, body), 201),
);
