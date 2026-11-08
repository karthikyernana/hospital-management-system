/** Minimal accessible horizontal bar chart: values are also shown as text. */
export function BarList({ items, format = (n: number) => String(n), label }: { items: { label: string; value: number }[]; format?: (n: number) => string; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-sm text-slate-500">No data for this period.</p>;
  return (
    <ul className="space-y-2" aria-label={label}>
      {items.map((i) => (
        <li key={i.label} className="text-sm">
          <div className="mb-0.5 flex justify-between gap-2"><span className="truncate">{i.label}</span><span className="tabular-nums text-slate-600">{format(i.value)}</span></div>
          <div className="h-2 rounded-full bg-slate-100" aria-hidden="true"><div className="h-2 rounded-full bg-teal-600" style={{ width: `${(i.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
