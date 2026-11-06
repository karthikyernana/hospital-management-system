import { json, route } from "@/server/http/api";
import { paymentInput } from "@/lib/validation/billing";
import { idempotencyKey } from "@/lib/validation/appointment";
import { validationError } from "@/server/http/errors";
import { payInvoice } from "@/server/services/billing";

/**
 * POST /api/invoices/:id/payments { amountCents, method, simulate: "approve" | "decline" }
 * Requires an `Idempotency-Key` header. Returns 201 with the settled payment
 * (SUCCEEDED or FAILED), or 200 + `Idempotent-Replayed: true` for a retry.
 */
export const POST = route({ permission: "billing:write", body: paymentInput }, async ({ user, params, body, req }) => {
  const raw = req.headers.get("idempotency-key");
  if (!raw) throw validationError("An Idempotency-Key header is required for payments");
  const { payment, replayed } = await payInvoice(user, params.id, body, idempotencyKey.parse(raw));
  return json(payment, replayed ? 200 : 201, replayed ? { "Idempotent-Replayed": "true" } : undefined);
});
