/**
 * Small, dependency-free UI kit (Tailwind). Accessibility basics are built in:
 * labelled inputs, aria-invalid + aria-describedby for errors, role="alert"
 * for failures, aria-live for status updates and visible focus rings.
 */
import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600";

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-teal-700 text-white hover:bg-teal-800 disabled:bg-teal-700/50",
  secondary: "bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50",
  danger: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-600/50",
  ghost: "text-slate-700 hover:bg-slate-100 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        variants[variant],
        focus,
        className,
      )}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function ButtonLink({ href, children, variant = "primary", className }: { href: string; children: ReactNode; variant?: Variant; className?: string }) {
  return (
    <Link href={href} className={cx("inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium", variants[variant], focus, className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx("rounded-lg bg-white shadow-sm ring-1 ring-slate-200", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const badgeTones = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-800 ring-rose-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
};
export type Tone = keyof typeof badgeTones;
export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: Tone }) {
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", badgeTones[tone])}>{children}</span>;
}

export function Alert({ tone = "error", children, title }: { tone?: "error" | "success" | "info"; children: ReactNode; title?: string }) {
  const styles = {
    error: "bg-rose-50 text-rose-900 ring-rose-200",
    success: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    info: "bg-sky-50 text-sky-900 ring-sky-200",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} aria-live="polite" className={cx("rounded-md p-3 text-sm ring-1 ring-inset", styles)}>
      {title && <p className="font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-600">{children}</div>}
    </div>
  );
}

interface FieldProps {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children?: ReactNode;
}
export function Field({ label, name, error, hint, required, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="text-rose-600" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p id={`${name}-hint`} className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls = cx(
  "block w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 aria-[invalid=true]:ring-rose-500",
  "focus:ring-2 focus:ring-inset focus:ring-teal-600 focus:outline-none",
);

export function Input({ error, ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return <input id={props.name} aria-invalid={!!error || undefined} aria-describedby={error ? `${props.id ?? props.name}-error` : undefined} {...props} className={cx(inputCls, props.className)} />;
}
export function Select({ error, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <select id={props.name} aria-invalid={!!error || undefined} aria-describedby={error ? `${props.id ?? props.name}-error` : undefined} {...props} className={cx(inputCls, props.className)}>
      {children}
    </select>
  );
}
export function Textarea({ error, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return <textarea id={props.name} aria-invalid={!!error || undefined} aria-describedby={error ? `${props.id ?? props.name}-error` : undefined} rows={3} {...props} className={cx(inputCls, props.className)} />;
}

export function Table({ head, children, caption }: { head: ReactNode[]; children: ReactNode; caption?: string }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-slate-50">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
      </table>
    </div>
  );
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("whitespace-nowrap px-3 py-2 text-slate-800", className)}>{children}</td>;
}

/** Server-rendered pagination that preserves the current filters. */
export function Pagination({ page, pageSize, total, basePath, params }: { page: number; pageSize: number; total: number; basePath: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <p>
        {total === 0 ? "No results" : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
      </p>
      <div className="flex gap-2">
        {page > 1 ? <ButtonLink variant="secondary" href={href(page - 1)}>Previous</ButtonLink> : <span className="rounded-md px-3.5 py-2 text-slate-400">Previous</span>}
        <span className="px-2 py-2" aria-current="page">Page {page} of {pages}</span>
        {page < pages ? <ButtonLink variant="secondary" href={href(page + 1)}>Next</ButtonLink> : <span className="rounded-md px-3.5 py-2 text-slate-400">Next</span>}
      </div>
    </nav>
  );
}
