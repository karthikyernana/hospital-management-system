import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/current-user";
import { getInvoice } from "@/server/services/billing";
import { AppError } from "@/server/http/errors";
import { formatLocal } from "@/lib/time";
import { Card, PageHeader } from "@/components/ui";
import { InvoiceView } from "@/components/invoice-view";
import { DraftActions, PaymentForm, VoidButton } from "@/components/invoice-actions";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("billing:read");
  const { id } = await params;
  if (user.role === "PATIENT") redirect(`/portal/invoices/${id}`);
  const inv = await getInvoice(user, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  return (
    <>
      <PageHeader
        title={`Invoice ${inv.number}`}
        description={`${inv.patient.firstName} ${inv.patient.lastName} (${inv.patient.mrn})${inv.appointment ? ` · visit ${formatLocal(inv.appointment.startTime)} with Dr. ${inv.appointment.doctor.lastName}` : ""}`}
        actions={<Link className="text-sm text-teal-700 hover:underline" href={`/patients/${inv.patient.id}`}>Patient profile</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2"><InvoiceView inv={inv} editable={inv.status === "DRAFT"} /></div>
        <div className="space-y-6">
          {inv.status === "DRAFT" && <Card title="Edit draft"><DraftActions invoiceId={inv.id} discountCents={inv.discountCents} /></Card>}
          {inv.status === "ISSUED" && (
            <Card title="Take payment">
              <PaymentForm invoiceId={inv.id} balanceCents={inv.reconciliation.expected.balanceCents} allowCash />
              {inv.amountPaidCents === 0 && <div className="mt-4 border-t border-slate-100 pt-4"><VoidButton invoiceId={inv.id} /></div>}
            </Card>
          )}
          {inv.status === "PAID" && <Card title="Status"><p className="text-sm text-emerald-800">Paid in full. This invoice is closed.</p></Card>}
          {inv.status === "VOID" && <Card title="Status"><p className="whitespace-pre-wrap text-sm text-slate-700">{inv.notes ?? "Voided."}</p></Card>}
        </div>
      </div>
    </>
  );
}
