import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { listDepartments, listDoctors, listStaff } from "@/server/services/directory";
import { doctorListQuery, STAFF_ROLES, staffListQuery } from "@/lib/validation/directory";
import { formatINR } from "@/lib/money";
import { titleCase } from "@/lib/format";
import { Badge, Button, ButtonLink, Card, EmptyState, Input, PageHeader, Pagination, Select, Table, Td, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Directory" };

const TABS = [
  { id: "doctors", label: "Doctors" },
  { id: "departments", label: "Departments" },
  { id: "staff", label: "Staff" },
] as const;

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePermission("directory:read");
  const sp = await searchParams;
  const tab = TABS.some((t) => t.id === sp.tab) ? sp.tab : "doctors";
  const departments = await listDepartments(user);

  return (
    <>
      <PageHeader
        title="Directory"
        description="Departments, doctors and their working schedules, and hospital staff."
        actions={can(user.role, "directory:write") ? <ButtonLink href="/directory/manage">Add to directory</ButtonLink> : null}
      />
      <nav aria-label="Directory sections" className="mb-4 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/directory?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cx("-mb-px border-b-2 px-4 py-2 text-sm font-medium", tab === t.id ? "border-teal-700 text-teal-800" : "border-transparent text-slate-600 hover:text-slate-900")}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "departments" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <Card key={d.id} title={<span>{d.name} <span className="ml-1 font-mono text-xs text-slate-500">{d.code}</span></span>}>
              <p className="text-sm text-slate-600">{d.description ?? "—"}</p>
              <p className="mt-3 text-xs text-slate-500">{d._count.doctors} doctors · {d._count.staff} staff</p>
              <Link className="mt-2 inline-block text-sm text-teal-700 hover:underline" href={`/directory?tab=doctors&departmentId=${d.id}`}>View doctors</Link>
            </Card>
          ))}
        </div>
      )}

      {tab === "doctors" && <DoctorsTab user={user} sp={sp} departments={departments} />}
      {tab === "staff" && <StaffTab user={user} sp={sp} departments={departments} />}
    </>
  );
}

type Depts = Awaited<ReturnType<typeof listDepartments>>;
type U = Awaited<ReturnType<typeof requirePermission>>;

async function DoctorsTab({ user, sp, departments }: { user: U; sp: Record<string, string>; departments: Depts }) {
  const q = doctorListQuery.parse({ ...sp, pageSize: 10 });
  const result = await listDoctors(user, q);
  return (
    <Card>
      <form className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px_auto]" role="search" aria-label="Search doctors">
        <input type="hidden" name="tab" value="doctors" />
        <label htmlFor="q" className="sr-only">Search doctors</label>
        <Input name="q" placeholder="Name or specialty" defaultValue={q.q ?? ""} />
        <label htmlFor="departmentId" className="sr-only">Department</label>
        <Select name="departmentId" defaultValue={q.departmentId ?? ""}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      {result.items.length === 0 ? (
        <EmptyState title="No doctors match these filters" />
      ) : (
        <Table head={["Doctor", "Department", "Specialty", "Slot", "Fee", ""]} caption="Doctors">
          {result.items.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <Td><Link className="font-medium text-teal-700 hover:underline" href={`/directory/doctors/${d.id}`}>Dr. {d.firstName} {d.lastName}</Link></Td>
              <Td>{d.department.name}</Td>
              <Td>{d.specialty}</Td>
              <Td>{d.slotMinutes} min</Td>
              <Td>{formatINR(d.consultationFeeCents)}</Td>
              <Td>{can(user.role, "appointment:write") && <Link className="text-sm text-teal-700 hover:underline" href={`/appointments/new?doctorId=${d.id}`}>Book</Link>}</Td>
            </tr>
          ))}
        </Table>
      )}
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/directory" params={{ tab: "doctors", q: q.q, departmentId: q.departmentId }} />
    </Card>
  );
}

async function StaffTab({ user, sp, departments }: { user: U; sp: Record<string, string>; departments: Depts }) {
  const q = staffListQuery.parse({ ...sp, pageSize: 10 });
  const result = await listStaff(user, q);
  return (
    <Card>
      <form className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px_200px_auto]" role="search" aria-label="Search staff">
        <input type="hidden" name="tab" value="staff" />
        <label htmlFor="q" className="sr-only">Search staff</label>
        <Input name="q" placeholder="Name" defaultValue={q.q ?? ""} />
        <label htmlFor="staffRole" className="sr-only">Role</label>
        <Select name="staffRole" defaultValue={q.staffRole ?? ""}>
          <option value="">All roles</option>
          {STAFF_ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
        </Select>
        <label htmlFor="departmentId" className="sr-only">Department</label>
        <Select name="departmentId" defaultValue={q.departmentId ?? ""}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      {result.items.length === 0 ? (
        <EmptyState title="No staff match these filters" />
      ) : (
        <Table head={["Name", "Role", "Department", "Email", "Phone"]} caption="Staff">
          {result.items.map((s) => (
            <tr key={s.id}>
              <Td className="font-medium">{s.firstName} {s.lastName}</Td>
              <Td><Badge tone="violet">{titleCase(s.staffRole)}</Badge></Td>
              <Td>{s.department?.name ?? "—"}</Td>
              <Td>{s.email}</Td>
              <Td>{s.phone}</Td>
            </tr>
          ))}
        </Table>
      )}
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/directory" params={{ tab: "staff", q: q.q, staffRole: q.staffRole, departmentId: q.departmentId }} />
    </Card>
  );
}
