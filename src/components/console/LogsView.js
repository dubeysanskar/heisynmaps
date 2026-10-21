"use client";

import { useCallback, useEffect, useState } from "react";
import { timeAgo } from "./format";
import { HttpStatus } from "./ui";

const PAGE = 50;

export default function LogsView({ keys, skus, initialKey = "" }) {
  const [filters, setFilters] = useState({ status: "", key: initialKey, sku: "", q: "" });
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState({ rows: [], hasMore: false, loading: true });

  const load = useCallback(async () => {
    setData((d) => ({ ...d, loading: true }));
    const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), limit: PAGE, offset });
    const res = await fetch(`/api/console/logs?${qs}`);
    const json = await res.json();
    setData({ rows: json.rows || [], hasMore: Boolean(json.hasMore), loading: false });
  }, [filters, offset]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const set = (k) => (e) => {
    setOffset(0);
    setFilters((f) => ({ ...f, [k]: e.target.value }));
  };
  const select = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600";

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap gap-2">
        <select value={filters.status} onChange={set("status")} className={select} aria-label="Status">
          <option value="">All statuses</option>
          <option value="2xx">Success (2xx)</option>
          <option value="4xx">Client errors (4xx)</option>
          <option value="5xx">Server errors (5xx)</option>
        </select>
        <select value={filters.key} onChange={set("key")} className={select} aria-label="Key">
          <option value="">All keys</option>
          {keys.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
        <select value={filters.sku} onChange={set("sku")} className={select} aria-label="API">
          <option value="">All APIs</option>
          {skus.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <input value={filters.q} onChange={set("q")} placeholder="Filter by path" className={`${select} w-48`} />
        <button onClick={load} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50">
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Request</th>
              <th className="px-4 py-2.5 font-medium">Key</th>
              <th className="px-4 py-2.5 font-medium">Error</th>
              <th className="px-4 py-2.5 text-right font-medium">Latency</th>
              <th className="px-4 py-2.5 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!data.loading && data.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No requests match these filters.
                </td>
              </tr>
            )}
            {data.rows.map((r, i) => (
              <tr key={`${r.ts}-${i}`}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600" title={r.ts}>
                  {timeAgo(r.ts)}
                </td>
                <td className="px-4 py-2">
                  <HttpStatus status={r.status} />
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {r.method} {r.path}
                </td>
                <td className="px-4 py-2 text-slate-600">{r.keyName}</td>
                <td className="px-4 py-2 font-mono text-xs text-red-700">{r.error_code || ""}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-600">{r.latency_ms} ms</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{r.ip || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">{data.loading ? "Loading…" : `Showing ${offset + 1}–${offset + data.rows.length}`}</span>
        <div className="flex gap-2">
          <button disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE))} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40">
            Newer
          </button>
          <button disabled={!data.hasMore} onClick={() => setOffset((o) => o + PAGE)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40">
            Older
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500">Request logs are kept for 14 days.</p>
    </div>
  );
}
