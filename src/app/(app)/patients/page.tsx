import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { listPatients } from "@/server/services/patients";
import { GENDERS, patientListQuery } from "@/lib/validation/patient";
import { ageFrom, fullName, titleCase } from "@/lib/format";
import { Button, ButtonLink, Card, EmptyState, Input, PageHeader, Pagination, Select, Table, Td } from "@/components/ui";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePermission("patient:read");
  const sp = await searchParams;
  const query = patientListQuery.parse({ ...sp, pageSize: 15 });
  const result = await listPatients(user, query);

  return (
    <>
      <PageHeader
        title="Patients"
        description="Search by name, MRN or phone number."
        actions={can(user.role, "patient:write") ? <ButtonLink href="/patients/new">Register patient</ButtonLink> : null}
      />
      <Card>
        <form className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]" role="search" aria-label="Search patients">
          <label className="sr-only" htmlFor="q">Search</label>
          <Input name="q" placeholder="Name, MRN or phone" defaultValue={query.q ?? ""} />
          <label className="sr-only" htmlFor="gender">Gender</label>
          <Select name="gender" defaultValue={query.gender ?? ""}>
            <option value="">All genders</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>{titleCase(g)}</option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        {result.items.length === 0 ? (
          <EmptyState title="No patients found">Try a different search term or clear the filters.</EmptyState>
        ) : (
          <Table head={["MRN", "Name", "Age", "Gender", "Phone"]} caption="Patients">
            {result.items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td className="font-mono text-xs">{p.mrn}</Td>
                <Td>
                  <Link href={`/patients/${p.id}`} className="font-medium text-teal-700 hover:underline">{fullName(p)}</Link>
                </Td>
                <Td>{ageFrom(p.dateOfBirth)}</Td>
                <Td>{titleCase(p.gender)}</Td>
                <Td>{p.phone}</Td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/patients" params={{ q: query.q, gender: query.gender }} />
      </Card>
    </>
  );
}
