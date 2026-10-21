"use client";

import { useMemo, useState } from "react";
import ApiRunner from "@/components/api/ApiRunner";

// Endpoint picker + live request runner, authenticated with the console session.
export default function Playground({ endpoints, demoKey }) {
  const runnable = useMemo(() => endpoints.filter((e) => e.example || e.path.includes("{")), [endpoints]);
  const [active, setActive] = useState(0);
  const groups = [...new Set(runnable.map((e) => e.group))];
  const endpoint = runnable[active];

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
      <nav className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
        <select
          value={active}
          onChange={(e) => setActive(Number(e.target.value))}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm lg:hidden"
          aria-label="Endpoint"
        >
          {runnable.map((e, i) => (
            <option key={`${e.method}${e.path}`} value={i}>
              {e.method} {e.title}
            </option>
          ))}
        </select>
        <div className="hidden lg:block">
          {groups.map((g) => (
            <div key={g} className="mb-4">
              <p className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{g}</p>
              {runnable.map((e, i) =>
                e.group === g ? (
                  <button
                    key={`${e.method}${e.path}`}
                    onClick={() => setActive(i)}
                    className={`mt-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                      i === active ? "bg-teal-50 font-medium text-teal-800" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className={`w-12 shrink-0 font-mono text-[10px] font-semibold ${e.method === "GET" ? "text-sky-700" : e.method === "DELETE" ? "text-red-700" : "text-teal-700"}`}>
                      {e.method}
                    </span>
                    <span className="truncate">{e.title}</span>
                  </button>
                ) : null
              )}
            </div>
          ))}
        </div>
      </nav>
      <div className="min-w-0 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{endpoint.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{endpoint.summary}</p>
        </div>
        <ApiRunner key={`${endpoint.method}${endpoint.path}`} endpoint={endpoint} signedIn demoKey={demoKey} />
      </div>
    </div>
  );
}
