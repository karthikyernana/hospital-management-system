/**
 * OpenAPI 3.1 description of the HTTP API. Served at /api/openapi.json and
 * rendered with Swagger UI at /docs. Kept next to the code so it changes with it.
 */
type Schema = Record<string, unknown>;
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const arr = (items: Schema) => ({ type: "array", items });
const ok = (schema: Schema, description = "OK") => ({ description, content: { "application/json": { schema: { type: "object", properties: { data: schema } } } } });
const err = (description: string) => ({ description, content: { "application/json": { schema: ref("Error") } } });
const body = (schema: Schema) => ({ required: true, content: { "application/json": { schema } } });
const idParam = (name = "id") => ({ name, in: "path", required: true, schema: { type: "string" } });
const q = (name: string, schema: Schema, description?: string) => ({ name, in: "query", required: false, schema, description });
const pageParams = [q("page", { type: "integer", minimum: 1, default: 1 }), q("pageSize", { type: "integer", minimum: 1, maximum: 100, default: 20 })];
const idemHeader = (required: boolean) => ({ name: "Idempotency-Key", in: "header", required, schema: { type: "string", minLength: 8, maxLength: 100 }, description: "Repeat the same key to safely retry; the original result is replayed." });
const std = { 401: err("Not signed in"), 403: err("Role or record-level access denied (audited)"), 422: err("Validation failed") };
const paginated = (item: string) => ({ type: "object", properties: { items: arr(ref(item)), total: { type: "integer" }, page: { type: "integer" }, pageSize: { type: "integer" } } });

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Hospital Management System API",
    version: "1.0.0",
    description:
      "REST API for the ALGIONS AI LABS Hospital Management System assessment. All endpoints except login/health require the `hms_session` cookie returned by `POST /api/auth/login`. Responses use `{ data }` on success and `{ error: { code, message, details? } }` on failure. Times are ISO-8601 UTC; the hospital operates in IST (UTC+05:30). Money is integer paise.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Auth" }, { name: "Patients" }, { name: "Directory" }, { name: "Appointments" },
    { name: "Visits" }, { name: "Billing" }, { name: "Reports & Audit" }, { name: "System" },
  ],
  components: {
    securitySchemes: { session: { type: "apiKey", in: "cookie", name: "hms_session" } },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string", enum: ["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "VALIDATION_ERROR", "CONFLICT", "SLOT_UNAVAILABLE", "INVALID_STATE", "STALE_VERSION", "IDEMPOTENCY_MISMATCH", "INTERNAL_ERROR"] },
              message: { type: "string" },
              details: { description: "Field errors for VALIDATION_ERROR: { fieldErrors, formErrors }" },
            },
          },
        },
      },
      SessionUser: { type: "object", properties: { id: { type: "string" }, email: { type: "string" }, name: { type: "string" }, role: { type: "string", enum: ["ADMIN", "FRONT_DESK", "CLINICIAN", "PATIENT"] }, doctorId: { type: ["string", "null"] }, patientId: { type: ["string", "null"] } } },
      PatientInput: {
        type: "object",
        required: ["firstName", "lastName", "dateOfBirth", "gender", "phone"],
        properties: {
          firstName: { type: "string" }, lastName: { type: "string" }, dateOfBirth: { type: "string", format: "date" },
          gender: { type: "string", enum: ["FEMALE", "MALE", "OTHER", "UNDISCLOSED"] }, phone: { type: "string" }, email: { type: "string", format: "email" },
          address: { type: "string" }, bloodGroup: { type: "string" }, emergencyContact: { type: "string" }, allergies: { type: "string" },
        },
      },
      Patient: { allOf: [ref("PatientInput"), { type: "object", properties: { id: { type: "string" }, mrn: { type: "string", example: "MRN-100041" } } }] },
      Doctor: { type: "object", properties: { id: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" }, specialty: { type: "string" }, departmentId: { type: "string" }, slotMinutes: { type: "integer" }, consultationFeeCents: { type: "integer" } } },
      ScheduleWindow: { type: "object", required: ["dayOfWeek", "startMinute", "endMinute"], properties: { dayOfWeek: { type: "integer", minimum: 0, maximum: 6 }, startMinute: { type: "integer", description: "IST minutes from midnight" }, endMinute: { type: "integer" } } },
      Slot: { type: "object", properties: { start: { type: "string", format: "date-time" }, end: { type: "string", format: "date-time" }, available: { type: "boolean" }, booked: { type: "boolean" } } },
      Appointment: {
        type: "object",
        properties: {
          id: { type: "string" }, patientId: { type: "string" }, doctorId: { type: "string" },
          startTime: { type: "string", format: "date-time" }, endTime: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["SCHEDULED", "CHECKED_IN", "COMPLETED", "CANCELLED", "NO_SHOW"] },
          reason: { type: ["string", "null"] }, version: { type: "integer", description: "Send back on reschedule/cancel/status for optimistic locking" },
        },
      },
      Visit: { type: "object", properties: { id: { type: "string" }, appointmentId: { type: "string" }, patientId: { type: "string" }, doctorId: { type: "string" }, status: { type: "string", enum: ["OPEN", "FINALIZED"] }, notes: arr({ type: "object" }), prescriptions: arr({ type: "object" }), diagnosticReports: arr({ type: "object" }) } },
      LineInput: { type: "object", required: ["category", "description", "quantity", "unitPriceCents"], properties: { category: { type: "string", enum: ["CONSULTATION", "PROCEDURE", "LAB", "PHARMACY", "ROOM", "OTHER"] }, description: { type: "string" }, quantity: { type: "integer", minimum: 1 }, unitPriceCents: { type: "integer", minimum: 0 }, taxRateBps: { type: "integer", minimum: 0, maximum: 10000, default: 0 } } },
      Invoice: {
        type: "object",
        properties: {
          id: { type: "string" }, number: { type: "string", example: "INV-2026-000123" }, status: { type: "string", enum: ["DRAFT", "ISSUED", "PAID", "VOID"] },
          subtotalCents: { type: "integer" }, taxCents: { type: "integer" }, discountCents: { type: "integer" }, totalCents: { type: "integer" }, amountPaidCents: { type: "integer" },
          lineItems: arr({ allOf: [ref("LineInput"), { type: "object", properties: { taxCents: { type: "integer" }, lineTotalCents: { type: "integer" } } }] }),
          payments: arr(ref("Payment")),
          reconciliation: { type: "object", properties: { ok: { type: "boolean" }, issues: arr({ type: "string" }), expected: { type: "object" } } },
        },
      },
      Payment: { type: "object", properties: { id: { type: "string" }, amountCents: { type: "integer" }, method: { type: "string", enum: ["CARD", "UPI", "CASH"] }, status: { type: "string", enum: ["PENDING", "SUCCEEDED", "FAILED"] }, providerRef: { type: "string" }, failureReason: { type: ["string", "null"] } } },
      AuditEntry: { type: "object", properties: { id: { type: "string" }, actorId: { type: "string" }, actorRole: { type: "string" }, action: { type: "string" }, entityType: { type: "string" }, entityId: { type: "string" }, patientId: { type: ["string", "null"] }, metadata: { type: "object" }, createdAt: { type: "string", format: "date-time" } } },
    },
  },
  security: [{ session: [] }],
  paths: {
    "/api/health": { get: { tags: ["System"], summary: "Liveness + database check", security: [], responses: { 200: ok({ type: "object" }), 503: err("Database unreachable") } } },
    "/api/auth/login": {
      post: {
        tags: ["Auth"], summary: "Sign in (sets httpOnly session cookie)", security: [],
        requestBody: body({ type: "object", required: ["email", "password"], properties: { email: { type: "string", example: "frontdesk@hms.test" }, password: { type: "string", example: "Demo@12345" } } }),
        responses: { 200: ok({ type: "object", properties: { user: ref("SessionUser") } }), 401: err("Invalid credentials (audited as LOGIN_FAILED)"), 422: std[422] },
      },
    },
    "/api/auth/logout": { post: { tags: ["Auth"], summary: "Sign out", responses: { 200: ok({ type: "object" }) } } },
    "/api/auth/me": { get: { tags: ["Auth"], summary: "Current user", responses: { 200: ok({ type: "object", properties: { user: ref("SessionUser") } }), 401: std[401] } } },

    "/api/patients": {
      get: { tags: ["Patients"], summary: "Search patients (staff)", parameters: [q("q", { type: "string" }, "Name, MRN or phone"), q("gender", { type: "string" }), ...pageParams], responses: { 200: ok(paginated("Patient")), ...std } },
      post: { tags: ["Patients"], summary: "Register patient (admin, front desk); MRN assigned by server", requestBody: body(ref("PatientInput")), responses: { 201: ok(ref("Patient"), "Created"), ...std } },
    },
    "/api/patients/{id}": {
      get: { tags: ["Patients"], summary: "Patient profile (audited READ). Patients may read only their own.", parameters: [idParam()], responses: { 200: ok(ref("Patient")), 404: err("Not found"), ...std } },
      patch: { tags: ["Patients"], summary: "Update demographics (audited with field names only)", parameters: [idParam()], requestBody: body(ref("PatientInput")), responses: { 200: ok(ref("Patient")), ...std } },
    },

    "/api/departments": {
      get: { tags: ["Directory"], summary: "List departments", responses: { 200: ok(arr({ type: "object" })) } },
      post: { tags: ["Directory"], summary: "Create department (admin)", requestBody: body({ type: "object", properties: { code: { type: "string" }, name: { type: "string" }, description: { type: "string" } } }), responses: { 201: ok({ type: "object" }), ...std } },
    },
    "/api/doctors": {
      get: { tags: ["Directory"], summary: "List/search doctors", parameters: [q("q", { type: "string" }), q("departmentId", { type: "string" }), ...pageParams], responses: { 200: ok(paginated("Doctor")) } },
      post: { tags: ["Directory"], summary: "Create doctor, optionally with a clinician login (admin)", requestBody: body(ref("Doctor")), responses: { 201: ok(ref("Doctor")), ...std } },
    },
    "/api/doctors/{id}": { get: { tags: ["Directory"], summary: "Doctor with weekly schedule", parameters: [idParam()], responses: { 200: ok(ref("Doctor")), 404: err("Not found") } } },
    "/api/doctors/{id}/schedule": { put: { tags: ["Directory"], summary: "Replace weekly schedule (admin). Overlapping windows rejected.", parameters: [idParam()], requestBody: body({ type: "object", properties: { windows: arr(ref("ScheduleWindow")) } }), responses: { 200: ok(arr(ref("ScheduleWindow"))), ...std } } },
    "/api/doctors/{id}/availability": { get: { tags: ["Appointments"], summary: "Slots for one IST day with availability", parameters: [idParam(), { name: "date", in: "query", required: true, schema: { type: "string", format: "date" } }], responses: { 200: ok({ type: "object", properties: { slots: arr(ref("Slot")) } }), ...std } } },
    "/api/staff": {
      get: { tags: ["Directory"], summary: "List/search staff", parameters: [q("q", { type: "string" }), q("staffRole", { type: "string" }), q("departmentId", { type: "string" }), ...pageParams], responses: { 200: ok({ type: "object" }) } },
      post: { tags: ["Directory"], summary: "Create staff member (admin)", requestBody: body({ type: "object" }), responses: { 201: ok({ type: "object" }), ...std } },
    },

    "/api/appointments": {
      get: { tags: ["Appointments"], summary: "List appointments (clinicians: own; patients: own)", parameters: [q("date", { type: "string", format: "date" }), q("doctorId", { type: "string" }), q("patientId", { type: "string" }), q("status", { type: "string" }), q("scope", { type: "string", enum: ["upcoming", "past", "all"] }), ...pageParams], responses: { 200: ok(paginated("Appointment")) } },
      post: {
        tags: ["Appointments"],
        summary: "Book a slot",
        description: "Validates the slot against the doctor's schedule, then inserts. A PostgreSQL exclusion constraint guarantees no overlapping active appointments for the same doctor or patient, even under concurrent requests.",
        parameters: [idemHeader(false)],
        requestBody: body({ type: "object", required: ["patientId", "doctorId", "startTime"], properties: { patientId: { type: "string" }, doctorId: { type: "string" }, startTime: { type: "string", format: "date-time" }, reason: { type: "string" } } }),
        responses: { 201: ok(ref("Appointment"), "Booked"), 200: ok(ref("Appointment"), "Idempotent replay (header Idempotent-Replayed: true)"), 404: err("Doctor/patient not found"), 409: err("SLOT_UNAVAILABLE or patient overlap"), ...std },
      },
    },
    "/api/appointments/{id}": { get: { tags: ["Appointments"], summary: "Appointment detail", parameters: [idParam()], responses: { 200: ok(ref("Appointment")), ...std } } },
    "/api/appointments/{id}/reschedule": { post: { tags: ["Appointments"], summary: "Move a SCHEDULED appointment to another free slot", parameters: [idParam()], requestBody: body({ type: "object", required: ["startTime", "version"], properties: { startTime: { type: "string", format: "date-time" }, version: { type: "integer" } } }), responses: { 200: ok(ref("Appointment")), 409: err("SLOT_UNAVAILABLE, INVALID_STATE or STALE_VERSION"), ...std } } },
    "/api/appointments/{id}/cancel": { post: { tags: ["Appointments"], summary: "Cancel (SCHEDULED only)", parameters: [idParam()], requestBody: body({ type: "object", required: ["reason", "version"], properties: { reason: { type: "string" }, version: { type: "integer" } } }), responses: { 200: ok(ref("Appointment")), 409: err("Invalid state / stale version"), ...std } } },
    "/api/appointments/{id}/status": { post: { tags: ["Appointments"], summary: "Check in, no-show or complete (state machine + role rules)", parameters: [idParam()], requestBody: body({ type: "object", required: ["status", "version"], properties: { status: { type: "string", enum: ["CHECKED_IN", "NO_SHOW", "COMPLETED"] }, version: { type: "integer" } } }), responses: { 200: ok(ref("Appointment")), 409: err("Invalid transition"), ...std } } },

    "/api/visits": {
      get: { tags: ["Visits"], summary: "List visits (clinicians: own or care-team; admin: all; patients: own finalized)", parameters: [q("patientId", { type: "string" }), q("status", { type: "string", enum: ["OPEN", "FINALIZED"] }), ...pageParams], responses: { 200: ok({ type: "object" }), ...std } },
      post: { tags: ["Visits"], summary: "Start the visit for a CHECKED_IN appointment (treating clinician)", requestBody: body({ type: "object", required: ["appointmentId"], properties: { appointmentId: { type: "string" } } }), responses: { 201: ok(ref("Visit")), 409: err("Visit already exists / not checked in"), ...std } },
    },
    "/api/visits/{id}": { get: { tags: ["Visits"], summary: "Visit record (audited READ; front desk always 403)", parameters: [idParam()], responses: { 200: ok(ref("Visit")), ...std } } },
    "/api/visits/{id}/notes": { post: { tags: ["Visits"], summary: "Add clinician note (OPEN visits)", parameters: [idParam()], requestBody: body({ type: "object", properties: { body: { type: "string" } } }), responses: { 201: ok({ type: "object" }), ...std } } },
    "/api/visits/{id}/prescriptions": { post: { tags: ["Visits"], summary: "Add prescription", parameters: [idParam()], requestBody: body({ type: "object", properties: { medication: { type: "string" }, dosage: { type: "string" }, frequency: { type: "string" }, durationDays: { type: "integer" }, instructions: { type: "string" } } }), responses: { 201: ok({ type: "object" }), ...std } } },
    "/api/visits/{id}/diagnostics": { post: { tags: ["Visits"], summary: "Order a diagnostic test (metadata only)", parameters: [idParam()], requestBody: body({ type: "object", properties: { testName: { type: "string" } } }), responses: { 201: ok({ type: "object" }), ...std } } },
    "/api/visits/{id}/diagnostics/{reportId}": { patch: { tags: ["Visits"], summary: "Record clinician-entered result summary", parameters: [idParam(), idParam("reportId")], requestBody: body({ type: "object", properties: { resultSummary: { type: "string" }, fileName: { type: "string" } } }), responses: { 200: ok({ type: "object" }), ...std } } },
    "/api/visits/{id}/finalize": { post: { tags: ["Visits"], summary: "Finalize visit and complete the appointment atomically", parameters: [idParam()], responses: { 200: ok(ref("Visit")), 409: err("Already finalized"), ...std } } },

    "/api/invoices": {
      get: { tags: ["Billing"], summary: "List invoices (patients: own, never drafts)", parameters: [q("status", { type: "string" }), q("patientId", { type: "string" }), q("q", { type: "string" }), ...pageParams], responses: { 200: ok(paginated("Invoice")) } },
      post: { tags: ["Billing"], summary: "Create DRAFT invoice from a completed appointment (adds consultation fee) or for a patient", requestBody: body({ type: "object", properties: { appointmentId: { type: "string" }, patientId: { type: "string" }, lines: arr(ref("LineInput")), discountCents: { type: "integer" } } }), responses: { 201: ok(ref("Invoice")), 409: err("Appointment already invoiced"), ...std } },
    },
    "/api/invoices/{id}": {
      get: { tags: ["Billing"], summary: "Invoice with line items, payments and reconciliation result (audited)", parameters: [idParam()], responses: { 200: ok(ref("Invoice")), ...std } },
      patch: { tags: ["Billing"], summary: "Update discount/notes (DRAFT only)", parameters: [idParam()], requestBody: body({ type: "object", properties: { discountCents: { type: "integer" }, notes: { type: "string" } } }), responses: { 200: ok(ref("Invoice")), ...std } },
    },
    "/api/invoices/{id}/lines": { post: { tags: ["Billing"], summary: "Add line item (DRAFT only; totals recomputed in the same transaction)", parameters: [idParam()], requestBody: body(ref("LineInput")), responses: { 201: ok(ref("Invoice")), 409: err("Not a draft"), ...std } } },
    "/api/invoices/{id}/lines/{lineId}": { delete: { tags: ["Billing"], summary: "Remove line item (DRAFT only)", parameters: [idParam(), idParam("lineId")], responses: { 200: ok(ref("Invoice")), ...std } } },
    "/api/invoices/{id}/issue": { post: { tags: ["Billing"], summary: "DRAFT → ISSUED", parameters: [idParam()], responses: { 200: ok(ref("Invoice")), ...std } } },
    "/api/invoices/{id}/void": { post: { tags: ["Billing"], summary: "Void (no payments)", parameters: [idParam()], requestBody: body({ type: "object", properties: { reason: { type: "string" } } }), responses: { 200: ok(ref("Invoice")), 409: err("Has payments / wrong state"), ...std } } },
    "/api/invoices/{id}/payments": {
      post: {
        tags: ["Billing"],
        summary: "Pay via simulated sandbox gateway",
        description: "Locks the invoice row, checks the outstanding balance (including in-flight payments), records a PENDING payment, calls the sandbox gateway and settles atomically. `simulate` chooses approve/decline.",
        parameters: [idParam(), idemHeader(true)],
        requestBody: body({ type: "object", required: ["amountCents", "method"], properties: { amountCents: { type: "integer", minimum: 1 }, method: { type: "string", enum: ["CARD", "UPI", "CASH"] }, simulate: { type: "string", enum: ["approve", "decline"], default: "approve" } } }),
        responses: { 201: ok(ref("Payment"), "Settled (SUCCEEDED or FAILED)"), 200: ok(ref("Payment"), "Idempotent replay"), 409: err("Invoice not payable"), ...std },
      },
    },

    "/api/reports/appointments": { get: { tags: ["Reports & Audit"], summary: "Appointment summary by status, department, doctor and day", parameters: [q("from", { type: "string", format: "date" }), q("to", { type: "string", format: "date" })], responses: { 200: ok({ type: "object" }), ...std } } },
    "/api/reports/billing": { get: { tags: ["Reports & Audit"], summary: "Invoiced / collected / outstanding + reconciliation of every invoice in range", parameters: [q("from", { type: "string", format: "date" }), q("to", { type: "string", format: "date" })], responses: { 200: ok({ type: "object" }), ...std } } },
    "/api/audit-logs": { get: { tags: ["Reports & Audit"], summary: "Audit trail (admin only)", parameters: [q("action", { type: "string" }), q("entityType", { type: "string" }), q("actorId", { type: "string" }), q("patientId", { type: "string" }), q("from", { type: "string", format: "date" }), q("to", { type: "string", format: "date" }), ...pageParams], responses: { 200: ok(paginated("AuditEntry")), ...std } } },
  },
} as const;
