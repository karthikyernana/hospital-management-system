"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Alert, Button, Spinner, cx } from "./ui";

interface Slot { start: string; end: string; available: boolean; booked: boolean }

const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * Shows a doctor's slots for one day. `refreshKey` lets the parent force a
 * reload, e.g. after a 409 tells us our view of availability was stale.
 */
export function SlotPicker({ doctorId, date, value, onChange, refreshKey = 0 }: { doctorId: string; date: string; value: string | null; onChange: (start: string | null) => void; refreshKey?: number }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!doctorId || !date) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ slots: Slot[] }>(`/api/doctors/${doctorId}/availability?date=${date}`);
      setSlots(data.slots);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load availability");
      setSlots(null);
    } finally {
      setLoading(false);
    }
  }, [doctorId, date]);

  useEffect(() => {
    onChange(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshKey]);

  if (!doctorId || !date) return <p className="text-sm text-slate-500">Choose a doctor and a date to see open slots.</p>;
  if (loading) return <p className="flex items-center gap-2 text-sm text-slate-500" role="status"><Spinner className="h-4 w-4" /> Loading slots…</p>;
  if (error) return <div className="space-y-2"><Alert>{error}</Alert><Button variant="secondary" type="button" onClick={load}>Retry</Button></div>;
  if (!slots || slots.length === 0) return <p className="text-sm text-slate-600">The doctor does not work on this day. Try another date.</p>;
  const open = slots.filter((s) => s.available).length;

  return (
    <fieldset>
      <legend className="mb-2 text-sm text-slate-600">{open} of {slots.length} slots open (IST)</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
        {slots.map((s) => (
          <button
            key={s.start}
            type="button"
            disabled={!s.available}
            onClick={() => onChange(s.start)}
            aria-pressed={value === s.start}
            aria-label={`${timeFmt.format(new Date(s.start))}${s.available ? "" : s.booked ? " (booked)" : " (unavailable)"}`}
            className={cx(
              "rounded-md px-2 py-2 text-sm tabular-nums ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-teal-600",
              value === s.start
                ? "bg-teal-700 text-white ring-teal-700"
                : s.available
                  ? "bg-white text-slate-800 ring-slate-300 hover:bg-teal-50"
                  : "cursor-not-allowed bg-slate-100 text-slate-400 line-through ring-slate-200",
            )}
          >
            {timeFmt.format(new Date(s.start))}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
