import Link from "next/link";
import { ApiControls } from "@/components/admin/actions";
import { adminSession } from "@/components/admin/guard";
import { Badge, fmtInr, fmtMs, fmtNum, fmtPct, Table, Td } from "@/components/admin/ui";
import { Card, PageHeader } from "@/components/dash/DashShell";
import { apiStats } from "@/lib/admin";
import { API_GROUPS, ENDPOINTS, SKUS, skuGroup } from "@/lib/catalog";

export default async function AdminApis() {
  if (!(await adminSession())) return null;
  const { stats, skus } = await apiStats();
  const groups = Object.keys(API_GROUPS);
  const ids = Object.keys(SKUS).sort((a, b) => groups.indexOf(skuGroup(a)) - groups.indexOf(skuGroup(b)));
  const disabledCount = ids.filter((id) => skus[id].disabled).length;

  return (
    <>
      <PageHeader
        title="APIs"
        description="Switch any API off for every customer (calls get 503 api_disabled), and set overage prices. Changes apply within 15 seconds."
      />
      <div className="space-y-4 p-4 sm:p-6">
        {disabledCount > 0 && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {disabledCount} API{disabledCount === 1 ? " is" : "s are"} switched off right now.
          </p>
        )}
        <Card>
          <Table
            head={[
              "API",
              { label: "Calls (30 d)", right: true },
              { label: "Errors 5xx · 4xx (7 d)", right: true },
              { label: "p50 / p95", right: true },
              { label: "₹ / 1,000", right: true },
              "State",
              { label: "", right: true },
            ]}
            minWidth={820}
          >
            {ids.map((id) => {
              const s = stats[id];
              const sku = skus[id];
              const endpoints = ENDPOINTS.filter((e) => e.sku === id);
              return (
                <tr key={id} className="align-top">
                  <Td wrap>
                    <span className="font-medium">{sku.label}</span>
                    <span className="ml-2 text-xs text-slate-500">{API_GROUPS[skuGroup(id)]}</span>
                    <span className="block font-mono text-[11px] text-slate-400">
                      {id}
                      {endpoints.map((e) => ` · ${e.method} ${e.path.replace("/api/v1", "")}`).join("")}
                    </span>
                  </Td>
                  <Td right>{fmtNum(s.calls30)}</Td>
                  <Td right className="text-slate-600">
                    {s.requests7d ? (
                      <>
                        <span className={s.serverErrorRate > 0.02 ? "font-medium text-red-700" : ""}>{fmtPct(s.serverErrorRate)}</span>
                        <span className="text-slate-400"> · </span>
                        {fmtPct(s.clientErrorRate)}
                      </>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td right className="text-slate-600">
                    {s.p50 == null ? "—" : `${fmtMs(s.p50)} / ${fmtMs(s.p95)}`}
                  </Td>
                  <Td right>{sku.inrPer1k ? fmtInr(sku.inrPer1k) : <span className="text-teal-700">Free</span>}</Td>
                  <Td wrap>
                    {sku.disabled ? <Badge value="disabled">Off</Badge> : <Badge value="active">On</Badge>}
                    {sku.disabled && sku.note && <span className="mt-1 block max-w-[180px] text-xs text-slate-500">{sku.note}</span>}
                  </Td>
                  <Td right>
                    <ApiControls sku={id} current={{ disabled: sku.disabled, inrPer1k: sku.inrPer1k, note: sku.note }} />
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Card>
        <p className="text-xs text-slate-500">
          Latency percentiles use successful requests from the last 7 days. Request logs are kept for 14 days. Price changes
          show on <Link href="/pricing" className="underline">/pricing</Link> wherever it reads effective prices.
        </p>
      </div>
    </>
  );
}
