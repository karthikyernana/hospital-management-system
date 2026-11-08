import { describe, expect, it } from "vitest";
import { addDays, localDayOfWeek, localMidnightUtc, localMinuteOfDay, toLocalDateString } from "@/lib/time";
import { bookAppointmentInput, idempotencyKey } from "@/lib/validation/appointment";
import { patientInput } from "@/lib/validation/patient";

describe("IST time helpers", () => {
  it("maps a local date to the UTC instant of local midnight (+05:30)", () => {
    expect(localMidnightUtc("2026-11-09").toISOString()).toBe("2026-11-08T18:30:00.000Z");
  });
  it("derives local date, weekday and minute-of-day across the UTC date line", () => {
    const d = new Date("2026-11-08T19:00:00.000Z"); // 00:30 IST on Monday 9 Nov
    expect(toLocalDateString(d)).toBe("2026-11-09");
    expect(localDayOfWeek(d)).toBe(1);
    expect(localMinuteOfDay(d)).toBe(30);
  });
  it("adds calendar days including month boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("server-side validation schemas", () => {
  it("requires an ISO timestamp with offset for bookings", () => {
    expect(bookAppointmentInput.safeParse({ patientId: "p", doctorId: "d", startTime: "tomorrow 10am" }).success).toBe(false);
    const ok = bookAppointmentInput.parse({ patientId: "p", doctorId: "d", startTime: "2026-11-09T03:30:00Z" });
    expect(ok.startTime).toBeInstanceOf(Date);
  });
  it("rejects malformed idempotency keys", () => {
    expect(idempotencyKey.safeParse("short").success).toBe(false);
    expect(idempotencyKey.safeParse("has spaces in it").success).toBe(false);
    expect(idempotencyKey.safeParse("2f1c9a3e-0d4b-4a8e-9c1f-7b5e6d4c3b2a").success).toBe(true);
  });
  it("normalises empty optional form fields and validates phone/email", () => {
    const parsed = patientInput.parse({ firstName: "A", lastName: "B", dateOfBirth: "1990-01-01", gender: "OTHER", phone: "+91 90000 00000", email: "", bloodGroup: "", address: "  " });
    expect(parsed.email).toBeUndefined();
    expect(parsed.bloodGroup).toBeUndefined();
    expect(parsed.address).toBeUndefined();
    expect(patientInput.safeParse({ firstName: "A", lastName: "B", dateOfBirth: "1990-01-01", gender: "OTHER", phone: "12" }).success).toBe(false);
  });
});
