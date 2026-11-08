import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/current-user";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { NewInvoiceForm } from "./new-invoice-form";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage() {
  const user = await requirePermission("billing:write");
  if (user.role === "PATIENT") redirect("/portal");
  return (
    <>
      <PageHeader title="New invoice" description="Creates a draft. For a visit, use “Create invoice” on a completed appointment to add the consultation fee automatically." />
      <Card className="max-w-xl"><NewInvoiceForm /></Card>
    </>
  );
}
