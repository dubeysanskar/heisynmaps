"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Card } from "@/components/dash/DashShell";
import { fmt, inr } from "./format";
import { DailyBars } from "./ui";

export default function UsageView({ daily, perKey, month, plan, skuLabels, keys, keyId }) {
  const router = useRouter();
  const [sku, setSku] = useState("");
  const days = useMemo(() => {
    const totals = new Map();
    for (const r of daily) if (!sku || r.sku === sku) totals.set(r.day, (totals.get(r.day) || 0) + r.count);
    return Array.from({ length: 30 }, (_, i) => {
      const day = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10);
      return { day, count: totals.get(day) || 0 };
    });
  }, [daily, sku]);
  const skusSeen = [...new Set(daily.map((r) => r.sku))];
  const select = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600";

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap gap-2">
        <select value={keyId || ""} onChange={(e) => router.push(e.target.value ? `/console/usage?key=${e.target.value}` : "/console/usage")} className={select} aria-label="Filter by key">
          <option value="">All keys</option>
          {keys.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
        <select value={sku} onChange={(e) => setSku(e.target.value)} className={select} aria-label="Filter by API">
          <option value="">All APIs</option>
          {skusSeen.map((s) => (
            <option key={s} value={s}>
              {skuLabels[s] || s}
            </option>
          ))}
        </select>
      </div>

      <Card title={`Calls per day${sku ? ` · ${skuLabels[sku] || sku}` : ""}`}>
        <DailyBars days={days} height={170} />
        <p className="mt-3 text-sm text-slate-600">{fmt(days.reduce((n, d) => n + d.count, 0))} calls in the last 30 days</p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="This month by API">
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="px-5 pb-2 font-medium">API</th>
                  <th className="pb-2 text-right font-medium">Calls</th>
                  <th className="pb-2 text-right font-medium">Free left</th>
                  <th className="px-5 pb-2 text-right font-medium">Overage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {month.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      No calls yet this month.
                    </td>
                  </tr>
                )}
                {month.map((r) => (
                  <tr key={r.sku}>
                    <td className="px-5 py-2">{r.label}</td>
                    <td className="py-2 text-right tabular-nums">{fmt(r.count)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-500">
                      {plan.includedPerSku == null ? "Unlimited" : fmt(Math.max(0, plan.includedPerSku - r.count))}
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums">{plan.hardCap ? "—" : inr(r.overageInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.hardCap && (
            <p className="mt-3 text-xs text-slate-500">
              The Free plan stops at {fmt(plan.includedPerSku)} calls per API each month instead of billing overage.
            </p>
          )}
        </Card>
        <Card title="This month by key">
          {perKey.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No calls yet this month.</p>
          ) : (
            <ul className="space-y-3">
              {perKey.map((k) => {
                const max = perKey[0].count || 1;
                return (
                  <li key={k.keyId}>
                    <div className="flex justify-between text-sm">
                      <span>{k.name}</span>
                      <span className="tabular-nums text-slate-600">{fmt(k.count)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-teal-600" style={{ width: `${Math.max(1, (k.count / max) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
