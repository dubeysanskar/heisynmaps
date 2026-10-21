"use client";

import { useState } from "react";
import { fmt } from "./format";


const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  disabled: "bg-slate-100 text-slate-600 ring-slate-200",
  expired: "bg-amber-50 text-amber-800 ring-amber-200",
  suspended: "bg-red-50 text-red-700 ring-red-200",
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ${STATUS_STYLES[status] || STATUS_STYLES.disabled}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
}

export function HttpStatus({ status }) {
  const cls = status < 300 ? "bg-emerald-50 text-emerald-700" : status < 500 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700";
  return <span className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${cls}`}>{status}</span>;
}

export function CopyButton({ text, label = "Copy", className = "" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
      className={`rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 ${className}`}
    >
      {done ? "Copied" : label}
    </button>
  );
}

// Shown exactly once, right after a key is created or rotated.
export function SecretReveal({ apiKey, onDone, doneLabel = "Done" }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const curl = `curl "${origin}/api/v1/geocode?q=connaught+place" \\\n  -H "X-Api-Key: ${apiKey.key}"`;
  const js = `new maplibregl.Map({\n  container: "map",\n  style: "${origin}/api/v1/style?theme=light&key=${apiKey.key}",\n  center: [77.209, 28.6139],\n  zoom: 11,\n});`;
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
      <p className="font-semibold text-amber-900">Copy this key now. You won&apos;t be able to see it again.</p>
      <p className="mt-0.5 text-sm text-amber-800">
        {apiKey.name} · {apiKey.kind === "browser" ? "browser key" : "server key"}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2.5 font-mono text-sm ring-1 ring-amber-200">{apiKey.key}</code>
        <CopyButton text={apiKey.key} className="!border-amber-900 !bg-amber-900 !text-white" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-amber-900">
        {apiKey.kind === "browser" ? "Use it in a web page" : "Test it"}
      </p>
      <pre className="mt-1.5 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-teal-100">
        {apiKey.kind === "browser" ? js : curl}
      </pre>
      {onDone && (
        <button onClick={onDone} className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
          {doneLabel}
        </button>
      )}
    </div>
  );
}

// Single-series daily bars: one hue, no legend, value on hover.
export function DailyBars({ days, height = 120, label = "Calls per day" }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const short = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <div>
      <div className="flex items-end gap-[2px] border-b border-slate-200" style={{ height }} role="img" aria-label={`${label}, last ${days.length} days`}>
        {days.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[4px] bg-teal-600 group-hover:bg-teal-800"
              style={{ height: d.count ? `${Math.max(3, (d.count / max) * 100)}%` : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white group-hover:block">
              {short(d.day)} · {fmt(d.count)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{short(days[0].day)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
