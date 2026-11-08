"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Select, Input } from "@/components/ui";
import { apiFetch, ApiError } from "@/lib/api-client";
import { minuteToHHMM, WEEKDAYS } from "@/lib/time";

interface Window { dayOfWeek: number; startMinute: number; endMinute: number }
const toMinute = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Admin-only editor for a doctor's weekly working windows. */
export function ScheduleEditor({ doctorId, initial }: { doctorId: string; initial: Window[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Window[]>(initial);
  const [status, setStatus] = useState<{ tone: "success" | "error"; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<Window>) => setRows((r) => r.map((w, j) => (j === i ? { ...w, ...patch } : w)));

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      await apiFetch(`/api/doctors/${doctorId}/schedule`, { method: "PUT", body: { windows: rows } });
      setStatus({ tone: "success", msg: "Schedule saved." });
      router.refresh();
    } catch (e) {
      setStatus({ tone: "error", msg: e instanceof ApiError ? e.message : "Could not save schedule." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {status && <Alert tone={status.tone}>{status.msg}</Alert>}
      {rows.length === 0 && <p className="text-sm text-slate-500">No working windows. Add one below.</p>}
      <ul className="space-y-2">
        {rows.map((w, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
            <Select aria-label={`Day for window ${i + 1}`} name={`day-${i}`} value={w.dayOfWeek} onChange={(e) => update(i, { dayOfWeek: Number(e.target.value) })}>
              {WEEKDAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
            </Select>
            <Input aria-label={`Start time for window ${i + 1}`} name={`start-${i}`} type="time" value={minuteToHHMM(w.startMinute)} onChange={(e) => update(i, { startMinute: toMinute(e.target.value) })} />
            <Input aria-label={`End time for window ${i + 1}`} name={`end-${i}`} type="time" value={minuteToHHMM(w.endMinute)} onChange={(e) => update(i, { endMinute: toMinute(e.target.value) })} />
            <Button type="button" variant="ghost" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} aria-label={`Remove window ${i + 1}`}>Remove</Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => setRows((r) => [...r, { dayOfWeek: 1, startMinute: 540, endMinute: 780 }])}>Add window</Button>
        <Button type="button" onClick={save} loading={saving}>Save schedule</Button>
      </div>
    </div>
  );
}
