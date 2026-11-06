/**
 * Typed application errors. Services throw these; the API layer turns them
 * into a predictable JSON envelope: { error: { code, message, details? } }.
 */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "SLOT_UNAVAILABLE"
  | "INVALID_STATE"
  | "STALE_VERSION"
  | "IDEMPOTENCY_MISMATCH"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthenticated = (msg = "Please sign in to continue") => new AppError("UNAUTHENTICATED", 401, msg);
export const forbidden = (msg = "You do not have permission to perform this action") =>
  new AppError("FORBIDDEN", 403, msg);
export const notFound = (what = "Resource") => new AppError("NOT_FOUND", 404, `${what} not found`);
export const validationError = (message: string, details?: unknown) =>
  new AppError("VALIDATION_ERROR", 422, message, details);
export const conflict = (message: string, details?: unknown) => new AppError("CONFLICT", 409, message, details);
export const slotUnavailable = (message = "That time slot is no longer available") =>
  new AppError("SLOT_UNAVAILABLE", 409, message);
export const invalidState = (message: string) => new AppError("INVALID_STATE", 409, message);
export const staleVersion = () =>
  new AppError("STALE_VERSION", 409, "This record was changed by someone else. Refresh and try again.");
