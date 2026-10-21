"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_GROUPS } from "@/lib/catalog";
import { SecretReveal } from "./ui";

const EXPIRY = [
  ["", "Never"],
  ["30", "30 days"],
  ["90", "90 days"],
  ["365", "1 year"],
  ["custom", "Pick a date"],
];

// Create (no `existing`) or edit an API key's name, restrictions and limits.
export default function KeyForm({ existing, planRpm }) {
  const router = useRouter();
  const editing = Boolean(existing);
  const [kind, setKind] = useState(existing?.kind || "server");
  const [name, setName] = useState(existing?.name || "");
  const [origins, setOrigins] = useState((existing?.allowedOrigins || []).join("\n"));
  const [ips, setIps] = useState((existing?.allowedIps || []).join("\n"));
  const [scopes, setScopes] = useState(existing?.scopes?.length ? existing.scopes : Object.keys(API_GROUPS));
  const [rpm, setRpm] = useState(existing?.rpmLimit ?? "");
  const [quota, setQuota] = useState(existing?.dailyQuota ?? "");
  const [expiry, setExpiry] = useState(existing?.expiresAt ? "custom" : "");
  const [expiryDate, setExpiryDate] = useState(existing?.expiresAt ? existing.expiresAt.slice(0, 10) : "");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const [saved, setSaved] = useState(false);

  function expiresAt() {
    if (!expiry) return null;
    if (expiry === "custom") return expiryDate ? new Date(`${expiryDate}T23:59:59`).toISOString() : null;
    return new Date(Date.now() + Number(expiry) * 864e5).toISOString();
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!scopes.length) return setError("Pick at least one API group");
    setBusy(true);
    const payload = {
      name,
      scopes,
      rpmLimit: rpm === "" ? null : Number(rpm),
      dailyQuota: quota === "" ? null : Number(quota),
      expiresAt: expiresAt(),
      ...(kind === "browser" ? { allowedOrigins: origins } : { allowedIps: ips }),
      ...(editing ? {} : { kind }),
    };
    try {
      const res = await fetch(editing ? `/api/console/keys/${existing.id}` : "/api/console/keys", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Could not save the key");
      if (editing) {
        setSaved(true);
        router.refresh();
      } else {
        setCreated(data.key);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return <SecretReveal apiKey={created} onDone={() => router.push(`/console/keys/${created.id}`)} doneLabel="I've saved it — continue" />;
  }

  const label = "block text-sm font-medium text-slate-800";
  const input = "mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15";
  const hint = "mt-1 text-xs text-slate-500";

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <label className={label} htmlFor="key-name">
          Name
        </label>
        <input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dispatch backend, Checkout web app" className={input} required />
      </div>

      {!editing && (
        <fieldset>
          <legend className={label}>Key type</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {[
              ["server", "Server key", "Secret. For your backend, scripts and mobile app servers. Optionally locked to IP addresses."],
              ["browser", "Browser key", "Public. Safe in web pages because it only works from the websites you list."],
            ].map(([id, title, body]) => (
              <label
                key={id}
                className={`cursor-pointer rounded-xl border p-4 ${kind === id ? "border-teal-600 bg-teal-50/60 ring-1 ring-teal-600" : "border-slate-300 hover:border-slate-400"}`}
              >
                <input type="radio" name="kind" value={id} checked={kind === id} onChange={() => setKind(id)} className="sr-only" />
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-600">{body}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {kind === "browser" ? (
        <div>
          <label className={label} htmlFor="key-origins">
            Allowed websites
          </label>
          <textarea
            id="key-origins"
            value={origins}
            onChange={(e) => setOrigins(e.target.value)}
            rows={3}
            placeholder={"https://app.example.com\n*.example.com\nhttp://localhost:3000"}
            className={`${input} font-mono`}
          />
          <p className={hint}>One per line. Use *.example.com for subdomains. Required for browser keys.</p>
        </div>
      ) : (
        <div>
          <label className={label} htmlFor="key-ips">
            Allowed IP addresses <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id="key-ips"
            value={ips}
            onChange={(e) => setIps(e.target.value)}
            rows={2}
            placeholder={"203.0.113.10\n10.20.0.0/16"}
            className={`${input} font-mono`}
          />
          <p className={hint}>One per line; IPv4 CIDR ranges allowed. Leave empty to allow any IP.</p>
        </div>
      )}

      <fieldset>
        <legend className={label}>APIs this key can call</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(API_GROUPS).map(([id, title]) => (
            <label key={id} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={scopes.includes(id)}
                onChange={(e) => setScopes((s) => (e.target.checked ? [...s, id] : s.filter((x) => x !== id)))}
                className="h-4 w-4 accent-teal-600"
              />
              {title}
            </label>
          ))}
        </div>
        <p className={hint}>Grant only what this key needs. Calls to other APIs return 403 scope_denied.</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="key-rpm">
            Requests / minute
          </label>
          <input id="key-rpm" type="number" min="1" value={rpm} onChange={(e) => setRpm(e.target.value)} placeholder={`Plan limit (${planRpm})`} className={input} />
          <p className={hint}>Can only lower your plan limit.</p>
        </div>
        <div>
          <label className={label} htmlFor="key-quota">
            Daily quota
          </label>
          <input id="key-quota" type="number" min="1" value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="No daily cap" className={input} />
          <p className={hint}>Calls per day before 429.</p>
        </div>
        <div>
          <label className={label} htmlFor="key-expiry">
            Expires
          </label>
          <select id="key-expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={input}>
            {EXPIRY.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {expiry === "custom" && (
            <input type="date" value={expiryDate} min={new Date(Date.now() + 864e5).toISOString().slice(0, 10)} onChange={(e) => setExpiryDate(e.target.value)} className={input} />
          )}
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Saved. Changes apply within a few seconds.</p>}

      <div className="flex gap-3">
        <button disabled={busy} className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {busy ? "Saving…" : editing ? "Save changes" : "Create key"}
        </button>
        {!editing && (
          <button type="button" onClick={() => router.push("/console/keys")} className="rounded-lg px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
