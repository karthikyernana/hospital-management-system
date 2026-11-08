# Test evidence

Captured from `npm run test:coverage` / `npx vitest run --reporter=verbose` against PostgreSQL 17 (local) on 2026-11-06. CI runs the same suite on every pull request against PostgreSQL 16 (see the Actions tab).

## Summary

```
 Test Files  12 passed (12)
      Tests  85 passed (85)
Statements   : 84.01% ( 1430/1702 )
Branches     : 76.75% ( 350/456 )
Functions    : 86.44% ( 102/118 )
Lines        : 84.01% ( 1430/1702 )
```

## Acceptance tests → test cases

| Acceptance test | Test cases (all passing) |
|---|---|
| 1. Book a patient into an available slot | `appointments.test.ts › AT-1` (3 cases) |
| 2. Conflicts prevented, incl. concurrent attempts | `appointments.test.ts › AT-2` (4 cases, incl. 10 parallel requests → 1×201 + 9×409) and `idempotent booking` (3 cases), `reschedule, cancel and state transitions` |
| 3. Only authorized roles read/update patient & visit info | `visits-access.test.ts › AT-3` (7 cases), `patients-directory.test.ts`, `billing.test.ts › billing authorization`, `reports-audit.test.ts › audit log API` |
| 4. Invoice reconciles with line items and payment status | `billing.test.ts › AT-4` (8 cases incl. concurrent over-payment race), `billing-math.test.ts` |
| 5. Sensitive access/edits produce audit entries | `visits-access.test.ts › AT-5` (incl. DB-level append-only), plus audit assertions in auth, patient, booking, billing tests |

## Full list of test cases

```
✓ tests/integration/appointments.test.ts > AT-1: booking an available slot > books a free slot, marks it unavailable and audits the creation
✓ tests/integration/appointments.test.ts > AT-1: booking an available slot > lets a patient book for themselves but not for someone else
✓ tests/integration/appointments.test.ts > AT-1: booking an available slot > rejects past, misaligned and out-of-hours times with 422
✓ tests/integration/appointments.test.ts > AT-2: conflicting appointments are prevented > rejects a second booking for the same doctor and slot with 409 SLOT_UNAVAILABLE
✓ tests/integration/appointments.test.ts > AT-2: conflicting appointments are prevented > allows exactly one of 10 concurrent bookings for the same slot
✓ tests/integration/appointments.test.ts > AT-2: conflicting appointments are prevented > prevents double-booking the same patient with two doctors at once
✓ tests/integration/appointments.test.ts > AT-2: conflicting appointments are prevented > frees the slot when an appointment is cancelled
✓ tests/integration/appointments.test.ts > idempotent booking > replays the original appointment for a repeated Idempotency-Key
✓ tests/integration/appointments.test.ts > idempotent booking > collapses concurrent duplicate submissions into one appointment
✓ tests/integration/appointments.test.ts > idempotent booking > rejects reuse of a key for a different request
✓ tests/integration/appointments.test.ts > reschedule, cancel and state transitions > reschedules to a free slot and bumps the version
✓ tests/integration/appointments.test.ts > reschedule, cancel and state transitions > refuses to reschedule into a taken slot or with a stale version
✓ tests/integration/appointments.test.ts > reschedule, cancel and state transitions > enforces the state machine and role rules for transitions
✓ tests/integration/appointments.test.ts > reschedule, cancel and state transitions > scopes appointment lists by role
✓ tests/integration/billing.test.ts > AT-4: invoice reconciles with line items and payment status > creates a draft from a completed appointment with the consultation fee
✓ tests/integration/billing.test.ts > AT-4: invoice reconciles with line items and payment status > recomputes totals as line items, tax and discount change
✓ tests/integration/billing.test.ts > AT-4: invoice reconciles with line items and payment status > rejects a discount larger than the invoice
✓ tests/integration/billing.test.ts > AT-4: invoice reconciles with line items and payment status > cannot be paid while DRAFT; issuing locks the line items
✓ tests/integration/billing.test.ts > AT-4: invoice reconciles with line items and payment status > requires an Idempotency-Key for payments
✓ tests/integration/billing.test.ts > AT-4: invoice reconciles with line items and payment status > a declined sandbox payment is recorded as FAILED and leaves the balance unchanged
✓ tests/integration/billing.test.ts > AT-4: invoice reconciles with line items and payment status > partial then final payment moves the invoice to PAID; retries are idempotent
✓ tests/integration/billing.test.ts > AT-4: invoice reconciles with line items and payment status > concurrent payments can never over-pay an invoice
✓ tests/integration/billing.test.ts > billing authorization > clinicians cannot access billing; patients only their own invoices and cannot create them
✓ tests/integration/billing.test.ts > billing authorization > invoice reads are audited
✓ tests/integration/billing.test.ts > billing authorization > only draft/issued invoices without payments can be voided
✓ tests/integration/visits-access.test.ts > starting a visit > front desk cannot start a visit (403)
✓ tests/integration/visits-access.test.ts > starting a visit > a clinician cannot start a visit for another doctor's appointment
✓ tests/integration/visits-access.test.ts > starting a visit > the treating clinician starts exactly one visit per appointment
✓ tests/integration/visits-access.test.ts > AT-3: only authorized roles read/update visit information > treating clinician writes notes, prescriptions and diagnostics — each audited
✓ tests/integration/visits-access.test.ts > AT-3: only authorized roles read/update visit information > front desk can neither read nor write clinical content
✓ tests/integration/visits-access.test.ts > AT-3: only authorized roles read/update visit information > a clinician without a care relationship cannot read the visit; the denial is audited
✓ tests/integration/visits-access.test.ts > AT-3: only authorized roles read/update visit information > administrators get read-only access
✓ tests/integration/visits-access.test.ts > AT-3: only authorized roles read/update visit information > patients cannot see an open visit, and see finalized visits without clinician notes
✓ tests/integration/visits-access.test.ts > AT-3: only authorized roles read/update visit information > finalizing completes the appointment and locks the record
✓ tests/integration/visits-access.test.ts > AT-3: only authorized roles read/update visit information > diagnostic results can still be recorded after finalization, exactly once
✓ tests/integration/visits-access.test.ts > AT-5: sensitive record access produces audit entries > every successful visit read is logged with actor, role and patient
✓ tests/integration/visits-access.test.ts > AT-5: sensitive record access produces audit entries > the audit log is append-only at the database level
✓ tests/integration/patients-directory.test.ts > patient registry > front desk registers a patient and the server assigns the next MRN
✓ tests/integration/patients-directory.test.ts > patient registry > rejects invalid input with field-level errors
✓ tests/integration/patients-directory.test.ts > patient registry > clinicians cannot register patients (server-side 403, audited)
✓ tests/integration/patients-directory.test.ts > patient registry > searches by name, MRN or phone with pagination
✓ tests/integration/patients-directory.test.ts > patient registry > reading a patient chart writes a READ audit entry
✓ tests/integration/patients-directory.test.ts > patient registry > a patient can read their own record but not another patient's
✓ tests/integration/patients-directory.test.ts > patient registry > updates are audited with field names only (no PHI values)
✓ tests/integration/patients-directory.test.ts > patient registry > returns 404 for an unknown patient
✓ tests/integration/patients-directory.test.ts > directory & schedules > lists doctors filtered by department
✓ tests/integration/patients-directory.test.ts > directory & schedules > detects overlapping schedule windows
✓ tests/integration/patients-directory.test.ts > directory & schedules > only admins can replace a schedule; overlapping windows are rejected
✓ tests/integration/reports-audit.test.ts > appointment & billing reports > summarises appointments by status, doctor and rates
✓ tests/integration/reports-audit.test.ts > appointment & billing reports > summarises billing and confirms every invoice reconciles
✓ tests/integration/reports-audit.test.ts > appointment & billing reports > validates the date range and restricts billing reports
✓ tests/integration/reports-audit.test.ts > audit log API > is readable by administrators only
✓ tests/integration/reports-audit.test.ts > audit log API > filters entries by patient and action
✓ tests/integration/api-contract.test.ts > API contract > returns { error: { code, message } } for malformed JSON
✓ tests/integration/api-contract.test.ts > API contract > rejects a tampered session token
✓ tests/integration/api-contract.test.ts > API contract > validates query strings (page size is capped)
✓ tests/integration/api-contract.test.ts > API contract > maps unknown records to 404 NOT_FOUND
✓ tests/integration/auth.test.ts > authentication > logs in with valid credentials, sets an httpOnly cookie and audits the login
✓ tests/integration/auth.test.ts > authentication > rejects a wrong password with 401 and records LOGIN_FAILED
✓ tests/integration/auth.test.ts > authentication > validates the login body
✓ tests/integration/auth.test.ts > authentication > returns 401 for API calls without a session
✓ tests/unit/time-and-validation.test.ts > IST time helpers > maps a local date to the UTC instant of local midnight (+05:30)
✓ tests/unit/time-and-validation.test.ts > IST time helpers > derives local date, weekday and minute-of-day across the UTC date line
✓ tests/unit/time-and-validation.test.ts > IST time helpers > adds calendar days including month boundaries
✓ tests/unit/time-and-validation.test.ts > server-side validation schemas > requires an ISO timestamp with offset for bookings
✓ tests/unit/time-and-validation.test.ts > server-side validation schemas > rejects malformed idempotency keys
✓ tests/unit/time-and-validation.test.ts > server-side validation schemas > normalises empty optional form fields and validates phone/email
✓ tests/unit/billing-math.test.ts > invoice arithmetic > computes per-line tax with half-up rounding
✓ tests/unit/billing-math.test.ts > invoice arithmetic > sums lines, applies the discount and rejects impossible discounts
✓ tests/unit/billing-math.test.ts > reconcileInvoice > accepts a consistent invoice
✓ tests/unit/billing-math.test.ts > reconcileInvoice > flags totals that do not match the line items
✓ tests/unit/billing-math.test.ts > reconcileInvoice > flags status that does not match payments
✓ tests/unit/slots-and-state.test.ts > slot generation (IST) > cuts working windows into fixed slots and drops partial tails
✓ tests/unit/slots-and-state.test.ts > slot generation (IST) > returns no slots on a day without a schedule
✓ tests/unit/slots-and-state.test.ts > slot generation (IST) > accepts only aligned starts inside a window
✓ tests/unit/slots-and-state.test.ts > slot generation (IST) > detects overlapping intervals (half-open)
✓ tests/unit/slots-and-state.test.ts > appointment state machine > allows the happy path and cancellation only from SCHEDULED
✓ tests/unit/slots-and-state.test.ts > appointment state machine > treats COMPLETED, CANCELLED and NO_SHOW as terminal
✓ tests/unit/slots-and-state.test.ts > appointment state machine > throws INVALID_STATE (409) for illegal jumps
✓ tests/unit/permissions.test.ts > RBAC permission matrix > never lets front desk read or write clinical visit records
✓ tests/unit/permissions.test.ts > RBAC permission matrix > lets only clinicians write visit records
✓ tests/unit/permissions.test.ts > RBAC permission matrix > restricts the audit log to administrators
✓ tests/unit/permissions.test.ts > RBAC permission matrix > does not let clinicians or patients manage the directory or billing back-office
✓ tests/unit/permissions.test.ts > RBAC permission matrix > assertCan throws a 403 AppError
✓ tests/unit/openapi.test.ts > OpenAPI spec > documents every API route
```

## Coverage by file (server + lib)

```
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
All files          |   84.01 |    76.75 |   86.44 |   84.01 |                   
  api-client.ts    |       0 |      100 |     100 |       0 | 2-37              
  format.ts        |       0 |        0 |       0 |       0 | 1-24              
  money.ts         |   89.47 |      100 |   66.66 |   89.47 | 43-44             
  time.ts          |   58.49 |    85.71 |   66.66 |   58.49 | 47-50,54-64,67-73 
  appointment.ts   |     100 |      100 |     100 |     100 |                   
  auth.ts          |     100 |      100 |     100 |     100 |                   
  billing.ts       |     100 |      100 |     100 |     100 |                   
  common.ts        |     100 |      100 |     100 |     100 |                   
  directory.ts     |     100 |      100 |     100 |     100 |                   
  patient.ts       |     100 |      100 |     100 |     100 |                   
  reports.ts       |     100 |      100 |     100 |     100 |                   
  visit.ts         |     100 |       50 |     100 |     100 | 16                
  db.ts            |     100 |      100 |     100 |     100 |                   
  current-user.ts  |       0 |      100 |     100 |       0 | 6-26              
  permissions.ts   |     100 |      100 |     100 |     100 |                   
  session.ts       |      96 |    86.66 |     100 |      96 | 62-63             
  ...ment-state.ts |     100 |      100 |     100 |     100 |                   
  billing.ts       |     100 |    58.82 |     100 |     100 | ...40,42-43,45-46 
  slots.ts         |     100 |     90.9 |     100 |     100 | 35                
  api.ts           |   86.66 |    81.25 |     100 |   86.66 | 52-56,60-65       
  errors.ts        |     100 |      100 |     100 |     100 |                   
  spec.ts          |     100 |      100 |     100 |     100 |                   
  ...ox-gateway.ts |     100 |       75 |     100 |     100 | 18                
  appointments.ts  |   95.38 |    73.26 |   91.66 |   95.38 | 97-103,116-117    
  audit-query.ts   |   73.33 |    33.33 |      50 |   73.33 | 32-39             
  audit.ts         |     100 |       40 |     100 |     100 | 35-39             
  auth.ts          |     100 |       60 |     100 |     100 | 16,18-32          
  billing.ts       |   87.11 |    71.76 |   93.33 |   87.11 | ...29-230,252-254 
  directory.ts     |   42.62 |       80 |   33.33 |   42.62 | ...,61-90,126-149 
  patients.ts      |   95.55 |    76.19 |     100 |   95.55 | 86-88,90          
  reports.ts       |      76 |    55.55 |      80 |      76 | 95-119            
  visits.ts        |   85.61 |    85.36 |   91.66 |   85.61 | 67-85,113-114     
```
