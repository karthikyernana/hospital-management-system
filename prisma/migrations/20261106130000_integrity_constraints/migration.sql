-- Business-rule constraints that Prisma's schema language cannot express.
-- They are the last line of defence: services validate first, the database
-- guarantees integrity even under concurrent requests.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1) A doctor can never have two *active* appointments that overlap in time.
--    Cancelled / no-show appointments free the slot again.
ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_doctor_no_overlap"
  EXCLUDE USING gist (
    "doctorId" WITH =,
    tsrange("startTime", "endTime", '[)') WITH &&
  ) WHERE ("status" IN ('SCHEDULED', 'CHECKED_IN', 'COMPLETED'));

-- 2) A patient cannot be double-booked at overlapping times either.
ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_patient_no_overlap"
  EXCLUDE USING gist (
    "patientId" WITH =,
    tsrange("startTime", "endTime", '[)') WITH &&
  ) WHERE ("status" IN ('SCHEDULED', 'CHECKED_IN', 'COMPLETED'));

ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_time_order" CHECK ("endTime" > "startTime");

-- 3) Schedules: valid weekday and time window.
ALTER TABLE "DoctorSchedule"
  ADD CONSTRAINT "schedule_valid_window" CHECK (
    "dayOfWeek" BETWEEN 0 AND 6
    AND "startMinute" >= 0 AND "endMinute" <= 1440
    AND "endMinute" > "startMinute"
  );

ALTER TABLE "Doctor"
  ADD CONSTRAINT "doctor_slot_minutes" CHECK ("slotMinutes" BETWEEN 5 AND 240),
  ADD CONSTRAINT "doctor_fee_non_negative" CHECK ("consultationFeeCents" >= 0);

-- 4) Invoice line items must be internally consistent.
ALTER TABLE "InvoiceLineItem"
  ADD CONSTRAINT "line_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "line_price_non_negative" CHECK ("unitPriceCents" >= 0),
  ADD CONSTRAINT "line_tax_rate_range" CHECK ("taxRateBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "line_total_matches" CHECK ("lineTotalCents" = "quantity" * "unitPriceCents" + "taxCents");

-- 5) Invoice totals reconcile and payments never exceed the total.
ALTER TABLE "Invoice"
  ADD CONSTRAINT "invoice_total_matches" CHECK ("totalCents" = "subtotalCents" + "taxCents" - "discountCents"),
  ADD CONSTRAINT "invoice_amounts_non_negative" CHECK (
    "subtotalCents" >= 0 AND "taxCents" >= 0 AND "discountCents" >= 0
    AND "totalCents" >= 0 AND "amountPaidCents" >= 0
  ),
  ADD CONSTRAINT "invoice_not_overpaid" CHECK ("amountPaidCents" <= "totalCents");

ALTER TABLE "Payment"
  ADD CONSTRAINT "payment_amount_positive" CHECK ("amountCents" > 0);

-- 6) Audit log is append-only: block UPDATE and DELETE at the database level.
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
