# Hospital Management System

**ALGIONS AI LABS: Full-Stack Web Development assessment** · Candidate: Yernana Karthik (Reg. No. 12319251, LPU)

A database-backed web application for running a hospital's front office and clinics. It covers the patient & staff
directory, doctor schedules, appointment booking with conflict prevention, clinical visit records, itemized billing
with a sandbox payment flow, server-side role-based access control, an append-only audit trail, and reports.

| | |
|---|---|
| **Live demo** | https://algions-hospital-management-system.vercel.app |
| **API docs (Swagger UI)** | https://algions-hospital-management-system.vercel.app/docs · raw spec: [`/api/openapi.json`](https://algions-hospital-management-system.vercel.app/api/openapi.json) · file: [`docs/openapi.json`](docs/openapi.json) |
| **ER diagram** | [`docs/ER_DIAGRAM.md`](docs/ER_DIAGRAM.md) |
| **Architecture** | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| **Technical report** | [`TECHNICAL_REPORT.md`](TECHNICAL_REPORT.md) |
| **Test evidence** | [`docs/TEST_EVIDENCE.md`](docs/TEST_EVIDENCE.md) · CI: GitHub Actions (`.github/workflows/ci.yml`) |

All data is **synthetic**. All credentials below are **dummy demo accounts**.

---

## Demo accounts

Password for every account: **`Demo@12345`** (the login page has one-click buttons that fill them in).

| Role | Email | What to try |
|---|---|---|
| Front desk | `frontdesk@hms.test` | Register a patient, book/reschedule/cancel, check in, create & issue an invoice, take a payment |
| Clinician | `dr.mehta@hms.test` (also `dr.iyer@hms.test`, …) | See own diary, start a visit for a checked-in patient, add notes / prescriptions / tests, finalize |
| Administrator | `admin@hms.test` | Manage directory & schedules, read-only clinical oversight, reports, **audit log** |
| Patient (portal) | `patient@hms.test` | Book own appointment, cancel/reschedule, view prescriptions, pay a bill online (sandbox) |

### 3-minute reviewer journey
1. **Front desk** → *Book appointment* → pick a doctor, a date and an open slot → choose a patient → *Confirm booking*.
2. Open the appointment → **Check in**.
3. **Clinician** (the doctor you booked) → *Appointments* → open it → **Start visit** → add a note and a prescription → **Finalize visit** (the appointment becomes *Completed*).
4. **Front desk** → open the appointment → **Create invoice** (consultation fee is added) → add a pharmacy line → **Issue** → take a payment (try *Decline* first, then *Approve*). The invoice shows **Reconciled ✓** and turns *Paid*.
5. **Admin** → *Audit log* shows every read and change you just made; *Reports* shows appointment and billing summaries.
6. **Front desk** tries `/visits/<id>`: access is denied server-side and the denial is audited.

---

## Features

| Area | What is implemented |
|---|---|
| Directory | Departments, doctors (specialty, fee, slot length), staff roles, weekly working schedules (admin editor). Search, filters, pagination. |
| Patients | Registration with server-assigned MRN, validation, search by name/MRN/phone, profile with appointment and visit history. |
| Scheduling | Slot availability per doctor/day (IST), booking, reschedule, cancel, check-in, no-show, complete, enforced by a state machine. |
| Conflict prevention | PostgreSQL **exclusion constraint** (no overlapping active appointments per doctor *and* per patient), **Idempotency-Key** on booking, **optimistic locking** (`version`) on changes, and a UI that refreshes availability after a 409. |
| Visit records | Encounters linked to appointments, clinician notes, prescriptions, diagnostic-report **metadata**. No automated diagnosis. Finalization locks the record. |
| Billing | Itemized invoices (qty × unit + per-line tax − discount), DRAFT → ISSUED → PAID / VOID, partial payments, **simulated sandbox gateway** (approve/decline), idempotent payments, row-locked balance check, reconciliation check. |
| Security | Signed httpOnly session cookie, bcrypt passwords, **server-side RBAC** in every API route and every service, record-level rules (care team, own records), Zod validation, no PHI in audit metadata. |
| Audit | Append-only `AuditLog` (DB trigger blocks UPDATE/DELETE): logins, failed logins, denied access, reads of patients/visits/invoices, every create/update/status change/payment. Admin viewer with filters. |
| Reports | Appointment summary (status, department, doctor, daily volume, completion/cancel/no-show rates) and billing summary (invoiced, collected, outstanding, payments by method, reconciliation of every invoice). Role-aware dashboard. |
| UX | Responsive layout (mobile menu), labelled accessible forms, field-level errors, loading skeletons, empty/success/error states, skip link, focus styles. |

### Role → permission matrix (`src/server/auth/permissions.ts`)

| Permission | Admin | Front desk | Clinician | Patient |
|---|:-:|:-:|:-:|:-:|
| patient:read / write | ✓ / ✓ | ✓ / ✓ | ✓ / – | own record only |
| directory:read / write | ✓ / ✓ | ✓ / – | ✓ / – | ✓ / – |
| appointment:read / write | ✓ / ✓ | ✓ / ✓ | own diary | own only |
| visit:read | ✓ (read-only, audited) | **–** | care team only | own finalized, no notes |
| visit:write | – | – | treating clinician, open visit | – |
| billing:read / write | ✓ / ✓ | ✓ / ✓ | – | own invoices / pay only |
| report:read | ✓ | ✓ (billing + appointments) | – | – |
| audit:read | ✓ | – | – | – |

---

## Architecture (summary)

A **modular monolith** on Next.js 15 (App Router) with three layers. Details and diagrams: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```
src/
  app/                 UI (React Server + Client Components) and HTTP route handlers (app/api/**/route.ts)
  components/          Reusable UI (accessible form controls, tables, slot picker, invoice views)
  lib/                 Shared pure code: Zod schemas, IST time helpers, invoice math, formatting
  server/
    auth/              Session (JWT cookie), RBAC permission matrix, page guards
    http/              Route wrapper (auth → RBAC → validation → error mapping), typed AppErrors
    domain/            Pure business rules: slot generation, appointment state machine, invoice reconciliation
    services/          Use cases: patients, directory, appointments, visits, billing, reports, audit
    payments/          Sandbox payment gateway (simulated)
    openapi/           OpenAPI 3.1 spec (served at /api/openapi.json, rendered at /docs)
prisma/                schema.prisma, SQL migrations (incl. constraints/triggers), deterministic seed
tests/                 Vitest unit + integration (real PostgreSQL) tests
```

UI pages call services directly (server components). Mutations go through the JSON API, so the browser and the
tests exercise the same validation, authorization and transaction code.

---

## Tech stack

Next.js 15 (App Router, TypeScript) · React 19 · Tailwind CSS 4 · Prisma 6 · PostgreSQL 16/17 (Neon on the demo) ·
Zod · jose (JWT) · bcryptjs · Vitest 3 (+ v8 coverage) · GitHub Actions · Vercel (free tier).

---

## Local setup

**Prerequisites:** Node.js ≥ 20, PostgreSQL ≥ 14 (needs the `btree_gist` extension, which ships with standard PostgreSQL).

```bash
git clone https://github.com/karthikyernana/hospital-management-system.git
cd hospital-management-system
cp .env.example .env            # then edit DATABASE_URL and AUTH_SECRET
npm install                      # also runs `prisma generate`
createdb hms                     # or: psql -c 'CREATE DATABASE hms'
npm run db:deploy                # apply migrations
npm run db:seed                  # load synthetic demo data (safe to re-run; it wipes and reseeds)
npm run dev                      # http://localhost:3000
```

Production build: `npm run build && npm start`.

### Environment variables

| Variable | Required | Description |
|---|:-:|---|
| `DATABASE_URL` | yes | PostgreSQL connection string, e.g. `postgresql://postgres:postgres@localhost:5432/hms?schema=public` |
| `AUTH_SECRET` | yes | ≥ 32 random characters used to sign session cookies (`openssl rand -base64 48`) |
| `TEST_DATABASE_URL` | tests only | Database the test suite **resets**; defaults to `postgresql://postgres:postgres@localhost:5432/hms_test` |

Only `.env.example` (placeholders) is committed. No real secrets are in the repository.

### Database

* Schema: [`prisma/schema.prisma`](prisma/schema.prisma) · Migrations: [`prisma/migrations`](prisma/migrations) (the second migration adds the
  exclusion constraints, CHECK constraints and the append-only audit trigger).
* `npm run db:migrate`: create/apply migrations in development · `npm run db:deploy`: apply in CI/production ·
  `npm run db:reset`: drop, re-migrate and re-seed.
* Seed data is deterministic and **relative to today**, so there is always past history and future open slots. Re-run `npm run db:seed` to refresh.

---

## Tests

```bash
createdb hms_test                # once
npm test                         # all unit + integration tests (resets hms_test first)
npm run test:coverage            # same, with coverage report in ./coverage
npm run lint && npm run typecheck
```

85 tests in 12 files. Integration tests call the real route handlers against PostgreSQL. Acceptance-test mapping:

| Acceptance test | Where it is proven |
|---|---|
| 1. A patient can be booked into an available slot | `tests/integration/appointments.test.ts` → *AT-1* |
| 2. Conflicting appointments are prevented, incl. concurrent attempts | `appointments.test.ts` → *AT-2* (10 parallel requests → exactly 1 booked, 9 × 409), patient double-booking, reschedule into a taken slot, idempotent duplicate submits |
| 3. Only authorized roles read/update patient/visit info | `tests/integration/visits-access.test.ts` → *AT-3*; `patients-directory.test.ts`; `billing.test.ts` (authorization) |
| 4. Invoice reconciles with line items and payment status | `tests/integration/billing.test.ts` → *AT-4* (+ concurrent over-payment race); `tests/unit/billing-math.test.ts` |
| 5. Sensitive access/edits produce audit entries | `visits-access.test.ts` → *AT-5* (+ DB-level append-only check); audit assertions in patient, booking and billing tests |

See [`docs/TEST_EVIDENCE.md`](docs/TEST_EVIDENCE.md) for a captured run and coverage.

---

## API

JSON over HTTP, cookie session. Success: `{ "data": … }`. Failure: `{ "error": { "code", "message", "details?" } }` with
codes `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `VALIDATION_ERROR` 422, `CONFLICT` / `SLOT_UNAVAILABLE` /
`INVALID_STATE` / `STALE_VERSION` 409, `IDEMPOTENCY_MISMATCH` 422. Full reference: **`/docs`** (Swagger UI) or
[`docs/openapi.json`](docs/openapi.json). A unit test fails if any route handler is missing from the spec.

```bash
# example: sign in and book with an idempotency key
curl -c c.txt -X POST $BASE/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"frontdesk@hms.test","password":"Demo@12345"}'
curl -b c.txt "$BASE/api/doctors/<doctorId>/availability?date=2026-11-16"
curl -b c.txt -X POST $BASE/api/appointments -H 'content-type: application/json' \
  -H 'Idempotency-Key: 6f1d2c1e-4b7a-4c55-9f0e-1a2b3c4d5e6f' \
  -d '{"patientId":"<id>","doctorId":"<id>","startTime":"2026-11-16T03:30:00.000Z","reason":"Check-up"}'
```

---

## Deployment (demo)

The demo runs on **Vercel (free tier)** with a **Neon PostgreSQL (free plan)** database provisioned through the Vercel
Neon integration. Migrations were applied with `prisma migrate deploy` and the synthetic seed was loaded. Runtime env vars:
`DATABASE_URL` (Neon pooled), `AUTH_SECRET`. No paid services are used.

---

## Known limitations / assumptions

* **Single hospital, single time zone.** Times are stored in UTC; scheduling assumes IST (UTC+05:30, no DST).
* **Payments are simulated.** The sandbox gateway approves or declines on request; no card data is collected and no real provider is called. Refunds are not implemented.
* **Diagnostic reports store metadata only** (test name, status, clinician-entered summary, file *name*). No file upload or storage.
* **No automated diagnosis or clinical decision support**, by design.
* **Sessions are stateless JWTs** (8 h). There is no server-side revocation list, password reset or MFA. Login has no rate limiting yet (failed logins are audited).
* **Schedule changes do not move existing appointments.** They only affect future availability; leave/holiday calendars are not modelled.
* **Notifications** (SMS/e-mail reminders) are not implemented.
* Admins have **read-only** clinical access (oversight). There is no "break-glass" workflow.
* The demo database is shared by all reviewers and seeded relative to the seed date. Over time seeded appointments move into the past; re-running the seed refreshes them.
* Audit metadata deliberately records *field names*, not values, so PHI does not leak into the log.
* End-to-end browser tests are not in CI. The booking journey was verified manually with Playwright screenshots during development.

## AI usage & attribution

AI assistance was used for scaffolding, drafting code and documentation under the candidate's direction. The candidate reviewed the
design decisions and can explain and modify every part of the code. Libraries: Next.js, React, Tailwind CSS, Prisma, Zod,
jose, bcryptjs, Vitest, Swagger UI (CDN). All names and records in the seed are synthetic.

## Screenshots

| Booking with live slot picker | Front-desk dashboard |
|---|---|
| ![Booking](docs/screenshots/desk-booking.png) | ![Dashboard](docs/screenshots/desk-dashboard.png) |
| **Reports (admin)** | **Patient portal** |
| ![Reports](docs/screenshots/admin-reports.png) | ![Portal](docs/screenshots/patient-portal.png) |
| **Audit log (admin)** | **Mobile layout** |
| ![Audit](docs/screenshots/admin-audit.png) | ![Mobile](docs/screenshots/mobile-appointments.png) |
