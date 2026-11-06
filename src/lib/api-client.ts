/** Browser-side fetch helper that unwraps the API envelope and surfaces errors. */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } & Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  init: Omit<RequestInit, "body"> & { body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string>) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const e = payload?.error ?? {};
    throw new ApiError(e.code ?? "HTTP_ERROR", e.message ?? `Request failed (${res.status})`, res.status, e.details);
  }
  return payload?.data as T;
}

/** First validation message for a field, if any. */
export function fieldError(err: unknown, field: string): string | undefined {
  if (err instanceof ApiError) return err.details?.fieldErrors?.[field]?.[0];
  return undefined;
}
