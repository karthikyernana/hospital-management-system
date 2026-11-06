import { Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-slate-500" role="status" aria-live="polite">
      <Spinner />
      <span className="ml-2 text-sm">Loading…</span>
    </div>
  );
}
