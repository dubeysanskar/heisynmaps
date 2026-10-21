import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyActions, OrgControls, RoleButton } from "@/components/admin/actions";
import { DailyBars } from "@/components/admin/charts";
import { adminSession } from "@/components/admin/guard";
import { Badge, fmtDate, fmtInr, fmtNum, StatusCode, Table, Td, timeAgo } from "@/components/admin/ui";
import { Card, PageHeader, Stat } from "@/components/dash/DashShell";
import { callsPerDay, getOrg } from "@/lib/admin";

export default async function AdminOrgDetail({ params }) {
  const session = await adminSession();
  if (!session) return null;
  const { id } = await params;
  const [data, daily] = await Promise.all([getOrg(id), callsPerDay(30, { orgId: id })]);
  if (!data) notFound();
  const { org, members, keys, usage, recent } = data;
  const monthCalls = usage.reduce((s, u) => s + u.calls, 0);
  const overage = usage.reduce((s, u) => s + u.overageInr, 0);
  const rpm = org.rpm_override ?? org.planInfo.rpm;

  return (
    <>
      <PageHeader
        title={org.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge value={org.plan} />
            <Badge value={org.status || "active"} />
            <span className="font-mono text-xs text-slate-400">{org.id}</span>
            <span className="text-slate-500">· created {fmtDate(org.created_at)}</span>
          </span>
        }
        actions={
          <Link href="/admin/orgs" className="text-sm text-slate-600 hover:text-slate-900">
            ← All organisations
          </Link>
        }
      />
      <div className="space-y-6 p-4 sm:p-6">
        {org.status === "suspended" && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            This organisation is suspended. Every API call from its keys returns <code>403 account_suspended</code>.
          </p>
        )}
        <div className="grid *:min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Calls this month" value={fmtNum(monthCalls)} />
          <Stat label="Estimated overage" value={fmtInr(overage)} hint={org.planInfo.hardCap ? "Free plan is hard-capped" : null} />
          <Stat label="Rate limit" value={`${fmtNum(rpm)}/min`} hint={org.rpm_override != null ? "Custom override" : "Plan default"} />
          <Stat
            label="Included per API / month"
            value={Number.isFinite(org.included) ? fmtNum(org.included) : "Unlimited"}
            hint={org.quota_override != null ? "Custom override" : "Plan default"}
          />
        </div>

        <Card title="Plan, limits and status">
          <OrgControls org={{ id: org.id, name: org.name, plan: org.plan, status: org.status, rpm_override: org.rpm_override, quota_override: org.quota_override, notes: org.notes }} />
        </Card>

        <div className="grid *:min-w-0 gap-6 xl:grid-cols-2">
          <Card title="Calls per day">
            <DailyBars data={daily} height={130} />
          </Card>
          <Card title="Usage by API this month">
            <Table
              head={["API", { label: "Calls", right: true }, { label: "Included", right: true }, { label: "Overage", right: true }]}
              minWidth={420}
              empty={usage.length ? null : "No calls this month"}
            >
              {usage.map((u) => (
                <tr key={u.sku}>
                  <Td>
                    {u.label} <span className="font-mono text-[11px] text-slate-400">{u.sku}</span>
                  </Td>
                  <Td right>{fmtNum(u.calls)}</Td>
                  <Td right className="text-slate-500">
                    {Number.isFinite(u.included) ? fmtNum(u.included) : "∞"}
                  </Td>
                  <Td right>{fmtInr(u.overageInr)}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>

        <Card title={`Members (${members.length})`}>
          <Table head={["Email", "Name", "Role", "Joined", { label: "", right: true }]} empty={members.length ? null : "No members"}>
            {members.map((m) => (
              <tr key={m.id}>
                <Td className="font-medium">{m.email}</Td>
                <Td className="text-slate-600">{m.name || "—"}</Td>
                <Td>
                  <Badge value={m.role || "member"} />
                </Td>
                <Td className="text-slate-500">{fmtDate(m.created_at)}</Td>
                <Td right>
                  <RoleButton user={m} isSelf={m.id === session.user.id} />
                </Td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title={`API keys (${keys.filter((k) => k.status !== "revoked").length} live)`}>
          <Table
            head={["Key", "Kind", "Scopes", "Status", { label: "Calls (MTD)", right: true }, "Last used", { label: "", right: true }]}
            empty={keys.length ? null : "No keys yet"}
          >
            {keys.map((k) => (
              <tr key={k.id} className={k.status === "revoked" ? "opacity-60" : ""}>
                <Td>
                  <span className="font-medium">{k.name}</span>
                  <span className="block font-mono text-[11px] text-slate-400">{k.prefix}…</span>
                </Td>
                <Td className="capitalize">{k.kind}</Td>
                <Td className="text-xs text-slate-600">{k.scopes ? k.scopes.split(",").join(", ") : "All APIs"}</Td>
                <Td>
                  <Badge value={k.status} />
                </Td>
                <Td right>{fmtNum(k.calls_month)}</Td>
                <Td className="text-slate-500">{timeAgo(k.last_used_at)}</Td>
                <Td right>
                  <KeyActions apiKey={{ id: k.id, name: k.name, status: k.status }} />
                </Td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Recent requests" actions={<Link href={`/admin/logs?org=${org.id}`} className="text-xs text-teal-700 hover:underline">All logs</Link>}>
          <Table head={["Status", "Request", "Error", { label: "Latency", right: true }, { label: "When", right: true }]} empty={recent.length ? null : "No requests yet"}>
            {recent.map((r, i) => (
              <tr key={i}>
                <Td>
                  <StatusCode status={r.status} />
                </Td>
                <Td mono>
                  {r.method} {r.path}
                </Td>
                <Td mono className="text-slate-500">
                  {r.error_code || "—"}
                </Td>
                <Td right className="text-slate-500">
                  {fmtNum(r.latency_ms)} ms
                </Td>
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
