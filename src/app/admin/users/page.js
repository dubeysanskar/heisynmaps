import Link from "next/link";
import { RoleButton } from "@/components/admin/actions";
import { adminSession } from "@/components/admin/guard";
import { Badge, fmtDate, Pager, SearchForm, Table, Td } from "@/components/admin/ui";
import { Card, PageHeader } from "@/components/dash/DashShell";
import { listUsers } from "@/lib/admin";

const LIMIT = 100;

export default async function AdminUsers({ searchParams }) {
  const session = await adminSession();
  if (!session) return null;
  const sp = await searchParams;
  const q = sp.q || "";
  const offset = Math.max(0, Number(sp.offset) || 0);
  const { users, hasMore } = await listUsers({ q, limit: LIMIT, offset });

  return (
    <>
      <PageHeader title="Users" description="Accounts that can sign in. Admins can manage the whole platform." />
      <div className="p-4 sm:p-6">
        <Card>
          <SearchForm action="/admin/users" q={q} placeholder="Search email, name or organisation" />
          <div className="mt-4" />
          <Table head={["Email", "Name", "Organisation", "Role", "Joined", { label: "", right: true }]} empty={users.length ? null : "No users found"}>
            {users.map((u) => (
              <tr key={u.id}>
                <Td className="font-medium">
                  {u.email}
                  {u.id === session.user.id && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}
                </Td>
                <Td className="text-slate-600">{u.name || "—"}</Td>
                <Td>
                  <Link href={`/admin/orgs/${u.org_id}`} className="hover:text-teal-700 hover:underline">
                    {u.org_name || u.org_id}
                  </Link>
                  {u.org_status === "suspended" && <span className="ml-2"><Badge value="suspended" /></span>}
                </Td>
                <Td>
                  <Badge value={u.role || "member"} />
                </Td>
                <Td className="text-slate-500">{fmtDate(u.created_at)}</Td>
                <Td right>
                  <RoleButton user={{ id: u.id, email: u.email, role: u.role }} isSelf={u.id === session.user.id} />
                </Td>
              </tr>
            ))}
          </Table>
          <Pager basePath="/admin/users" params={{ q }} offset={offset} limit={LIMIT} hasMore={hasMore} />
        </Card>
      </div>
    </>
  );
}
