import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation/auth";
import { authenticate } from "@/server/services/auth";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/server/auth/session";
import { errorResponse, toAppError } from "@/server/http/api";

/** POST /api/auth/login — exchange email + password for a session cookie. */
export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await req.json().catch(() => ({})));
    const user = await authenticate(body.email, body.password);
    const res = NextResponse.json({ data: { user } });
    res.cookies.set(SESSION_COOKIE, await signSession(user), sessionCookieOptions());
    return res;
  } catch (err) {
    return errorResponse(toAppError(err));
  }
}
