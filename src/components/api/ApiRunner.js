"use client";

import { useEffect, useMemo, useState } from "react";
import GeoPreview, { extractGeo } from "./GeoPreview";

// Interactive request builder for one catalogue endpoint. Used by the console
// playground and the docs "Try it" panels.
//   endpoint  – an item from ENDPOINTS (src/lib/catalog.js)
//   signedIn  – lets the request use the console session instead of a key
//   demoKey   – first-party browser key (works from this site only)
export default function ApiRunner({ endpoint, signedIn = false, demoKey, compact = false }) {
  const pathParams = useMemo(() => [...endpoint.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]), [endpoint.path]);
  const initialQuery = useMemo(
    () => Object.entries(endpoint.example?.query || {}).map(([k, v]) => ({ k, v: String(v) })),
    [endpoint]
  );
  const [authMode, setAuthMode] = useState(signedIn ? "session" : demoKey ? "demo" : "key");
  const [apiKey, setApiKey] = useState("");
  const [pathValues, setPathValues] = useState(() => Object.fromEntries(pathParams.map((p) => [p, endpoint.example?.path?.[p] || ""])));
  const [query, setQuery] = useState(initialQuery.length ? initialQuery : [{ k: "", v: "" }]);
  const [body, setBody] = useState(endpoint.example?.body ? JSON.stringify(endpoint.example.body, null, 2) : "");
  const [method, setMethod] = useState(endpoint.method);
  const [state, setState] = useState({ loading: false, response: null, error: null });
  // Read after mount so server and client render the same cURL text.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const url = useMemo(() => {
    let path = endpoint.path;
    for (const p of pathParams) path = path.replace(`{${p}}`, encodeURIComponent(pathValues[p] || `{${p}}`));
    const qs = new URLSearchParams(query.filter((q) => q.k).map((q) => [q.k, q.v])).toString();
    return path + (qs ? `?${qs}` : "");
  }, [endpoint.path, pathParams, pathValues, query]);

  const keyForRequest = authMode === "demo" ? demoKey : authMode === "key" ? apiKey.trim() : "";
  const hasBody = method === "POST" || method === "PATCH";

  async function send() {
    setState({ loading: true, response: null, error: null });
    let parsedBody;
    if (hasBody) {
      try {
        parsedBody = body.trim() ? JSON.parse(body) : undefined;
      } catch (err) {
        setState({ loading: false, response: null, error: `Body is not valid JSON: ${err.message}` });
        return;
      }
    }
    const headers = {};
    if (parsedBody) headers["Content-Type"] = "application/json";
    if (authMode === "session") headers["X-Heisyn-Console"] = "1";
    else if (keyForRequest) headers["X-Api-Key"] = keyForRequest;
    const started = performance.now();
    try {
      const res = await fetch(url, { method, headers, body: parsedBody ? JSON.stringify(parsedBody) : undefined });
      const ms = Math.round(performance.now() - started);
      const type = res.headers.get("content-type") || "";
      let data;
      let text;
      if (type.includes("json")) data = await res.json();
      else {
        const buf = await res.arrayBuffer();
        text = `${type || "binary"} · ${buf.byteLength.toLocaleString()} bytes`;
      }
      setState({
        loading: false,
        error: null,
        response: {
          status: res.status,
          ms,
          data,
          text,
          limit: res.headers.get("x-ratelimit-limit"),
          remaining: res.headers.get("x-ratelimit-remaining"),
        },
      });
    } catch (err) {
      setState({ loading: false, response: null, error: err.message });
    }
  }

  const curl = useMemo(() => {
    const lines = [`curl -X ${method} "${origin}${url}"`, `  -H "X-Api-Key: $HEISYN_KEY"`];
    if (hasBody && body.trim()) {
      let compactBody = body;
      try {
        compactBody = JSON.stringify(JSON.parse(body));
      } catch {}
      lines.push(`  -H "Content-Type: application/json"`, `  -d '${compactBody}'`);
    }
    return lines.join(" \\\n");
  }, [origin, method, url, hasBody, body]);

  const geo = useMemo(() => extractGeo(state.response?.data), [state.response]);
  const ok = state.response && state.response.status < 400;
  const methods = endpoint.methods || [endpoint.method];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
        {methods.length > 1 ? (
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 font-mono text-xs font-semibold">
            {methods.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        ) : (
          <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${method === "GET" ? "bg-sky-100 text-sky-800" : "bg-teal-100 text-teal-800"}`}>
            {method}
          </span>
        )}
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-slate-700">{url}</code>
        <button
          onClick={send}
          disabled={state.loading}
          className="rounded-lg bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {state.loading ? "Sending…" : "Send"}
        </button>
      </div>

      <div className={`grid gap-0 ${compact ? "" : "lg:grid-cols-2"}`}>
        <div className="space-y-4 p-4">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">Authentication</legend>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {[
                signedIn && ["session", "My account"],
                demoKey && ["demo", "Demo key"],
                ["key", "Paste a key"],
              ]
                .filter(Boolean)
                .map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAuthMode(id)}
                    className={`rounded-full border px-3 py-1 ${authMode === id ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-300 text-slate-600"}`}
                  >
                    {label}
                  </button>
                ))}
            </div>
            {authMode === "key" && (
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="hm_sk_… or hm_pub_…"
                className="mt-2 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs outline-none focus:border-teal-600"
              />
            )}
            <p className="mt-1.5 text-xs text-slate-500">
              {authMode === "session"
                ? "Calls are billed to your account like any key."
                : authMode === "demo"
                  ? "Shared demo key, rate limited. Sign in to use your own quota."
                  : "Your key is only sent to this site."}
            </p>
          </fieldset>

          {pathParams.length > 0 && (
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">Path</legend>
              {pathParams.map((p) => (
                <label key={p} className="mt-2 flex items-center gap-2 text-sm">
                  <span className="w-24 font-mono text-xs text-slate-600">{p}</span>
                  <input
                    value={pathValues[p]}
                    onChange={(e) => setPathValues((v) => ({ ...v, [p]: e.target.value }))}
                    className="h-8 flex-1 rounded-md border border-slate-300 px-2 font-mono text-xs outline-none focus:border-teal-600"
                  />
                </label>
              ))}
            </fieldset>
          )}

          {(endpoint.method === "GET" || query.some((q) => q.k)) && (
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">Query</legend>
              {query.map((q, i) => (
                <div key={i} className="mt-2 flex gap-2">
                  <input
                    value={q.k}
                    onChange={(e) => setQuery((all) => all.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))}
                    placeholder="name"
                    className="h-8 w-28 rounded-md border border-slate-300 px-2 font-mono text-xs outline-none focus:border-teal-600"
                  />
                  <input
                    value={q.v}
                    onChange={(e) => setQuery((all) => all.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))}
                    placeholder="value"
                    className="h-8 flex-1 rounded-md border border-slate-300 px-2 font-mono text-xs outline-none focus:border-teal-600"
                  />
                  <button
                    type="button"
                    onClick={() => setQuery((all) => all.filter((_, j) => j !== i))}
                    className="px-1 text-slate-400 hover:text-red-600"
                    aria-label="Remove parameter"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setQuery((all) => [...all, { k: "", v: "" }])} className="mt-2 text-xs font-medium text-teal-700 hover:underline">
                + Add parameter
              </button>
            </fieldset>
          )}

          {hasBody && (
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">JSON body</legend>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
                rows={Math.min(18, Math.max(5, body.split("\n").length))}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-relaxed outline-none focus:border-teal-600"
              />
            </fieldset>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer font-medium text-slate-600">cURL</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-[11.5px] leading-relaxed text-teal-100">{curl}</pre>
          </details>
        </div>

        <div className={`border-slate-200 p-4 ${compact ? "border-t" : "border-t lg:border-l lg:border-t-0"}`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Response</p>
          {!state.response && !state.error && !state.loading && (
            <p className="mt-6 text-center text-sm text-slate-400">Press Send to call the live API.</p>
          )}
          {state.loading && <p className="mt-6 text-center text-sm text-slate-500">Waiting for response…</p>}
          {state.error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
          {state.response && (
            <div className="mt-2 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-md px-2 py-0.5 font-mono font-semibold ${ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                  {state.response.status}
                </span>
                <span className="text-slate-500">{state.response.ms} ms</span>
                {state.response.limit && (
                  <span className="text-slate-500">
                    · {state.response.remaining}/{state.response.limit} requests left this minute
                  </span>
                )}
              </div>
              {geo.length > 0 && demoKey && <GeoPreview features={geo} mapKey={demoKey} height={compact ? 200 : 240} />}
              {state.response.text ? (
                <p className="rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">{state.response.text}</p>
              ) : (
                <pre className="max-h-[420px] overflow-auto rounded-lg bg-slate-950 p-3 text-[11.5px] leading-relaxed text-slate-100">
                  {truncateJson(state.response.data)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Long coordinate arrays make responses unreadable; abbreviate them for display.
function truncateJson(data) {
  return JSON.stringify(
    data,
    (key, value) => {
      if (key === "coordinates" && Array.isArray(value) && JSON.stringify(value).length > 400) {
        return `[… ${value.flat(3).length / 2} points …]`;
      }
      return value;
    },
    2
  );
}
