/**
 * Time helpers. The hospital runs on IST (UTC+05:30, no daylight saving),
 * so a fixed offset is correct and keeps slot maths deterministic.
 * All timestamps are stored in UTC; schedules are hospital-local minutes.
 */
export const HOSPITAL_TZ = "Asia/Kolkata";
export const HOSPITAL_UTC_OFFSET_MIN = 330;

const MS_PER_MIN = 60_000;

/** Parse "YYYY-MM-DD" (hospital-local date) and return UTC instant of local midnight. */
export function localMidnightUtc(date: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  const utcMidnight = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(utcMidnight - HOSPITAL_UTC_OFFSET_MIN * MS_PER_MIN);
}

/** Hospital-local date string (YYYY-MM-DD) for a UTC instant. */
export function toLocalDateString(d: Date): string {
  const local = new Date(d.getTime() + HOSPITAL_UTC_OFFSET_MIN * MS_PER_MIN);
  return local.toISOString().slice(0, 10);
}

/** Day of week (0 = Sunday) in hospital-local time. */
export function localDayOfWeek(d: Date): number {
  return new Date(d.getTime() + HOSPITAL_UTC_OFFSET_MIN * MS_PER_MIN).getUTCDay();
}

/** Minutes since hospital-local midnight. */
export function localMinuteOfDay(d: Date): number {
  const local = new Date(d.getTime() + HOSPITAL_UTC_OFFSET_MIN * MS_PER_MIN);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * MS_PER_MIN);
}

export function addDays(date: string, days: number): string {
  const d = localMidnightUtc(date);
  return toLocalDateString(new Date(d.getTime() + days * 24 * 60 * MS_PER_MIN + 60 * MS_PER_MIN));
}

/** "09:30" from minutes since midnight. */
export function minuteToHHMM(minute: number): string {
  const h = Math.floor(minute / 60).toString().padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Human readable local date-time, e.g. "Mon, 9 Nov 2026, 10:30". */
export function formatLocal(d: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: HOSPITAL_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(d));
}

export function formatLocalDate(d: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: HOSPITAL_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
