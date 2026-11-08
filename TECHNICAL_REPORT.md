# Technical Report: Hospital Management System

**Candidate:** Yernana Karthik · Reg. No. 12319251 · Lovely Professional University
**Role:** Full-Stack Web Development · **Project:** Hospital Management System (ALGIONS AI LABS)

## 1. Goal and scope

The aim was a **correct, explainable MVP** for the hospital's main journeys rather than many half-finished screens:

1. Front desk registers a patient and books an open slot with a doctor.
2. The patient is checked in; the clinician runs the visit (notes, prescriptions, test metadata) and finalizes it.
3. The front desk bills the visit with an itemized invoice; the patient or the desk pays through a sandbox gateway.
4. Administrators manage the directory and schedules, review reports and inspect the audit trail.
5. Patients use a small self-service portal (book/cancel, prescriptions, bills).

All five acceptance tests are automated (see §6).

## 2. Architecture decisions

| Decision | Why |
|---|---|
| **Modular monolith on Next.js App Router** | One deployable unit is enough for this scope (the brief says microservices are not required). Server Components render pages next to the data, and route handlers provide a clean JSON API for mutations and tests. |
| **Layered code: UI → HTTP → services → domain/persistence** | Business rules are in plain TypeScript services and pure domain functions, so they are unit-testable and do not depend on React or HTTP. Route handlers are 2–5 lines. |
| **PostgreSQL + Prisma, with raw SQL where Prisma can't express a rule** | Prisma gives typed queries and migrations. Exclusion constraints, CHECK constraints and the audit trigger are written as SQL in a migration, so the database itself guarantees the critical invariants. |
| **Stateless signed-cookie sessions (jose + bcrypt)** | Simple, no extra infrastructure, works on serverless. The cookie is httpOnly + SameSite=Lax + Secure (prod). Trade-off: no instant revocation (documented). |
| **Single RBAC matrix + record-level checks in services** | One file answers "who can do what". The services re-check every call, so hiding a button is never the only protection. |
| **Integer paise and fixed IST offset** | No floating-point money errors. India has no DST, so a fixed +05:30 offset is correct and keeps slot maths deterministic. |

## 3. Data model

See `docs/ER_DIAGRAM.md`. Key points:

* `User` (login, role) is linked 1:1 to `Doctor`, `StaffMember` or `Patient`.
* `DoctorSchedule` stores weekly windows in local minutes. Slots are derived from it, not stored.
* `Appointment` → optional `Encounter` (visit, unique per appointment) → `ClinicalNote`, `Prescription`, `DiagnosticReport` (metadata).
* `Invoice` (unique per appointment/visit) → `InvoiceLineItem`, `Payment`.
* `AuditLog` is append-only.
* Indexes back the search and listing paths (name, phone, doctor+time, patient+time, status+time, audit by entity/patient/actor/time).

## 4. Protecting critical actions

| Risk | Mechanism |
|---|---|
| Two bookings for the same doctor/time (including races) | DB **exclusion constraint** on `tsrange(start,end)` per doctor for active statuses → `409 SLOT_UNAVAILABLE`. Same per patient. |
| Stale availability on screen | Server re-validates the slot; on 409 the UI reloads the slot grid and asks for another time. |
| Double-click / network retry creates duplicates | `Idempotency-Key` header → unique column; replays return the original (`200 Idempotent-Replayed`). Concurrent identical requests collapse to one row. |
| Acting on an out-of-date record | Optimistic locking via `version` → `409 STALE_VERSION`. |
| Invalid workflow jumps (e.g. complete before check-in, cancel a completed visit) | Explicit state machine with allowed transitions **and** roles per transition → `409 INVALID_STATE` / `403`. |
| Totals drifting from line items | Totals recomputed in the same transaction plus CHECK constraints. `reconcileInvoice()` verifies it on every invoice view and in reports. |
| Over-payment / concurrent payments | `SELECT … FOR UPDATE` on the invoice, balance includes PENDING payments, `CHECK amountPaid ≤ total`, idempotent payment keys. |
| Tampering with the audit trail | DB trigger blocks UPDATE/DELETE on `AuditLog`. |

## 5. Security & privacy

* Server-side authorization on every page, route and service; denied attempts are audited (`ACCESS_DENIED`).
* Front desk never receives clinical content. Clinicians read visits only within a care relationship and write only their own open visits. Admin clinical access is read-only and audited. Patients see only their own finalized visits, without clinician notes.
* Zod validation on every input, predictable error envelope, no stack traces leaked (500s carry a generic message).
* Passwords hashed with bcrypt. Login failures are audited, and the response time does not reveal whether an account exists.
* No secrets in git (`.env*` ignored, `.env.example` only). Demo accounts are dummy. All data is synthetic. Audit metadata stores field names, not PHI values.

## 6. Testing strategy

* **Unit tests** for pure rules: slot generation and alignment, state machine, permission matrix, invoice math and reconciliation, IST time helpers, validation schemas, and OpenAPI completeness.
* **Integration/API tests** call the real Next.js route handlers with signed session cookies against a real PostgreSQL database (migrated fresh per run). They include negative and conflict cases: 10 concurrent bookings for one slot (exactly one succeeds), concurrent duplicate submits, concurrent payments, stale versions, illegal transitions, cross-role and cross-record access, malformed JSON, forged tokens.
* **CI** (GitHub Actions) runs lint, typecheck, the full suite with coverage against a Postgres 16 service, a clean `migrate reset` + seed, and a production build on every PR and on `main`.

| Acceptance test | Test |
|---|---|
| Book an available slot | `appointments.test.ts` AT-1 |
| Prevent conflicts incl. concurrent | `appointments.test.ts` AT-2 |
| Only authorized roles read/update | `visits-access.test.ts` AT-3, `patients-directory.test.ts`, `billing.test.ts` |
| Invoice reconciles with lines & payment status | `billing.test.ts` AT-4, `billing-math.test.ts` |
| Sensitive access/edits audited | `visits-access.test.ts` AT-5 and audit assertions throughout |

## 7. Trade-offs and what I would do next

* **Sessions:** add a server-side session table for revocation, plus rate limiting and lockout on login.
* **Scheduling:** doctor leave/holidays, buffer times, waitlists, and SMS/e-mail reminders.
* **Clinical:** structured vitals, ICD-coded diagnoses entered by clinicians, real file storage for reports (S3-compatible) with signed URLs.
* **Billing:** refunds/credit notes, insurance/TPA claims, GST invoices, a real payment provider via webhooks (the PENDING → settled design already fits webhook confirmation).
* **Ops:** Playwright end-to-end tests in CI, structured logging and tracing, per-reviewer demo data reset.

## 8. Development process

The repository history follows the stages of the build. Each feature was developed on its own branch with small conventional
commits, verified (lint, typecheck, tests), opened as a pull request with a description, and merged into `main`:
schema → auth/RBAC → directory → scheduling → visits → billing → audit/reports → UI polish → CI/tests → docs.
