/**
 * Test helpers: build authenticated Requests for route handlers and create
 * minimal fixtures directly with Prisma.
 */
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { SESSION_COOKIE, signSession, type SessionUser } from "@/server/auth/session";

export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    "AuditLog","Payment","InvoiceLineItem","Invoice","DiagnosticReport","Prescription","ClinicalNote",
    "Encounter","Appointment","DoctorSchedule","Patient","StaffMember","Doctor","Department","User"
    RESTART IDENTITY CASCADE`);
}

let hash: string | undefined;
export async function createUser(role: Role, email: string): Promise<SessionUser> {
  hash ??= await bcrypt.hash("Test@12345", 4);
  const u = await prisma.user.create({ data: { email, passwordHash: hash, name: email.split("@")[0], role } });
  return { id: u.id, email: u.email, name: u.name, role: u.role, doctorId: null, patientId: null };
}

export async function call(
  handler: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
  opts: { method?: string; url?: string; user?: SessionUser | null; body?: unknown; params?: Record<string, string>; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { "content-type": "application/json", ...(opts.headers ?? {}) };
  if (opts.user) headers.cookie = `${SESSION_COOKIE}=${await signSession(opts.user)}`;
  const req = new Request(`http://localhost${opts.url ?? "/api/test"}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, res };
}
