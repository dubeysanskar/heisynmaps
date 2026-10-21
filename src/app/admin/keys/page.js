import Link from "next/link";
import { KeyActions } from "@/components/admin/actions";
import { adminSession } from "@/components/admin/guard";
import { Badge, fmtNum, Pager, SearchForm, Table, Td, timeAgo } from "@/components/admin/ui";
import { Card, PageHeader } from "@/components/dash/DashShell";
import { listAllKeys } from "@/lib/admin";

const LIMIT = 100;
const STATUSES = ["", "active", "disabled", "expired", "revoked"];

export default async function AdminKeys({ searchParams }) {
  if (!(await adminSession())) return null;
  const sp = await searchParams;
  const q = sp.q || "";
  const status = STATUSES.includes(sp.status) ? sp.status : "";
  const offset = Math.max(0, Number(sp.offset) || 0);
  const { keys, hasMore } = await listAllKeys({ q, status, limit: LIMIT, offset });

  return (
    <>
      <PageHeader title="API keys" description="Every key across all organisations. Disabling or revoking takes effect within seconds." />
      <div className="p-4 sm:p-6">
        <Card>
          <SearchForm action="/admin/keys" q={q} placeholder="Search key name, prefix or organisation">
            <select name="status" defaultValue={status} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s ? s[0].toUpperCase() + s.slice(1) : "Any status"}
                </option>
              ))}
            </select>
          </SearchForm>
          <div className="mt-4" />
          <Table
            head={["Key", "Organisation", "Kind", "Scopes", "Restrictions", "Status", { label: "Calls today", right: true }, "Last used", { label: "", right: true }]}
            empty={keys.length ? null : "No keys found"}
          >
            {keys.map((k) => {
              const restrictions = [
                k.allowed_origins && `${k.allowed_origins.split(",").length} origin(s)`,
                k.allowed_ips && `${k.allowed_ips.split(",").length} IP(s)`,
                k.rpm_limit && `${fmtNum(k.rpm_limit)}/min`,
                k.daily_quota && `${fmtNum(k.daily_quota)}/day`,
                k.expires_at && `expires ${new Date(k.expires_at).toLocaleDateString("en-IN")}`,
              ].filter(Boolean);
              return (
                <tr key={k.id} className={k.status === "revoked" ? "opacity-60" : ""}>
                  <Td>
                    <span className="font-medium">{k.name}</span>
                    <span className="block font-mono text-[11px] text-slate-400">{k.prefix}…</span>
                  </Td>
                  <Td>
                    <Link href={`/admin/orgs/${k.org_id}`} className="hover:text-teal-700 hover:underline">
                      {k.org_name || k.org_id}
                    </Link>
                  </Td>
                  <Td className="capitalize">{k.kind}</Td>
                  <Td className="text-xs text-slate-600">{k.scopes ? k.scopes.split(",").join(", ") : "All APIs"}</Td>
                  <Td className="text-xs text-slate-600">{restrictions.length ? restrictions.join(" · ") : "None"}</Td>
                  <Td>
                    <Badge value={k.status} />
                  </Td>
                  <Td right>{fmtNum(k.calls_today)}</Td>
                  <Td className="text-slate-500">{timeAgo(k.last_used_at)}</Td>
                  <Td right>
                    <KeyActions apiKey={{ id: k.id, name: k.name, status: k.status }} />
                  </Td>
                </tr>
              );
            })}
          </Table>
          <Pager basePath="/admin/keys" params={{ q, status }} offset={offset} limit={LIMIT} hasMore={hasMore} />
        </Card>
      </div>
    </>
  );
}
