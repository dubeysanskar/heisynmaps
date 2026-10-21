import Link from "next/link";
import { RankBars, DailyBars } from "@/components/admin/charts";
import { adminSession } from "@/components/admin/guard";
import { Badge, fmtInr, fmtNum, fmtPct, StatusCode, Table, Td, timeAgo } from "@/components/admin/ui";
import { Card, PageHeader, Stat } from "@/components/dash/DashShell";
import { callsPerDay, engineHealth, orgLabel, overviewStats, recentErrors, topOrgs, topSkus } from "@/lib/admin";

export default async function AdminOverview() {
  if (!(await adminSession())) return null;
  const [stats, daily, orgs, skus, errors, engines] = await Promise.all([
    overviewStats(),
    callsPerDay(30),
    topOrgs(8),
    topSkus(8),
    recentErrors(8),
    engineHealth(),
  ]);

  return (
    <>
      <PageHeader title="Platform overview" description="Every organisation, key and API call across HeisynMaps." />
      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid *:min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Organisations" value={fmtNum(stats.orgs)} hint={stats.suspendedOrgs ? `${stats.suspendedOrgs} suspended` : "none suspended"} />
          <Stat label="Users" value={fmtNum(stats.users)} hint={`${stats.admins} admin${stats.admins === 1 ? "" : "s"}`} />
          <Stat label="Active API keys" value={fmtNum(stats.activeKeys)} />
          <Stat label="Calls today" value={fmtNum(stats.callsToday)} hint={`${fmtNum(stats.callsMonth)} this month`} />
          <Stat label="Calls, last 30 days" value={fmtNum(stats.calls30)} />
          <Stat
            label="Server error rate (24 h)"
            value={fmtPct(stats.errorRate24h)}
            hint={`${fmtNum(stats.serverErrors24h)} 5xx · ${fmtNum(stats.clientErrors24h)} 4xx of ${fmtNum(stats.requests24h)}`}
          />
          <Stat label="Est. overage revenue (MTD)" value={fmtInr(stats.revenue.totalInr)} hint="Paid plans above included calls" />
          <Stat
            label="Engines"
            value={`${Object.values(engines).filter((e) => e.ok !== false).length}/${Object.keys(engines).length} up`}
            hint={Object.values(engines).some((e) => ["not-configured", "missing"].includes(e.mode)) ? "Some not set up" : "All self-hosted"}
          />
        </div>

        <div className="grid *:min-w-0 gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Card title="Calls per day, all customers">
            <DailyBars data={daily} height={160} />
          </Card>
          <Card title="Engine health" actions={<Link href="/admin/engines" className="text-xs text-teal-700 hover:underline">Details</Link>}>
            <ul className="divide-y divide-slate-100 text-sm">
              {Object.entries(engines).map(([id, e]) => (
                <li key={id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${e.ok === false ? "bg-red-500" : e.mode === "disabled" ? "bg-slate-300" : "bg-emerald-500"}`} />
                    <span className="font-medium">{e.engine}</span>
                    <span className="text-xs capitalize text-slate-500">{id}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {e.latency_ms != null && <span className="text-xs tabular-nums text-slate-500">{e.latency_ms} ms</span>}
                    <Badge value={e.mode} />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid *:min-w-0 gap-6 lg:grid-cols-2">
          <Card title="Top organisations this month" actions={<Link href="/admin/orgs" className="text-xs text-teal-700 hover:underline">All</Link>}>
            <RankBars
              rows={orgs.map((o) => ({
                key: o.id,
                name: o.name,
                label: (
                  <Link href={o.id === "org_system" ? "/admin/logs?org=org_system" : `/admin/orgs/${o.id}`} className="hover:underline">
                    {o.name} <span className="text-xs text-slate-400">· {o.plan}</span>
                  </Link>
                ),
                value: o.calls,
              }))}
              empty="No calls this month yet"
            />
          </Card>
          <Card title="Top APIs this month" actions={<Link href="/admin/apis" className="text-xs text-teal-700 hover:underline">All APIs</Link>}>
            <RankBars rows={skus.map((s) => ({ key: s.sku, label: s.label, value: s.calls }))} empty="No calls this month yet" />
          </Card>
        </div>

        <Card title="Recent errors" actions={<Link href="/admin/logs?status=errors" className="text-xs text-teal-700 hover:underline">All errors</Link>}>
          <Table head={["Status", "Request", "Error", "Organisation", { label: "When", right: true }]} empty={errors.length ? null : "No errors. Nice."}>
            {errors.map((r, i) => (
              <tr key={i}>
                <Td>
                  <StatusCode status={r.status} />
                </Td>
                <Td mono>
                  {r.method} {r.path}
                </Td>
                <Td mono className="text-slate-600">
                  {r.error_code || "—"}
                </Td>
                <Td className="text-slate-600">{orgLabel(r.org_id, r.org_name)}</Td>
                <Td right className="text-slate-500">
                  {timeAgo(r.ts)}
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
