import { describe, expect, it } from "vitest";
import { computeLine, computeTotals } from "@/lib/money";
import { reconcileInvoice, type ReconcileInput } from "@/server/domain/billing";

describe("invoice arithmetic", () => {
  it("computes per-line tax with half-up rounding", () => {
    expect(computeLine({ quantity: 3, unitPriceCents: 2_499, taxRateBps: 1_200 })).toEqual({ taxCents: 900, lineTotalCents: 8_397 });
    expect(computeLine({ quantity: 1, unitPriceCents: 50_000, taxRateBps: 0 })).toEqual({ taxCents: 0, lineTotalCents: 50_000 });
  });

  it("sums lines, applies the discount and rejects impossible discounts", () => {
    const lines = [
      { quantity: 1, unitPriceCents: 50_000, taxRateBps: 0 },
      { quantity: 2, unitPriceCents: 10_000, taxRateBps: 1_200 },
    ];
    expect(computeTotals(lines, 5_000)).toEqual({ subtotalCents: 70_000, taxCents: 2_400, discountCents: 5_000, totalCents: 67_400 });
    expect(() => computeTotals(lines, 1_000_000)).toThrow(/exceed/);
    expect(() => computeTotals(lines, -1)).toThrow(/negative/);
  });
});

describe("reconcileInvoice", () => {
  const base: ReconcileInput = {
    status: "ISSUED",
    subtotalCents: 70_000,
    taxCents: 2_400,
    discountCents: 0,
    totalCents: 72_400,
    amountPaidCents: 0,
    lineItems: [
      { quantity: 1, unitPriceCents: 50_000, taxRateBps: 0, taxCents: 0, lineTotalCents: 50_000 },
      { quantity: 2, unitPriceCents: 10_000, taxRateBps: 1_200, taxCents: 2_400, lineTotalCents: 22_400 },
    ],
    payments: [],
  };

  it("accepts a consistent invoice", () => {
    const r = reconcileInvoice(base);
    expect(r.ok).toBe(true);
    expect(r.expected.balanceCents).toBe(72_400);
  });

  it("flags totals that do not match the line items", () => {
    const r = reconcileInvoice({ ...base, totalCents: 70_000 });
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("Total does not equal subtotal + tax − discount");
  });

  it("flags status that does not match payments", () => {
    const paidWrong = reconcileInvoice({ ...base, status: "PAID", amountPaidCents: 10_000, payments: [{ amountCents: 10_000, status: "SUCCEEDED" }] });
    expect(paidWrong.issues).toContain("Marked PAID but the balance is not zero");
    const ignoresFailed = reconcileInvoice({ ...base, payments: [{ amountCents: 72_400, status: "FAILED" }] });
    expect(ignoresFailed.ok).toBe(true);
  });
});
