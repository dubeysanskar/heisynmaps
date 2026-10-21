import Link from "next/link";
import { notFound } from "next/navigation";
import { fmt, timeAgo } from "@/components/console/format";
import KeyActions from "@/components/console/KeyActions";
import KeyForm from "@/components/console/KeyForm";
import { DailyBars, HttpStatus, StatusBadge } from "@/components/console/ui";
import { Card, PageHeader, Stat } from "@/components/dash/DashShell";
import { getSessionUser } from "@/lib/auth";
import { SKUS } from "@/lib/catalog";
import { getOrg, planFor, requestLogs, usage } from "@/lib/console";
import { getApiKey } from "@/lib/keys";

export default async function KeyDetailPage({ params }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) return null; // the layout renders the sign-in form
  const key = await getApiKey(session.org.id, id);
  if (!key) notFound();
  const [u, logs, plan] = await Promise.all([
    usage(session.org.id, { keyId: id }),
    requestLogs(session.org.id, { keyId: id, limit: 10 }),
    getOrg(session.org.id).then(planFor),
  ]);

  const totals = new Map();
  const bySku = new Map();
  for (const r of u.daily) {
    totals.set(r.day, (totals.get(r.day) || 0) + r.count);
    bySku.set(r.sku, (bySku.get(r.sku) || 0) + r.count);
  }
  const days = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10);
    return { day, count: totals.get(day) || 0 };
  });
  const total30 = days.reduce((n, d) => n + d.count, 0);

  return (
    <>
      <PageHeader
        title={key.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={key.status} />
            <span className="font-mono">{key.prefix}…</span>
            <span>· {key.kind === "browser" ? "Browser key" : "Server key"}</span>
            <span>· created {timeAgo(key.createdAt)}</span>
            <span>· last used {timeAgo(key.lastUsedAt)}</span>
          </span>
        }
        actions={
          <Link href="/console/keys" className="text-sm text-slate-600 hover:text-slate-900">
            ← All keys
          </Link>
        }
      />
      <div className="grid gap-6 p-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card title="Settings">
            <KeyForm existing={key} planRpm={plan.rpm} />
          </Card>
          <Card title="Manage">
            <p className="mb-3 text-sm text-slate-600">
              Rotate if the secret may have leaked. Disabling is reversible; deleting is not.
            </p>
            <KeyActions apiKey={key} />
          </Card>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Calls, last 30 days" value={fmt(total30)} />
            <Stat label="Calls today" value={fmt(days[29].count)} hint={key.dailyQuota ? `of ${fmt(key.dailyQuota)} daily quota` : undefined} />
          </div>
          <Card title="Calls per day">
            <DailyBars days={days} />
            {bySku.size > 0 && (
              <table className="mt-4 w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {[...bySku]
                    .sort((a, b) => b[1] - a[1])
                    .map(([sku, n]) => (
                      <tr key={sku}>
                        <td className="py-1.5">{SKUS[sku]?.label || sku}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmt(n)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card title="Recent requests" actions={<Link href={`/console/logs?key=${key.id}`} className="text-xs text-teal-700 hover:underline">All</Link>}>
            {logs.rows.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">No requests with this key yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {logs.rows.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 py-2">
                    <HttpStatus status={r.status} />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{r.method} {r.path}</span>
                    <span className="shrink-0 text-xs text-slate-500">{timeAgo(r.ts)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
