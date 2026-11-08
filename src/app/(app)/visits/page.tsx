import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/current-user";
import { listVisits } from "@/server/services/visits";
import { visitListQuery } from "@/lib/validation/visit";
import { formatLocal } from "@/lib/time";
import { Button, Card, EmptyState, PageHeader, Pagination, Select, Table, Td } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Visits" };

export default async function VisitsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePermission("visit:read");
  if (user.role === "PATIENT") redirect("/portal");
  const q = visitListQuery.parse({ ...(await searchParams), pageSize: 15 });
  const result = await listVisits(user, q);
  return (
    <>
      <PageHeader title={user.role === "CLINICIAN" ? "My visits" : "Visits"} description="Encounter records. Clinical content is visible to clinicians and administrators only." />
      <Card>
        <form className="mb-4 flex flex-wrap gap-3" aria-label="Filter visits">
          <label className="sr-only" htmlFor="status">Status</label>
          <Select name="status" defaultValue={q.status ?? ""} className="max-w-[200px]">
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="FINALIZED">Finalized</option>
          </Select>
          <Button type="submit" variant="secondary">Apply</Button>
        </form>
        {result.items.length === 0 ? (
          <EmptyState title="No visits yet">Visits start when a checked-in patient is seen.</EmptyState>
        ) : (
          <Table head={["Started", "Patient", "Clinician", "Complaint", "Status", ""]} caption="Visits">
            {result.items.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50">
                <Td className="tabular-nums">{formatLocal(v.startedAt)}</Td>
                <Td>{v.patient.firstName} {v.patient.lastName} <span className="font-mono text-xs text-slate-500">{v.patient.mrn}</span></Td>
                <Td>Dr. {v.doctor.firstName} {v.doctor.lastName}</Td>
                <Td className="max-w-[200px] truncate">{v.chiefComplaint ?? "—"}</Td>
                <Td><StatusBadge status={v.status} /></Td>
                <Td><Link className="text-sm font-medium text-teal-700 hover:underline" href={`/visits/${v.id}`}>Open</Link></Td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/visits" params={{ status: q.status }} />
      </Card>
    </>
  );
}
