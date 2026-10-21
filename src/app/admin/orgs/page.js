import Link from "next/link";
import { adminSession } from "@/components/admin/guard";
import { Badge, fmtDate, fmtNum, Pager, SearchForm, Table, Td } from "@/components/admin/ui";
import { Card, PageHeader } from "@/components/dash/DashShell";
import { listOrgs } from "@/lib/admin";

const LIMIT = 50;

export default async function AdminOrgs({ searchParams }) {
  if (!(await adminSession())) return null;
  const sp = await searchParams;
  const q = sp.q || "";
  const offset = Math.max(0, Number(sp.offset) || 0);
  const { orgs, hasMore } = await listOrgs({ q, limit: LIMIT, offset });

  return (
    <>
      <PageHeader title="Organizations" description="Every customer account. Open one to change its plan, limits or status." />
      <div className="p-4 sm:p-6">
        <Card>
          <SearchForm action="/admin/orgs" q={q} placeholder="Search name, id or member email" />
          <div className="mt-4" />
          <Table
            head={["Organisation", "Plan", "Status", { label: "Users", right: true }, { label: "Keys", right: true }, { label: "Calls (MTD)", right: true }, "Created"]}
            empty={orgs.length ? null : q ? `No organisations match “${q}”` : "No organisations yet"}
          >
            {orgs.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <Td>
                  <Link href={`/admin/orgs/${o.id}`} className="font-medium text-slate-900 hover:text-teal-700 hover:underline">
                    {o.name}
                  </Link>
                  <span className="block font-mono text-[11px] text-slate-400">{o.id}</span>
                </Td>
                <Td>
                  <Badge value={o.plan} />
                </Td>
                <Td>
                  <Badge value={o.status || "active"} />
                </Td>
                <Td right>{fmtNum(o.users)}</Td>
                <Td right>{fmtNum(o.keys)}</Td>
                <Td right>{fmtNum(o.calls)}</Td>
                <Td className="text-slate-500">{fmtDate(o.created_at)}</Td>
              </tr>
            ))}
          </Table>
          <Pager basePath="/admin/orgs" params={{ q }} offset={offset} limit={LIMIT} hasMore={hasMore} />
        </Card>
      </div>
    </>
  );
}
