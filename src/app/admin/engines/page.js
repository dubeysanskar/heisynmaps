import { adminSession } from "@/components/admin/guard";
import { Badge, fmtNum, Table, Td } from "@/components/admin/ui";
import { Card, PageHeader } from "@/components/dash/DashShell";
import { engineHealth, envSummary, runtimeCaches } from "@/lib/admin";

export default async function AdminEngines() {
  if (!(await adminSession())) return null;
  const [engines, env, caches] = await Promise.all([engineHealth(), envSummary(), runtimeCaches()]);
  const fallbacks = Object.values(engines).filter((e) => e.mode === "public-fallback");

  return (
    <>
      <PageHeader title="Engines" description="Live health of the map engines behind the API, probed when this page loads." />
      <div className="space-y-6 p-4 sm:p-6">
        {fallbacks.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">{fallbacks.map((e) => e.engine).join(", ")} running on public development fallbacks.</p>
            <p className="mt-1">
              Their fair-use policies forbid production traffic. Deploy <code>infra/docker-compose.yml</code>, set the engine URLs
              and <code>REQUIRE_SELF_HOSTED=1</code> before onboarding paying customers.
            </p>
          </div>
        )}

        <div className="grid *:min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(engines).map(([id, e]) => (
            <div key={id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{id}</p>
                <span
                  className={`flex items-center gap-1.5 text-xs font-medium ${
                    e.ok === false ? "text-red-700" : e.mode === "disabled" ? "text-slate-500" : "text-emerald-700"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${e.ok === false ? "bg-red-500" : e.mode === "disabled" ? "bg-slate-300" : "bg-emerald-500"}`} />
                  {e.ok === false ? "Down" : e.mode === "disabled" ? "Not configured" : "Up"}
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold">{e.engine}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <Badge value={e.mode} />
                {e.host && <span className="font-mono">{e.host}</span>}
                {e.latency_ms != null && <span>{e.latency_ms} ms</span>}
              </div>
              {e.error && <p className="mt-2 text-xs text-red-700">{e.error}</p>}
            </div>
          ))}
        </div>

        <div className="grid *:min-w-0 gap-6 lg:grid-cols-2">
          <Card title="Configuration">
            <Table head={["Variable", "State", "Value"]} minWidth={420}>
              {env.map((v) => (
                <tr key={v.name}>
                  <Td mono>{v.name}</Td>
                  <Td>{v.set ? <Badge value="active">Set</Badge> : <Badge value="expired">Not set</Badge>}</Td>
                  <Td mono className="text-slate-500">
                    {v.set ? v.shown ?? "hidden" : "—"}
                  </Td>
                </tr>
              ))}
            </Table>
            <p className="mt-3 text-xs text-slate-500">Secret values are never shown. URLs show only their host.</p>
          </Card>
          <Card title="In-memory caches (this instance)">
            <Table head={["Cache", { label: "Entries", right: true }]} minWidth={320}>
              {caches.map((c) => (
                <tr key={c.name}>
                  <Td>{c.name}</Td>
                  <Td right>{fmtNum(c.size)}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </div>
    </>
  );
}
