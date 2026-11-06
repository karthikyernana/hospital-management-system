import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { getInvoice } from "@/server/services/billing";
import { AppError } from "@/server/http/errors";
import { Card, PageHeader } from "@/components/ui";
import { InvoiceView } from "@/components/invoice-view";
import { PaymentForm } from "@/components/invoice-actions";

export const metadata: Metadata = { title: "My invoice" };

export default async function PortalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user.role !== "PATIENT") redirect("/billing");
  const { id } = await params;
  const inv = await getInvoice(user, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  });
  return (
    <>
      <PageHeader title={`Invoice ${inv.number}`} description="Your itemized bill." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2"><InvoiceView inv={inv} editable={false} /></div>
        {inv.status === "ISSUED" && <Card title="Pay online"><PaymentForm invoiceId={inv.id} balanceCents={inv.reconciliation.expected.balanceCents} allowCash={false} /></Card>}
      </div>
    </>
  );
}
