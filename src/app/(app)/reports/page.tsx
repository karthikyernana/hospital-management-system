import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/current-user";
import { appointmentSummary, billingSummary } from "@/server/services/reports";
import { dateRangeQuery } from "@/lib/validation/reports";
import { formatINR } from "@/lib/money";
import { titleCase } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Table, Td } from "@/components/ui";
import { BarList, Stat } from "@/components/bar-list";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePermission("report:read");
  const parsed = dateRangeQuery.safeParse(await searchParams);
  const range = parsed.success ? parsed.data : {};
  const [appts, billing] = await Promise.all([appointmentSummary(user, range), billingSummary(user, range)]);

  return (
    <>
      <PageHeader title="Reports" description={`Appointment and billing summaries for ${appts.from} → ${appts.to} (IST).`} />
      {!parsed.success && <div className="mb-4"><Alert>Invalid date range — showing the last 30 days.</Alert></div>}
      <form className="mb-6 flex flex-wrap items-end gap-3" aria-label="Report period">
        <Field label="From" name="from"><Input name="from" type="date" defaultValue={appts.from} /></Field>
        <Field label="To" name="to"><Input name="to" type="date" defaultValue={appts.to} /></Field>
        <Button type="submit" variant="secondary">Update</Button>
      </form>

      <h2 className="mb-3 text-lg font-semibold">Appointments</h2>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Appointments" value={appts.total} />
        <Stat label="Completed" value={`${appts.completionRate}%`} hint={`${appts.byStatus.COMPLETED ?? 0} visits`} />
        <Stat label="Cancelled" value={`${appts.cancellationRate}%`} hint={`${appts.byStatus.CANCELLED ?? 0} appointments`} />
        <Stat label="No-show" value={`${appts.noShowRate}%`} hint={`${appts.byStatus.NO_SHOW ?? 0} appointments`} />
      </div>
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Card title="By department"><BarList label="Appointments by department" items={appts.byDepartment.map((d) => ({ label: d.department, value: d.count }))} /></Card>
        <Card title="By doctor"><BarList label="Appointments by doctor" items={appts.byDoctor.map((d) => ({ label: d.name, value: d.count }))} /></Card>
        <Card title="By status"><BarList label="Appointments by status" items={Object.entries(appts.byStatus).map(([s, n]) => ({ label: titleCase(s), value: n }))} /></Card>
        <Card title="Daily volume" className="lg:col-span-3"><BarList label="Appointments per day" items={appts.daily.map((d) => ({ label: d.day, value: d.count }))} /></Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Billing</h2>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Invoiced" value={formatINR(billing.invoicedCents)} hint={`${billing.invoiceCount} issued/paid invoices`} />
        <Stat label="Collected" value={formatINR(billing.collectedCents)} hint={`${billing.collectionRate}% collection rate`} />
        <Stat label="Outstanding" value={formatINR(billing.outstandingCents)} />
        <Stat label="Reconciliation" value={billing.reconciliation.unreconciled.length === 0 ? "All OK" : `${billing.reconciliation.unreconciled.length} issues`} hint={`${billing.reconciliation.checked} invoices checked`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Invoices by status">
          <Table head={["Status", "Count", "Total"]} caption="Invoices by status">
            {billing.byStatus.map((s) => (
              <tr key={s.status}><Td>{titleCase(s.status)}</Td><Td className="tabular-nums">{s.count}</Td><Td className="tabular-nums">{formatINR(s.totalCents)}</Td></tr>
            ))}
          </Table>
        </Card>
        <Card title="Payments by method">
          <Table head={["Method", "Outcome", "Count", "Amount"]} caption="Payments by method">
            {billing.payments.map((p) => (
              <tr key={`${p.method}-${p.status}`}><Td>{titleCase(p.method)}</Td><Td><Badge tone={p.status === "SUCCEEDED" ? "green" : p.status === "FAILED" ? "red" : "amber"}>{titleCase(p.status)}</Badge></Td><Td className="tabular-nums">{p.count}</Td><Td className="tabular-nums">{formatINR(p.amountCents)}</Td></tr>
            ))}
          </Table>
          {billing.reconciliation.unreconciled.length > 0 && <div className="mt-3"><Alert>Not reconciling: {billing.reconciliation.unreconciled.join(", ")}</Alert></div>}
        </Card>
      </div>
    </>
  );
}
