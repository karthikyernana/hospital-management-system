import { json, route } from "@/server/http/api";
import { departmentInput } from "@/lib/validation/directory";
import { createDepartment, listDepartments } from "@/server/services/directory";

export const GET = route({ permission: "directory:read" }, async ({ user }) => json(await listDepartments(user)));
export const POST = route({ permission: "directory:write", body: departmentInput }, async ({ user, body }) =>
  json(await createDepartment(user, body), 201),
);
