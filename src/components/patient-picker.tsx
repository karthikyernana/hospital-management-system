"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Input, Spinner } from "./ui";

export interface PickedPatient { id: string; mrn: string; firstName: string; lastName: string }

/** Type-ahead patient search backed by GET /api/patients?q= */
export function PatientPicker({ value, onChange, error }: { value: PickedPatient | null; onChange: (p: PickedPatient | null) => void; error?: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedPatient[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{ items: PickedPatient[] }>(`/api/patients?pageSize=8&q=${encodeURIComponent(q)}`);
        setResults(data.items);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md bg-teal-50 px-3 py-2 text-sm ring-1 ring-teal-200">
        <span><span className="font-medium">{value.firstName} {value.lastName}</span> <span className="font-mono text-xs text-slate-600">{value.mrn}</span></span>
        <button type="button" className="text-sm text-teal-800 underline" onClick={() => onChange(null)}>Change</button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Input name="patientSearch" placeholder="Search name, MRN or phone (min 2 characters)" value={q} onChange={(e) => setQ(e.target.value)} error={error} autoComplete="off" />
      {loading && <p className="flex items-center gap-2 text-xs text-slate-500" role="status"><Spinner className="h-3 w-3" /> Searching…</p>}
      {!loading && q.trim().length >= 2 && results.length === 0 && <p className="text-xs text-slate-500">No matching patients.</p>}
      {results.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-md ring-1 ring-slate-200" role="listbox" aria-label="Matching patients">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" role="option" aria-selected={false} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => onChange(p)}>
                {p.firstName} {p.lastName} <span className="font-mono text-xs text-slate-500">{p.mrn}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
