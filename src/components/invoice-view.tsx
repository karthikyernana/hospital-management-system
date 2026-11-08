import type { getInvoice } from "@/server/services/billing";
import { formatINR } from "@/lib/money";
import { formatLocal, formatLocalDate } from "@/lib/time";
import { titleCase } from "@/lib/format";
import { Alert, Badge, Card, EmptyState, Table, Td } from "./ui";
import { StatusBadge } from "./status-badge";
import { RemoveLineButton } from "./invoice-actions";

type Invoice = Awaited<ReturnType<typeof getInvoice>>;

/** Read-only invoice rendering used by both the billing desk and the patient portal. */
export function InvoiceView({ inv, editable }: { inv: Invoice; editable: boolean }) {
  const rec = inv.reconciliation;
  return (
    <div className="space-y-6">
      <Card
        title={<span className="flex items-center gap-2">Line items <StatusBadge status={inv.status} /></span>}
        actions={rec.ok ? <Badge tone="green">Reconciled ✓</Badge> : <Badge tone="red">Does not reconcile</Badge>}
      >
        {!rec.ok && <div className="mb-3"><Alert title="Reconciliation issues"><ul className="list-disc pl-5">{rec.issues.map((i) => <li key={i}>{i}</li>)}</ul></Alert></div>}
        {inv.lineItems.length === 0 ? (
          <EmptyState title="No line items yet">Add the services provided below.</EmptyState>
        ) : (
          <Table head={["Item", "Category", "Qty", "Unit price", "Tax", "Line total", ...(editable ? [""] : [])]} caption="Invoice line items">
            {inv.lineItems.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-normal">{l.description}</Td>
                <Td><Badge>{titleCase(l.category)}</Badge></Td>
                <Td className="tabular-nums">{l.quantity}</Td>
                <Td className="tabular-nums">{formatINR(l.unitPriceCents)}</Td>
                <Td className="tabular-nums">{formatINR(l.taxCents)} <span className="text-xs text-slate-500">({l.taxRateBps / 100}%)</span></Td>
                <Td className="tabular-nums font-medium">{formatINR(l.lineTotalCents)}</Td>
                {editable && <Td><RemoveLineButton invoiceId={inv.id} lineId={l.id} /></Td>}
              </tr>
            ))}
          </Table>
        )}
        <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm tabular-nums">
          <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd>{formatINR(inv.subtotalCents)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-600">Tax</dt><dd>{formatINR(inv.taxCents)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-600">Discount</dt><dd>− {formatINR(inv.discountCents)}</dd></div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold"><dt>Total</dt><dd>{formatINR(inv.totalCents)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-600">Paid</dt><dd>{formatINR(inv.amountPaidCents)}</dd></div>
          <div className="flex justify-between font-semibold text-teal-800"><dt>Balance due</dt><dd>{formatINR(rec.expected.balanceCents)}</dd></div>
        </dl>
      </Card>
      <Card title="Payments">
        {inv.payments.length === 0 ? (
          <EmptyState title="No payments yet" />
        ) : (
          <Table head={["When", "Method", "Amount", "Status", "Reference"]} caption="Payments">
            {inv.payments.map((p) => (
              <tr key={p.id}>
                <Td>{formatLocal(p.createdAt)}</Td>
                <Td>{titleCase(p.method)}</Td>
                <Td className="tabular-nums">{formatINR(p.amountCents)}</Td>
                <Td><StatusBadge status={p.status} />{p.failureReason && <span className="ml-2 text-xs text-rose-700">{p.failureReason}</span>}</Td>
                <Td className="font-mono text-xs">{p.providerRef}</Td>
              </tr>
            ))}
          </Table>
        )}
        <p className="mt-3 text-xs text-slate-500">Payments are processed by a simulated sandbox gateway. No real money or card data is involved.</p>
      </Card>
      <p className="text-xs text-slate-500">Created {formatLocalDate(inv.createdAt)}{inv.issuedAt ? ` · issued ${formatLocalDate(inv.issuedAt)}` : ""}{inv.paidAt ? ` · paid ${formatLocalDate(inv.paidAt)}` : ""}</p>
    </div>
  );
}
