import { describe, expect, it } from "vitest";
import { generateSlots, isValidSlotStart, overlaps } from "@/server/domain/slots";
import { assertTransition, canTransition } from "@/server/domain/appointment-state";
import { localMidnightUtc, addMinutes } from "@/lib/time";

// 2026-11-09 is a Monday.
const MON = "2026-11-09";
const windows = [
  { dayOfWeek: 1, startMinute: 9 * 60, endMinute: 13 * 60 },
  { dayOfWeek: 1, startMinute: 14 * 60, endMinute: 15 * 60 + 10 },
];

describe("slot generation (IST)", () => {
  it("cuts working windows into fixed slots and drops partial tails", () => {
    const slots = generateSlots(MON, windows, 30);
    expect(slots).toHaveLength(8 + 2); // 09:00–13:00 = 8, 14:00–15:10 = 2 full slots
    expect(slots[0].start.toISOString()).toBe("2026-11-09T03:30:00.000Z"); // 09:00 IST
    expect(slots[0].end.toISOString()).toBe("2026-11-09T04:00:00.000Z");
  });

  it("returns no slots on a day without a schedule", () => {
    expect(generateSlots("2026-11-10", windows, 30)).toEqual([]);
  });

  it("accepts only aligned starts inside a window", () => {
    const midnight = localMidnightUtc(MON);
    expect(isValidSlotStart(addMinutes(midnight, 9 * 60 + 30), windows, 30)).toBe(true);
    expect(isValidSlotStart(addMinutes(midnight, 9 * 60 + 15), windows, 30)).toBe(false); // misaligned
    expect(isValidSlotStart(addMinutes(midnight, 12 * 60 + 45), windows, 30)).toBe(false); // runs past 13:00
    expect(isValidSlotStart(addMinutes(midnight, 13 * 60 + 30), windows, 30)).toBe(false); // lunch break
    expect(isValidSlotStart(addMinutes(localMidnightUtc("2026-11-10"), 9 * 60), windows, 30)).toBe(false); // Tuesday
  });

  it("detects overlapping intervals (half-open)", () => {
    const a = { start: new Date("2026-01-01T10:00:00Z"), end: new Date("2026-01-01T10:30:00Z") };
    expect(overlaps(a, { start: new Date("2026-01-01T10:29:00Z"), end: new Date("2026-01-01T11:00:00Z") })).toBe(true);
    expect(overlaps(a, { start: new Date("2026-01-01T10:30:00Z"), end: new Date("2026-01-01T11:00:00Z") })).toBe(false);
  });
});

describe("appointment state machine", () => {
  it("allows the happy path and cancellation only from SCHEDULED", () => {
    expect(canTransition("SCHEDULED", "CHECKED_IN")).toBe(true);
    expect(canTransition("CHECKED_IN", "COMPLETED")).toBe(true);
    expect(canTransition("SCHEDULED", "CANCELLED")).toBe(true);
    expect(canTransition("CHECKED_IN", "CANCELLED")).toBe(false);
  });

  it("treats COMPLETED, CANCELLED and NO_SHOW as terminal", () => {
    for (const from of ["COMPLETED", "CANCELLED", "NO_SHOW"] as const) {
      for (const to of ["SCHEDULED", "CHECKED_IN", "COMPLETED", "CANCELLED", "NO_SHOW"] as const) {
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });

  it("throws INVALID_STATE (409) for illegal jumps", () => {
    expect(() => assertTransition("SCHEDULED", "COMPLETED")).toThrowError(expect.objectContaining({ code: "INVALID_STATE", status: 409 }));
  });
});
