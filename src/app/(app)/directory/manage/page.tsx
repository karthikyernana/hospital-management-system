import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/current-user";
import { listDepartments } from "@/server/services/directory";
import { PageHeader } from "@/components/ui";
import { DirectoryForms } from "./directory-forms";

export const metadata: Metadata = { title: "Manage directory" };

export default async function ManageDirectoryPage() {
  const user = await requirePermission("directory:write");
  const departments = await listDepartments(user);
  return (
    <>
      <PageHeader title="Manage directory" description="Administrators can add departments, doctors and staff." />
      <DirectoryForms departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
    </>
  );
}
