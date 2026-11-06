# Entity–Relationship Diagram

Source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma) and the SQL in
[`prisma/migrations`](../prisma/migrations). GitHub renders the Mermaid diagram below.

```mermaid
erDiagram
    User ||--o| Doctor : "logs in as"
    User ||--o| StaffMember : "logs in as"
    User ||--o| Patient : "portal login"
    User ||--o{ AuditLog : "acts in"

    Department ||--o{ Doctor : employs
    Department ||--o{ StaffMember : employs
    Doctor ||--o{ DoctorSchedule : "works (weekly)"

    Patient ||--o{ Appointment : books
    Doctor ||--o{ Appointment : attends
    Appointment ||--o| Encounter : "becomes visit"
    Patient ||--o{ Encounter : has
    Doctor ||--o{ Encounter : conducts
    Encounter ||--o{ ClinicalNote : contains
    Encounter ||--o{ Prescription : contains
    Encounter ||--o{ DiagnosticReport : "orders (metadata)"

    Patient ||--o{ Invoice : "is billed"
    Appointment ||--o| Invoice : "billed by"
    Encounter ||--o| Invoice : "billed by"
    Invoice ||--|{ InvoiceLineItem : itemizes
    Invoice ||--o{ Payment : "settled by"

    User {
        string id PK
        string email UK
        string passwordHash "bcrypt"
        enum role "ADMIN | FRONT_DESK | CLINICIAN | PATIENT"
        bool isActive
    }
    Department {
        string id PK
        string code UK
        string name UK
    }
    Doctor {
        string id PK
        string userId FK,UK
        string departmentId FK
        string licenseNo UK
        string specialty
        int slotMinutes "CHECK 5..240"
        int consultationFeeCents "CHECK >= 0"
    }
    DoctorSchedule {
        string id PK
        string doctorId FK
        int dayOfWeek "0=Sun..6=Sat"
        int startMinute "IST minutes"
        int endMinute "CHECK end > start"
    }
    StaffMember {
        string id PK
        string userId FK,UK
        string departmentId FK
        enum staffRole
    }
    Patient {
        string id PK
        string mrn UK
        string userId FK,UK
        date dateOfBirth
        enum gender
        string phone "indexed"
    }
    Appointment {
        string id PK
        string patientId FK
        string doctorId FK
        datetime startTime
        datetime endTime
        enum status "SCHEDULED..COMPLETED/CANCELLED/NO_SHOW"
        string idempotencyKey UK
        int version "optimistic lock"
    }
    Encounter {
        string id PK
        string appointmentId FK,UK
        string patientId FK
        string doctorId FK
        enum status "OPEN | FINALIZED"
    }
    ClinicalNote {
        string id PK
        string encounterId FK
        string authorId
        text body
    }
    Prescription {
        string id PK
        string encounterId FK
        string medication
        string dosage
        int durationDays
    }
    DiagnosticReport {
        string id PK
        string encounterId FK
        string testName
        enum status "ORDERED | RESULTED"
        string fileName "metadata only"
    }
    Invoice {
        string id PK
        string number UK
        string patientId FK
        enum status "DRAFT | ISSUED | PAID | VOID"
        int subtotalCents
        int taxCents
        int discountCents
        int totalCents "CHECK = subtotal + tax - discount"
        int amountPaidCents "CHECK <= total"
    }
    InvoiceLineItem {
        string id PK
        string invoiceId FK
        enum category
        int quantity "CHECK > 0"
        int unitPriceCents
        int taxRateBps
        int lineTotalCents "CHECK = qty*unit + tax"
    }
    Payment {
        string id PK
        string invoiceId FK
        int amountCents "CHECK > 0"
        enum status "PENDING | SUCCEEDED | FAILED"
        string providerRef UK "sandbox_*"
        string idempotencyKey UK
    }
    AuditLog {
        string id PK
        string actorId FK
        enum actorRole
        string action
        string entityType
        string entityId
        string patientId "indexed"
        json metadata
        datetime createdAt
    }
```

## Integrity rules enforced by the database

| Rule | Mechanism |
|---|---|
| No two active appointments overlap for the same doctor | `EXCLUDE USING gist (doctorId WITH =, tsrange(start,end) WITH &&) WHERE status IN (SCHEDULED, CHECKED_IN, COMPLETED)` |
| A patient is never double-booked | Same exclusion constraint on `patientId` |
| Duplicate "book" submissions create one appointment | `UNIQUE(idempotencyKey)` |
| One visit per appointment, one invoice per visit | `UNIQUE(appointmentId)` on Encounter / Invoice |
| Line totals and invoice totals reconcile | `CHECK` constraints on `InvoiceLineItem` and `Invoice` |
| An invoice can never be over-paid | `CHECK (amountPaidCents <= totalCents)` |
| Duplicate payment submissions are charged once | `UNIQUE(idempotencyKey)` on Payment |
| Audit trail cannot be edited or deleted | `BEFORE UPDATE OR DELETE` trigger raising an exception |

## Indexes
Search and listing paths are indexed: patient name/phone, appointments by
`(doctorId,startTime)`, `(patientId,startTime)`, `(status,startTime)`, invoices by
`(status,createdAt)`, audit log by entity, patient, actor and time.
