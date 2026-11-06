import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/current-user";
import { listInvoices } from "@/server/services/billing";
import { INVOICE_STATUSES, invoiceListQuery } from "@/lib/validation/billing";
import { formatINR } from "@/lib/money";
import { formatLocalDate } from "@/lib/time";
import { titleCase } from "@/lib/format";
import { Button, ButtonLink, Card, EmptyState, Input, PageHeader, Pagination, Select, Table, Td } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePermission("billing:read");
  if (user.role === "PATIENT") redirect("/portal");
  const q = invoiceListQuery.parse({ ...(await searchParams), pageSize: 15 });
  const result = await listInvoices(user, q);
  return (
    <>
      <PageHeader title="Billing" description="Itemized invoices and payment status." actions={<ButtonLink href="/billing/new">New invoice</ButtonLink>} />
      <Card>
        <form className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]" role="search" aria-label="Search invoices">
          <label className="sr-only" htmlFor="q">Search</label>
          <Input name="q" placeholder="Invoice number, patient surname or MRN" defaultValue={q.q ?? ""} />
          <label className="sr-only" htmlFor="status">Status</label>
          <Select name="status" defaultValue={q.status ?? ""}>
            <option value="">All statuses</option>
            {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        {result.items.length === 0 ? (
          <EmptyState title="No invoices found" />
        ) : (
          <Table head={["Invoice", "Patient", "Date", "Total", "Paid", "Status"]} caption="Invoices">
            {result.items.map((i) => (
              <tr key={i.id} className="hover:bg-slate-50">
                <Td><Link className="font-mono text-xs font-medium text-teal-700 hover:underline" href={`/billing/${i.id}`}>{i.number}</Link></Td>
                <Td>{i.patient.firstName} {i.patient.lastName} <span className="font-mono text-xs text-slate-500">{i.patient.mrn}</span></Td>
                <Td>{formatLocalDate(i.createdAt)}</Td>
                <Td className="tabular-nums">{formatINR(i.totalCents)}</Td>
                <Td className="tabular-nums">{formatINR(i.amountPaidCents)}</Td>
                <Td><StatusBadge status={i.status} /></Td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/billing" params={{ q: q.q, status: q.status }} />
      </Card>
    </>
  );
}
