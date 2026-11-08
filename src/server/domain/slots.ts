/**
 * Slot generation — pure functions (unit tested).
 * A doctor's weekly schedule windows are cut into fixed-length slots starting
 * at the window start. A booking is only valid if it starts exactly on one of
 * these slot boundaries, which keeps every appointment aligned and comparable.
 */
import { addMinutes, localDayOfWeek, localMidnightUtc, localMinuteOfDay } from "@/lib/time";

export interface ScheduleWindowLike {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface Slot {
  start: Date;
  end: Date;
}

export function generateSlots(date: string, windows: ScheduleWindowLike[], slotMinutes: number): Slot[] {
  const midnight = localMidnightUtc(date);
  const dow = localDayOfWeek(addMinutes(midnight, 12 * 60));
  const slots: Slot[] = [];
  for (const w of windows.filter((x) => x.dayOfWeek === dow).sort((a, b) => a.startMinute - b.startMinute)) {
    for (let m = w.startMinute; m + slotMinutes <= w.endMinute; m += slotMinutes) {
      const start = addMinutes(midnight, m);
      slots.push({ start, end: addMinutes(start, slotMinutes) });
    }
  }
  return slots;
}

/** True when `start` is exactly a slot boundary inside one of the doctor's windows. */
export function isValidSlotStart(start: Date, windows: ScheduleWindowLike[], slotMinutes: number): boolean {
  if (start.getUTCSeconds() !== 0 || start.getUTCMilliseconds() !== 0) return false;
  const dow = localDayOfWeek(start);
  const minute = localMinuteOfDay(start);
  // Slots never cross midnight, so the weekday of the start is the slot's weekday.
  return windows.some(
    (w) =>
      w.dayOfWeek === dow &&
      minute >= w.startMinute &&
      minute + slotMinutes <= w.endMinute &&
      (minute - w.startMinute) % slotMinutes === 0,
  );
}

export function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean {
  return a.start < b.end && b.start < a.end;
}
