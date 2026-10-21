"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || "Request failed"), { status: res.status });
  return data;
}

export default function ConsoleApp() {
  const [session, setSession] = useState(undefined);

  const load = useCallback(() => {
    call("/api/auth/me")
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  useEffect(load, [load]);

  if (session === undefined) return <p className="py-24 text-center text-sm text-slate-500">Loading…</p>;
  if (!session) return <AuthForm onDone={load} />;
  return <Dashboard session={session} onLogout={() => call("/api/auth/logout", { method: "POST" }).then(load)} />;
}

function AuthForm({ onDone }) {
  const [mode, setMode] = useState("signup");
  const [form, setForm] = useState({ name: "", company: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await call(`/api/auth/${mode}`, { method: "POST", body: form });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const field = (key, label, type = "text", extra = {}) => (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        {...extra}
      />
    </label>
  );

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-slate-600">
        {mode === "signup" ? "100,000 free calls per API, every month. No card needed." : "Sign in to manage keys and usage."}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === "signup" && (
          <div className="grid grid-cols-2 gap-3">
            {field("name", "Your name")}
            {field("company", "Company")}
          </div>
        )}
        {field("email", "Work email", "email", { required: true, autoComplete: "email" })}
        {field("password", "Password", "password", {
          required: true,
          minLength: 8,
          autoComplete: mode === "signup" ? "new-password" : "current-password",
        })}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="h-11 w-full rounded-lg bg-teal-700 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        {mode === "signup" ? "Already have an account?" : "New to Naksha?"}{" "}
        <button onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="font-medium text-teal-700 hover:underline">
          {mode === "signup" ? "Sign in" : "Create one"}
        </button>
      </p>
    </div>
  );
}

function Dashboard({ session, onLogout }) {
  const [keys, setKeys] = useState([]);
  const [usage, setUsage] = useState(null);
  const [created, setCreated] = useState(null);

  const refresh = useCallback(() => {
    call("/api/console/keys").then((d) => setKeys(d.keys));
    call("/api/console/usage").then(setUsage);
  }, []);

  useEffect(refresh, [refresh]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{session.user.email}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{session.org.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-200">
            {usage?.plan?.name || session.org.plan} plan
          </span>
          <button onClick={onLogout} className="text-sm text-slate-600 hover:text-slate-900">
            Sign out
          </button>
        </div>
      </div>

      {created && <NewKeyBanner created={created} onClose={() => setCreated(null)} />}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <KeysCard
          keys={keys}
          onCreate={async (input) => {
            const { key } = await call("/api/console/keys", { method: "POST", body: input });
            setCreated(key);
            refresh();
          }}
          onRevoke={async (id) => {
            await call(`/api/console/keys/${id}`, { method: "DELETE" });
            refresh();
          }}
        />
        <UsageCard usage={usage} onRefresh={refresh} />
      </div>
    </div>
  );
}

function NewKeyBanner({ created, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-amber-900">Copy your new key now. It won&apos;t be shown again.</p>
          <p className="mt-0.5 text-sm text-amber-800">
            {created.name} · {created.kind === "browser" ? "browser key" : "server key"}
          </p>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-amber-800 hover:bg-amber-100" aria-label="Dismiss">
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2.5 font-mono text-sm ring-1 ring-amber-200">{created.key}</code>
        <button
          onClick={() => navigator.clipboard.writeText(created.key).then(() => setCopied(true))}
          className="rounded-lg bg-amber-900 px-3 py-2.5 text-sm font-medium text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-teal-100">
        {`curl "${typeof window !== "undefined" ? window.location.origin : ""}/api/v1/geocode?q=cyber+hub" -H "X-Api-Key: ${created.key}"`}
      </pre>
    </div>
  );
}

function KeysCard({ keys, onCreate, onRevoke }) {
  const [form, setForm] = useState({ name: "", kind: "server", allowedOrigins: "" });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      await onCreate(form);
      setForm({ name: "", kind: "server", allowedOrigins: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon name="key" /> API keys
      </h2>
      <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Key name, e.g. Dispatch backend"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
          />
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs font-medium">
            {[
              ["server", "Server"],
              ["browser", "Browser"],
            ].map(([id, label]) => (
              <button
                type="button"
                key={id}
                onClick={() => setForm({ ...form, kind: id })}
                className={`rounded-md px-3 py-2 ${form.kind === id ? "bg-teal-700 text-white" : "text-slate-600"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {form.kind === "browser" && (
          <input
            value={form.allowedOrigins}
            onChange={(e) => setForm({ ...form, allowedOrigins: e.target.value })}
            placeholder="Allowed origins: https://app.example.com, *.example.com, http://localhost:3000"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
          />
        )}
        <p className="text-xs text-slate-500">
          {form.kind === "server"
            ? "Secret. Use from your backend only."
            : "Safe in front-end code. It only works from the origins you list."}
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800">Create key</button>
      </form>

      <ul className="mt-4 divide-y divide-slate-100">
        {keys.length === 0 && <li className="py-6 text-center text-sm text-slate-500">No keys yet. Create one above.</li>}
        {keys.map((k) => (
          <li key={k.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {k.name}{" "}
                <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${k.kind === "browser" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-700"}`}>
                  {k.kind}
                </span>
              </p>
              <p className="truncate font-mono text-xs text-slate-500">
                {k.prefix}… · {k.lastUsedAt ? `used ${new Date(k.lastUsedAt).toLocaleString("en-IN")}` : "never used"}
                {k.allowedOrigins.length > 0 && ` · ${k.allowedOrigins.join(", ")}`}
              </p>
            </div>
            <button
              onClick={() => confirm(`Revoke "${k.name}"? Apps using it will stop working.`) && onRevoke(k.id)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label={`Revoke ${k.name}`}
            >
              <Icon name="trash" size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UsageCard({ usage, onRefresh }) {
  const days = useMemo(() => {
    const totals = new Map();
    for (const r of usage?.daily || []) totals.set(r.day, (totals.get(r.day) || 0) + r.count);
    return Array.from({ length: 30 }, (_, i) => {
      const day = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10);
      return { day, count: totals.get(day) || 0 };
    });
  }, [usage]);
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((n, d) => n + d.count, 0);
  const overage = (usage?.monthToDate || []).reduce((n, r) => n + r.overageInr, 0);

  return (
    <section className="rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Usage</h2>
        <button onClick={onRefresh} className="text-xs text-slate-500 hover:text-slate-900">
          Refresh
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Calls, last 30 days</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{total.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Overage this month</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">₹{overage.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Single series: one hue, no legend; hover shows the exact value. */}
      <div className="mt-5">
        <p className="text-xs text-slate-500">Calls per day</p>
        <div className="mt-2 flex h-28 items-end gap-[2px] border-b border-slate-200" role="img" aria-label="Calls per day, last 30 days">
          {days.map((d) => (
            <div key={d.day} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-teal-600 group-hover:bg-teal-800"
                style={{ height: d.count ? `${Math.max(3, (d.count / max) * 100)}%` : 0 }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white group-hover:block">
                {new Date(d.day).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {d.count.toLocaleString("en-IN")}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-slate-400">
          <span>{new Date(days[0].day).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
          <span>Today</span>
        </div>
      </div>

      <table className="mt-5 w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr>
            <th className="pb-2 font-medium">This month</th>
            <th className="pb-2 text-right font-medium">Calls</th>
            <th className="pb-2 text-right font-medium">Free left</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(usage?.monthToDate || []).length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-center text-slate-500">
                No calls yet this month.
              </td>
            </tr>
          )}
          {(usage?.monthToDate || [])
            .sort((a, b) => b.count - a.count)
            .map((r) => (
              <tr key={r.sku}>
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-right tabular-nums">{r.count.toLocaleString("en-IN")}</td>
                <td className="py-2 text-right tabular-nums text-slate-500">
                  {usage.plan.includedPerSku == null ? "∞" : Math.max(0, usage.plan.includedPerSku - r.count).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </section>
  );
}
