/**
 * Thin wrapper used by every API route handler:
 *   1. authenticates the session cookie (401 if missing/invalid),
 *   2. checks the coarse RBAC permission (403 + audit entry if denied),
 *   3. validates query string and JSON body with Zod (422 with field errors),
 *   4. maps service/database errors to a predictable JSON error envelope.
 *
 * Business rules live in src/server/services; handlers stay a few lines long.
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { readSessionCookie, verifySession, type SessionUser } from "../auth/session";
import { assertCan, type Permission } from "../auth/permissions";
import { AppError, unauthenticated } from "./errors";
import { audit } from "../services/audit";

export interface RouteContext<B, Q> {
  req: Request;
  user: SessionUser;
  body: B;
  query: Q;
  params: Record<string, string>;
}

interface RouteOptions<B, Q> {
  permission?: Permission;
  body?: ZodType<B>;
  query?: ZodType<Q>;
}

type NextRouteCtx = { params: Promise<Record<string, string>> };

export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json({ data }, { status, headers });
}

export function errorResponse(err: AppError) {
  return NextResponse.json(
    { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } },
    { status: err.status },
  );
}

/** Translate low-level errors (Zod, Prisma, Postgres constraints) into AppErrors. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return new AppError("VALIDATION_ERROR", 422, "Request validation failed", err.flatten());
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return new AppError("CONFLICT", 409, "A record with these unique values already exists", err.meta);
    if (err.code === "P2025") return new AppError("NOT_FOUND", 404, "Resource not found");
    if (err.code === "P2003") return new AppError("VALIDATION_ERROR", 422, "Referenced record does not exist", err.meta);
  }
  const message = err instanceof Error ? err.message : String(err);
  // Postgres exclusion constraint (overlapping appointment) -> slot taken.
  if (message.includes("23P01") || message.includes("_no_overlap")) {
    return new AppError("SLOT_UNAVAILABLE", 409, "That time slot is no longer available");
  }
  // Postgres CHECK constraint violation.
  if (message.includes("23514")) return new AppError("VALIDATION_ERROR", 422, "Data violates an integrity rule");
  return new AppError("INTERNAL_ERROR", 500, "Something went wrong. Please try again.");
}

export async function getRequestUser(req: Request): Promise<SessionUser | null> {
  return verifySession(readSessionCookie(req));
}

export function route<B = undefined, Q = undefined>(
  opts: RouteOptions<B, Q>,
  handler: (ctx: RouteContext<B, Q>) => Promise<Response>,
) {
  return async (req: Request, nextCtx: NextRouteCtx): Promise<Response> => {
    let user: SessionUser | null = null;
    try {
      user = await getRequestUser(req);
      if (!user) throw unauthenticated();
      if (opts.permission) assertCan(user.role, opts.permission);

      const params = (await nextCtx?.params) ?? {}; // ctx may be omitted in tests
      const url = new URL(req.url);
      const query = opts.query ? opts.query.parse(Object.fromEntries(url.searchParams)) : (undefined as Q);

      let body = undefined as B;
      if (opts.body) {
        let raw: unknown;
        try {
          raw = await req.json();
        } catch {
          throw new AppError("VALIDATION_ERROR", 422, "Request body must be valid JSON");
        }
        body = opts.body.parse(raw);
      }
      return await handler({ req, user, body, query, params });
    } catch (err) {
      const appErr = toAppError(err);
      if (appErr.code === "INTERNAL_ERROR") console.error("[api]", req.method, req.url, err);
      if (appErr.code === "FORBIDDEN" && user) {
        // Denied attempts on protected data are themselves auditable events.
        await audit(user, {
          action: "ACCESS_DENIED",
          entityType: "Route",
          entityId: `${req.method} ${new URL(req.url).pathname}`,
          metadata: { reason: appErr.message },
        }).catch(() => undefined);
      }
      return errorResponse(appErr);
    }
  };
}
