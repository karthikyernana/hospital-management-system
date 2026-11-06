"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Select } from "./ui";
import { apiFetch, ApiError, fieldError } from "@/lib/api-client";
import { LINE_CATEGORIES, PAYMENT_METHODS } from "@/lib/validation/billing";
import { titleCase } from "@/lib/format";
import { formatINR } from "@/lib/money";

const rupeesToPaise = (v: string) => Math.round(Number(v) * 100);
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function useCall() {
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  async function run(label: string, url: string, init: Parameters<typeof apiFetch>[1], success: string) {
    setLoading(label);
    setError(null);
    setOk(null);
    try {
      const data = await apiFetch<{ status?: string; failureReason?: string }>(url, init);
      if (data?.status === "FAILED") setError(new ApiError("PAYMENT_FAILED", `Payment failed: ${data.failureReason ?? "declined"}`, 402));
      else setOk(success);
      router.refresh();
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setLoading(null);
    }
  }
  const status = error ? <Alert>{error instanceof ApiError ? error.message : "Request failed"}</Alert> : ok ? <Alert tone="success">{ok}</Alert> : null;
  return { run, error, loading, status };
}

export function RemoveLineButton({ invoiceId, lineId }: { invoiceId: string; lineId: string }) {
  const c = useCall();
  return (
    <Button variant="ghost" className="text-rose-700" loading={c.loading === "rm"} onClick={() => c.run("rm", `/api/invoices/${invoiceId}/lines/${lineId}`, { method: "DELETE" }, "Removed")} aria-label="Remove line item">
      Remove
    </Button>
  );
}

/** Staff controls for a DRAFT invoice. */
export function DraftActions({ invoiceId, discountCents }: { invoiceId: string; discountCents: number }) {
  const c = useCall();
  async function addLine(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const v = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const ok = await c.run("line", `/api/invoices/${invoiceId}/lines`, {
      method: "POST",
      body: { category: v.category, description: v.description, quantity: Number(v.quantity), unitPriceCents: rupeesToPaise(v.unitPrice), taxRateBps: Math.round(Number(v.taxRate) * 100) },
    }, "Line item added.");
    if (ok) form.reset();
  }
  return (
    <div className="space-y-4">
      {c.status}
      <form onSubmit={addLine} className="space-y-3" noValidate aria-label="Add line item">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Description" name="description" required error={fieldError(c.error, "description")}><Input name="description" required /></Field>
          <Field label="Category" name="category"><Select name="category">{LINE_CATEGORIES.map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</Select></Field>
          <Field label="Quantity" name="quantity" error={fieldError(c.error, "quantity")}><Input name="quantity" type="number" min={1} defaultValue={1} /></Field>
          <Field label="Unit price (₹)" name="unitPrice" error={fieldError(c.error, "unitPriceCents")}><Input name="unitPrice" type="number" min={0} step="0.01" required /></Field>
          <Field label="Tax rate (%)" name="taxRate" error={fieldError(c.error, "taxRateBps")}><Input name="taxRate" type="number" min={0} max={100} step="0.01" defaultValue={0} /></Field>
        </div>
        <Button type="submit" variant="secondary" loading={c.loading === "line"}>Add line item</Button>
      </form>
      <form
        className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4"
        noValidate
        onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget); void c.run("disc", `/api/invoices/${invoiceId}`, { method: "PATCH", body: { discountCents: rupeesToPaise(String(v.get("discount"))) } }, "Discount updated."); }}
      >
        <Field label="Discount (₹)" name="discount"><Input name="discount" type="number" min={0} step="0.01" defaultValue={discountCents / 100} className="max-w-[160px]" /></Field>
        <Button type="submit" variant="secondary" loading={c.loading === "disc"}>Apply discount</Button>
      </form>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <Button loading={c.loading === "issue"} onClick={() => c.run("issue", `/api/invoices/${invoiceId}/issue`, { method: "POST" }, "Invoice issued.")}>Issue invoice</Button>
        <VoidButton invoiceId={invoiceId} />
      </div>
    </div>
  );
}

export function VoidButton({ invoiceId }: { invoiceId: string }) {
  const c = useCall();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <Button variant="ghost" className="text-rose-700" onClick={() => setOpen(true)}>Void…</Button>;
  return (
    <div className="flex w-full flex-wrap items-end gap-2">
      {c.status}
      <Field label="Reason for voiding" name="voidReason"><Input name="voidReason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <Button variant="danger" disabled={reason.trim().length < 3} loading={c.loading === "void"} onClick={() => c.run("void", `/api/invoices/${invoiceId}/void`, { method: "POST", body: { reason } }, "Invoice voided.")}>Confirm void</Button>
    </div>
  );
}

/** Sandbox payment form (staff at the desk, or the patient in the portal). */
export function PaymentForm({ invoiceId, balanceCents, allowCash }: { invoiceId: string; balanceCents: number; allowCash: boolean }) {
  const c = useCall();
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2));
  const [method, setMethod] = useState<string>(allowCash ? "CASH" : "CARD");
  const [simulate, setSimulate] = useState<"approve" | "decline">("approve");
  // Reused across retries of the same attempt so a double submit charges once.
  const [key, setKey] = useState(newKey);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await c.run("pay", `/api/invoices/${invoiceId}/payments`, { method: "POST", idempotencyKey: key, body: { amountCents: rupeesToPaise(amount), method, simulate } }, "Payment successful.");
    setKey(newKey());
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate aria-label="Record payment">
      {c.status}
      <p className="text-sm text-slate-600">Balance due: <span className="font-semibold">{formatINR(balanceCents)}</span></p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Amount (₹)" name="amount" error={fieldError(c.error, "amountCents")}><Input name="amount" type="number" min={0.01} step="0.01" max={balanceCents / 100} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Method" name="method">
          <Select name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.filter((m) => allowCash || m !== "CASH").map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
          </Select>
        </Field>
        <Field label="Sandbox outcome" name="simulate" hint="Simulated gateway — choose the result to demo.">
          <Select name="simulate" value={simulate} onChange={(e) => setSimulate(e.target.value as "approve" | "decline")}>
            <option value="approve">Approve</option>
            <option value="decline">Decline</option>
          </Select>
        </Field>
      </div>
      <Button type="submit" loading={c.loading === "pay"}>Pay {amount ? formatINR(rupeesToPaise(amount) || 0) : ""}</Button>
    </form>
  );
}
