"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { apiFetch, ApiError, fieldError } from "@/lib/api-client";

const DEMO_ACCOUNTS = [
  { label: "Front desk", email: "frontdesk@hms.test" },
  { label: "Clinician", email: "dr.mehta@hms.test" },
  { label: "Administrator", email: "admin@hms.test" },
  { label: "Patient portal", email: "patient@hms.test" },
];
const DEMO_PASSWORD = "Demo@12345";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { user } = await apiFetch<{ user: { role: string } }>("/api/auth/login", { method: "POST", body: { email, password } });
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.replace(safeNext ?? (user.role === "PATIENT" ? "/portal" : "/dashboard"));
      router.refresh();
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error instanceof ApiError && error.code !== "VALIDATION_ERROR" ? <Alert>{error.message}</Alert> : null}
        {error && !(error instanceof ApiError) ? <Alert>Network error — please try again.</Alert> : null}
        <Field label="Email" name="email" required error={fieldError(error, "email")}>
          <Input name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required error={fieldError(error, "email")} />
        </Field>
        <Field label="Password" name="password" required error={fieldError(error, "password")}>
          <Input name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required error={fieldError(error, "password")} />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Demo accounts (password {DEMO_PASSWORD})</p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <Button
              key={a.email}
              type="button"
              variant="secondary"
              onClick={() => {
                setEmail(a.email);
                setPassword(DEMO_PASSWORD);
              }}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
