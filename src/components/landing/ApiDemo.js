"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import GeoPreview, { extractGeo } from "@/components/api/GeoPreview";
import { formatDistance, formatDuration } from "@/components/map/format";

const PLACES = {
  okhla: { label: "Okhla Phase II", lat: 28.5355, lon: 77.271 },
  cyber: { label: "DLF Cyber Hub", lat: 28.495, lon: 77.0896 },
  cp: { label: "Connaught Place", lat: 28.6315, lon: 77.2167 },
  noida: { label: "Noida Sector 18", lat: 28.5708, lon: 77.3261 },
  gate: { label: "India Gate", lat: 28.6129, lon: 77.2295 },
};

const TABS = [
  {
    id: "geocode",
    label: "Geocode",
    blurb: "Text in, coordinates and DIGIPIN out.",
    options: ["Sector 18 Noida", "DLF Cyber Hub", "Kashmere Gate", "39J-49K-P2C8"],
    build: (opt) => ({ method: "GET", path: `/api/v1/geocode?q=${encodeURIComponent(opt)}&limit=3` }),
    summary: (d) => (d.results?.[0] ? `${d.results[0].label} · DIGIPIN ${d.results[0].digipin || "—"}` : "No match"),
  },
  {
    id: "route",
    label: "Truck route",
    blurb: "A 12-tonne, 3.8 m truck — restrictions applied per request.",
    options: ["okhla→cyber", "cp→noida", "gate→cyber"],
    optionLabel: (o) => o.split("→").map((k) => PLACES[k].label).join(" → "),
    build: (opt) => {
      const [a, b] = opt.split("→").map((k) => PLACES[k]);
      return {
        method: "POST",
        path: "/api/v1/route",
        body: { locations: [{ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon }], profile: "truck", truck: { weight_t: 12, height_m: 3.8 } },
      };
    },
    summary: (d) => (d.routes?.[0] ? `${formatDuration(d.routes[0].duration_s)} · ${formatDistance(d.routes[0].distance_m)}${d.routes[0].has_toll ? " · tolls" : ""}` : ""),
  },
  {
    id: "digipin",
    label: "DIGIPIN",
    blurb: "India Post's 4 m address code, encoded from any point. Free.",
    options: ["gate", "cyber", "noida"],
    optionLabel: (o) => PLACES[o].label,
    build: (opt) => ({ method: "GET", path: `/api/v1/digipin?lat=${PLACES[opt].lat}&lon=${PLACES[opt].lon}` }),
    summary: (d) => (d.formatted ? `DIGIPIN ${d.formatted}` : ""),
  },
  {
    id: "isochrone",
    label: "Reachability",
    blurb: "What a scooter can reach from a dark store in 10, 20 and 30 minutes.",
    options: ["okhla", "cp", "noida"],
    optionLabel: (o) => PLACES[o].label,
    build: (opt) => ({
      method: "POST",
      path: "/api/v1/isochrone",
      body: { location: { lat: PLACES[opt].lat, lon: PLACES[opt].lon }, minutes: [10, 20, 30], profile: "scooter" },
    }),
    summary: (d) => (d.features ? `${d.features.length} service-area polygons` : ""),
  },
];

export default function ApiDemo({ demoKey }) {
  const [tabId, setTabId] = useState(TABS[0].id);
  const tab = TABS.find((t) => t.id === tabId);
  const [option, setOption] = useState(tab.options[0]);
  const [state, setState] = useState({ loading: false, data: null, status: null, ms: null, error: null });

  const request = useMemo(() => tab.build(option), [tab, option]);

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const started = performance.now();
    try {
      const res = await fetch(request.path, {
        method: request.method,
        headers: { "X-Api-Key": demoKey, ...(request.body ? { "Content-Type": "application/json" } : {}) },
        body: request.body ? JSON.stringify(request.body) : undefined,
      });
      const data = await res.json();
      setState({ loading: false, data, status: res.status, ms: Math.round(performance.now() - started), error: res.ok ? null : data.error?.message });
    } catch (err) {
      setState({ loading: false, data: null, status: null, ms: null, error: err.message });
    }
  }, [request, demoKey]);

  useEffect(() => {
    run();
  }, [run]);

  const features = useMemo(() => extractGeo(state.data), [state.data]);
  const json = useMemo(() => shorten(state.data), [state.data]);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
      <div className="no-scrollbar flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tabId}
            onClick={() => {
              setTabId(t.id);
              setOption(t.options[0]);
            }}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium ${
              t.id === tabId ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_1.15fr]">
        <div className="min-w-0 space-y-4 p-5">
          <p className="text-sm text-slate-600">{tab.blurb}</p>
          <div className="flex flex-wrap gap-2">
            {tab.options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOption(o)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  o === option ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab.optionLabel ? tab.optionLabel(o) : o}
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-slate-950 p-3 font-mono text-[11.5px] leading-relaxed text-slate-100">
            <p>
              <span className={request.method === "GET" ? "text-sky-300" : "text-teal-300"}>{request.method}</span>{" "}
              <span className="break-all">{request.path}</span>
            </p>
            {request.body && <pre className="mt-2 overflow-x-auto text-slate-300">{JSON.stringify(request.body, null, 2)}</pre>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={run}
              disabled={state.loading}
              className="rounded-lg bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {state.loading ? "Calling…" : "Run again"}
            </button>
            {state.status && (
              <span className={`font-mono text-xs ${state.status < 400 ? "text-emerald-700" : "text-red-700"}`}>
                {state.status} · {state.ms} ms
              </span>
            )}
          </div>
          {state.error ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>
          ) : (
            state.data && <p className="text-sm font-medium text-slate-900">{tab.summary(state.data)}</p>
          )}
          <Link href={`/docs/api/${tab.id === "isochrone" ? "isochrone" : tab.id}`} className="inline-block text-sm font-medium text-teal-700 hover:underline">
            {tab.label} API reference →
          </Link>
        </div>
        <div className="min-w-0 space-y-3 border-t border-slate-200 bg-slate-50/60 p-5 lg:border-l lg:border-t-0">
          <GeoPreview features={features} mapKey={demoKey} height={260} />
          <pre className="max-h-56 overflow-auto rounded-xl bg-white p-3 text-[11.5px] leading-relaxed text-slate-700 ring-1 ring-slate-200">
            {state.loading && !state.data ? "Loading…" : json}
          </pre>
        </div>
      </div>
    </div>
  );
}

// Keep the JSON panel readable: drop long arrays down to a couple of items.
function shorten(data) {
  if (!data) return "";
  return JSON.stringify(
    data,
    (key, value) => {
      if (key === "coordinates" && Array.isArray(value)) return `[… ${value.flat(3).length / 2} points]`;
      if (key === "steps" && Array.isArray(value)) return `[… ${value.length} turn-by-turn steps]`;
      if (key === "address" && value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v));
      return value;
    },
    2
  );
}
