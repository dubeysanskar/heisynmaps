import Link from "next/link";
import { fmt, inr, timeAgo } from "@/components/console/format";
import { DailyBars, HttpStatus } from "@/components/console/ui";
import { Card, PageHeader, Stat } from "@/components/dash/DashShell";
import { getSessionUser } from "@/lib/auth";
import { overview } from "@/lib/console";

export default async function ConsoleOverview() {
  const session = await getSessionUser();
  if (!session) return null; // the layout renders the sign-in form
  const data = await overview(session.org.id);
  const included = data.plan.includedPerSku;

  return (
    <>
      <PageHeader
        title={data.org.name}
        description={`${data.plan.name} plan · ${fmt(data.plan.rpm)} requests/minute${included ? ` · ${fmt(included)} free calls per API each month` : ""}`}
        actions={
          <Link href="/console/keys/new" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
            Create API key
          </Link>
        }
      />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Calls today" value={fmt(data.callsToday)} />
          <Stat label="Calls this month" value={fmt(data.callsMonth)} />
          <Stat label="Active keys" value={fmt(data.activeKeys)} />
          <Stat
            label="Error rate (7 days)"
            value={`${(data.errorRate7d * 100).toFixed(1)}%`}
            hint={`${fmt(data.requests7d)} requests`}
          />
        </div>

        {data.activeKeys === 0 && (
          <Card title="Get started in three steps">
            <ol className="grid gap-4 text-sm md:grid-cols-3">
              {[
                ["Create a key", "A server key for your backend, or a browser key locked to your website.", "/console/keys/new", "Create key"],
                ["Make a call", "Try any endpoint live in the playground before writing code.", "/console/playground", "Open playground"],
                ["Read the docs", "Guides for dispatch, service areas, geofencing and embedding the map.", "/docs", "Open docs"],
              ].map(([title, body, href, cta], i) => (
                <li key={title} className="rounded-xl bg-slate-50 p-4">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white">{i + 1}</span>
                  <p className="mt-3 font-semibold">{title}</p>
                  <p className="mt-1 text-slate-600">{body}</p>
                  <Link href={href} className="mt-3 inline-block font-medium text-teal-700 hover:underline">
                    {cta} →
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card title="Calls per day" actions={<Link href="/console/usage" className="text-xs text-teal-700 hover:underline">Usage details</Link>}>
            <DailyBars days={data.daily} height={150} />
          </Card>
          <Card title="This month by API">
            {data.month.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No calls yet this month.</p>
            ) : (
              <ul className="space-y-3">
                {data.month.slice(0, 8).map((r) => {
                  const pct = included ? Math.min(100, (r.count / included) * 100) : 0;
                  return (
                    <li key={r.sku}>
                      <div className="flex justify-between text-sm">
                        <span>{r.label}</span>
                        <span className="tabular-nums text-slate-600">
                          {fmt(r.count)}
                          {included ? <span className="text-slate-400"> / {fmt(included)}</span> : null}
                        </span>
                      </div>
                      {included ? (
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                          <div className={`h-1.5 rounded-full ${pct >= 90 ? "bg-amber-500" : "bg-teal-600"}`} style={{ width: `${Math.max(pct, 1)}%` }} />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {data.overageInr > 0 && <p className="mt-4 text-sm text-slate-600">Overage so far: {inr(data.overageInr)}</p>}
          </Card>
        </div>

        <Card title="Recent requests" actions={<Link href="/console/logs" className="text-xs text-teal-700 hover:underline">All logs</Link>}>
          {data.recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No requests yet.</p>
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <tbody className="divide-y divide-slate-100">
                  {data.recent.map((r, i) => (
                    <tr key={i}>
                      <td className="px-5 py-2"><HttpStatus status={r.status} /></td>
                      <td className="py-2 font-mono text-xs">{r.method} {r.path}</td>
                      <td className="py-2 text-slate-600">{r.keyName}</td>
                      <td className="py-2 text-right tabular-nums text-slate-500">{r.latency_ms} ms</td>
                      <td className="px-5 py-2 text-right text-slate-500">{timeAgo(r.ts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
