import { fmtNum } from "./ui";

// Single-series charts: one hue (teal), no legend, rounded data ends anchored to the
// baseline, hover tooltip per mark, recessive axis, and a table view alongside.

export function DailyBars({ data, label = "Calls per day", height = 140 }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  const fmtDay = (day) => new Date(day).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xs text-slate-500">
          Peak <span className="font-medium text-slate-800 tabular-nums">{fmtNum(max === 1 && !total ? 0 : max)}</span>
        </p>
      </div>
      <div
        className="mt-2 flex items-end gap-[2px] border-b border-slate-200"
        style={{ height }}
        role="img"
        aria-label={`${label}: ${fmtNum(total)} over ${data.length} days`}
      >
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-teal-600 group-hover:bg-teal-800"
              style={{ height: d.count ? `${Math.max(2, (d.count / max) * 100)}%` : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white group-hover:block">
              {fmtDay(d.day)} · {fmtNum(d.count)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{fmtDay(data[0].day)}</span>
        <span>Today</span>
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-slate-500 hover:text-slate-800">Show as table</summary>
        <div className="mt-2 max-h-56 overflow-y-auto">
          <table className="w-full">
            <tbody className="divide-y divide-slate-100">
              {[...data].reverse().map((d) => (
                <tr key={d.day}>
                  <td className="py-1 text-slate-600">{fmtDay(d.day)}</td>
                  <td className="py-1 text-right tabular-nums">{fmtNum(d.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// Ranked horizontal bars; the label and value are text, the bar only shows magnitude.
export function RankBars({ rows, empty = "No data yet" }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="group" title={`${r.name ?? r.label}: ${fmtNum(r.value)}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-slate-700">{fmtNum(r.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-teal-600 group-hover:bg-teal-800" style={{ width: `${Math.max(1, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
