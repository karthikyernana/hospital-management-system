import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/server/auth/current-user";
import { auditFacets, listAuditLogs } from "@/server/services/audit-query";
import { auditListQuery } from "@/lib/validation/reports";
import { formatLocal } from "@/lib/time";
import { titleCase } from "@/lib/format";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Pagination, Select, Table, Td, type Tone } from "@/components/ui";

export const metadata: Metadata = { title: "Audit log" };

const TONE: Record<string, Tone> = { READ: "blue", CREATE: "green", UPDATE: "amber", STATUS_CHANGE: "violet", PAYMENT: "green", ACCESS_DENIED: "red", LOGIN_FAILED: "red", LOGIN: "gray", LOGOUT: "gray" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePermission("audit:read");
  const q = auditListQuery.parse({ ...(await searchParams), pageSize: 25 });
  const [result, facets] = await Promise.all([listAuditLogs(user, q), auditFacets(user)]);
  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of sensitive reads, edits, payments, sign-ins and denied access." />
      <Card>
        <form className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_160px_160px_auto] lg:items-end" aria-label="Filter audit log">
          <Field label="Action" name="action">
            <Select name="action" defaultValue={q.action ?? ""}><option value="">Any action</option>{facets.actions.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}</Select>
          </Field>
          <Field label="Record type" name="entityType">
            <Select name="entityType" defaultValue={q.entityType ?? ""}><option value="">Any record</option>{facets.entityTypes.map((e) => <option key={e} value={e}>{e}</option>)}</Select>
          </Field>
          <Field label="From" name="from"><Input name="from" type="date" defaultValue={q.from ?? ""} /></Field>
          <Field label="To" name="to"><Input name="to" type="date" defaultValue={q.to ?? ""} /></Field>
          <Button type="submit" variant="secondary">Filter</Button>
          {q.patientId && <input type="hidden" name="patientId" value={q.patientId} />}
        </form>
        {result.items.length === 0 ? (
          <EmptyState title="No audit entries match" />
        ) : (
          <Table head={["When", "Actor", "Action", "Record", "Patient", "Details"]} caption="Audit entries">
            {result.items.map((e) => (
              <tr key={e.id}>
                <Td className="tabular-nums">{formatLocal(e.createdAt)}</Td>
                <Td>{e.actor ? <>{e.actor.name} <span className="text-xs text-slate-500">{e.actorRole && titleCase(e.actorRole)}</span></> : <span className="text-slate-500">anonymous</span>}</Td>
                <Td><Badge tone={TONE[e.action] ?? "gray"}>{titleCase(e.action)}</Badge></Td>
                <Td>{e.entityType}<span className="ml-1 font-mono text-xs text-slate-500">{e.entityId?.slice(0, 32)}</span></Td>
                <Td>{e.patientId ? <Link className="text-teal-700 hover:underline" href={`/audit?patientId=${e.patientId}`}>filter</Link> : "—"}</Td>
                <Td className="max-w-[280px] truncate font-mono text-xs text-slate-600">{e.metadata ? JSON.stringify(e.metadata) : ""}</Td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/audit" params={{ action: q.action, entityType: q.entityType, from: q.from, to: q.to, patientId: q.patientId }} />
      </Card>
    </>
  );
}
