/** Placeholder shown while a server-rendered page streams in. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="animate-pulse">
      <div className="mb-6 h-7 w-56 rounded bg-slate-200" />
      <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 h-9 w-full rounded bg-slate-100" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="mb-2 h-8 rounded bg-slate-100" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
