/**
 * Simulated payment gateway. No real provider, card data or money is involved.
 * The caller chooses the sandbox outcome, which makes the success and decline
 * paths both demonstrable and testable.
 */
import { randomUUID } from "node:crypto";

export type SandboxOutcome = "approve" | "decline";

export interface GatewayResult {
  approved: boolean;
  providerRef: string;
  failureReason?: string;
}

export async function chargeSandbox(amountCents: number, outcome: SandboxOutcome): Promise<GatewayResult> {
  const providerRef = `sandbox_pay_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  if (amountCents <= 0) return { approved: false, providerRef, failureReason: "Invalid amount" };
  if (outcome === "decline") return { approved: false, providerRef, failureReason: "Card declined (sandbox)" };
  return { approved: true, providerRef };
}
