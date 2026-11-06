import { json, route } from "@/server/http/api";
import { appointmentListQuery, bookAppointmentInput, idempotencyKey } from "@/lib/validation/appointment";
import { bookAppointment, listAppointments } from "@/server/services/appointments";

/** GET /api/appointments?date=&doctorId=&patientId=&status=&scope=&page= (scoped by role) */
export const GET = route({ permission: "appointment:read", query: appointmentListQuery }, async ({ user, query }) =>
  json(await listAppointments(user, query)),
);

/**
 * POST /api/appointments — book a slot.
 * Send an `Idempotency-Key` header: retries with the same key return the
 * original appointment (200 + `Idempotent-Replayed: true`) instead of a duplicate.
 */
export const POST = route({ permission: "appointment:write", body: bookAppointmentInput }, async ({ user, body, req }) => {
  const rawKey = req.headers.get("idempotency-key");
  const key = rawKey ? idempotencyKey.parse(rawKey) : undefined;
  const { appointment, replayed } = await bookAppointment(user, body, key);
  return json(appointment, replayed ? 200 : 201, replayed ? { "Idempotent-Replayed": "true" } : undefined);
});
