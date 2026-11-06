/**
 * Invoice arithmetic. Pure functions so the same rules are used by the
 * billing service, the seed script and the tests. Amounts are integer paise.
 */
export interface LineInput {
  quantity: number;
  unitPriceCents: number;
  taxRateBps: number;
}

export interface LineAmounts {
  taxCents: number;
  lineTotalCents: number;
}

export interface InvoiceTotals {
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
}

/** Tax is computed per line and rounded half-up to the nearest paisa. */
export function computeLine(line: LineInput): LineAmounts {
  const net = line.quantity * line.unitPriceCents;
  const taxCents = Math.round((net * line.taxRateBps) / 10_000);
  return { taxCents, lineTotalCents: net + taxCents };
}

export function computeTotals(lines: LineInput[], discountCents = 0): InvoiceTotals {
  let subtotalCents = 0;
  let taxCents = 0;
  for (const l of lines) {
    subtotalCents += l.quantity * l.unitPriceCents;
    taxCents += computeLine(l).taxCents;
  }
  if (discountCents < 0) throw new Error("Discount cannot be negative");
  if (discountCents > subtotalCents + taxCents) throw new Error("Discount cannot exceed the invoice amount");
  return { subtotalCents, taxCents, discountCents, totalCents: subtotalCents + taxCents - discountCents };
}

export function formatINR(cents: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(cents / 100);
}
