import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { getRequestUser } from "@/server/http/api";
import { audit } from "@/server/services/audit";

/** POST /api/auth/logout — clear the session cookie. */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (user) await audit(user, { action: "LOGOUT", entityType: "User", entityId: user.id });
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
}
