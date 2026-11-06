import { json, route } from "@/server/http/api";

/** GET /api/auth/me — the signed-in user and role. */
export const GET = route({}, async ({ user }) => json({ user }));
