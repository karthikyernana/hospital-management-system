import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { ROLE_PERMISSIONS } from "@/server/auth/permissions";
import { Badge, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.role === "PATIENT") redirect("/portal");
  return (
    <>
      <PageHeader title={`Welcome, ${user.name}`} description="Your access is determined by your role." />
      <Card title="Your permissions">
        <div className="flex flex-wrap gap-2">
          {ROLE_PERMISSIONS[user.role].map((p) => (
            <Badge key={p} tone="blue">{p}</Badge>
          ))}
        </div>
      </Card>
    </>
  );
}
