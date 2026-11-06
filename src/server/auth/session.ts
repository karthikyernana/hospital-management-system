/**
 * Stateless session: a signed (HS256) JWT in an httpOnly, SameSite=Lax cookie.
 * Contains only identifiers and role — no clinical data.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "hms_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60; // one working shift

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Set when the user is a clinician. */
  doctorId?: string | null;
  /** Set when the user is a patient (portal). */
  patientId?: string | null;
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set (min 32 characters)");
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return {
      id: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      doctorId: (payload.doctorId as string | null) ?? null,
      patientId: (payload.patientId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Read the session cookie from a raw Request (used by API route handlers and tests). */
export function readSessionCookie(req: Request): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
