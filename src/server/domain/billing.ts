/**
 * Invoice reconciliation — pure function used by the billing service, the
 * invoice API (returned to the UI) and the tests. An invoice "reconciles"
 * when its stored totals equal what its line items and payments imply and
 * its status matches the amount paid.
 */
import { computeLine } from "@/lib/money";

export interface ReconcileInput {
  status: "DRAFT" | "ISSUED" | "PAID" | "VOID";
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  amountPaidCents: number;
  lineItems: { quantity: number; unitPriceCents: number; taxRateBps: number; taxCents: number; lineTotalCents: number }[];
  payments: { amountCents: number; status: "PENDING" | "SUCCEEDED" | "FAILED" }[];
}

export interface Reconciliation {
  ok: boolean;
  expected: { subtotalCents: number; taxCents: number; totalCents: number; amountPaidCents: number; balanceCents: number };
  issues: string[];
}

export function reconcileInvoice(inv: ReconcileInput): Reconciliation {
  const issues: string[] = [];
  let subtotal = 0;
  let tax = 0;
  inv.lineItems.forEach((l, i) => {
    const expected = computeLine(l);
    if (l.taxCents !== expected.taxCents || l.lineTotalCents !== expected.lineTotalCents) issues.push(`Line ${i + 1} total does not match quantity × price + tax`);
    subtotal += l.quantity * l.unitPriceCents;
    tax += expected.taxCents;
  });
  const total = subtotal + tax - inv.discountCents;
  const paid = inv.payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amountCents, 0);

  if (inv.subtotalCents !== subtotal) issues.push("Subtotal does not equal the sum of line items");
  if (inv.taxCents !== tax) issues.push("Tax does not equal the sum of line taxes");
  if (inv.totalCents !== total) issues.push("Total does not equal subtotal + tax − discount");
  if (inv.amountPaidCents !== paid) issues.push("Amount paid does not equal the sum of successful payments");
  if (paid > total) issues.push("Invoice is over-paid");
  if (inv.status === "PAID" && paid !== total) issues.push("Marked PAID but the balance is not zero");
  if (inv.status === "ISSUED" && total > 0 && paid >= total) issues.push("Fully paid but not marked PAID");
  if (inv.status === "DRAFT" && paid !== 0) issues.push("Draft invoice has payments");

  return {
    ok: issues.length === 0,
    expected: { subtotalCents: subtotal, taxCents: tax, totalCents: total, amountPaidCents: paid, balanceCents: total - paid },
    issues,
  };
}
