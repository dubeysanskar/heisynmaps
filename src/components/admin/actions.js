"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function send(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
  return data;
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  async function run(fn, message) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await fn();
      setDone(message || "Saved");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, done, run };
}

const inputCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600";
const btn = "h-9 rounded-lg px-3 text-sm font-medium disabled:opacity-50";

function Feedback({ error, done }) {
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (done) return <p className="text-sm text-emerald-700">{done}</p>;
  return null;
}

export function OrgControls({ org }) {
  const { busy, error, done, run } = useAction();
  const [form, setForm] = useState({
    plan: org.plan,
    rpm_override: org.rpm_override ?? "",
    quota_override: org.quota_override ?? "",
    notes: org.notes || "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const suspended = org.status === "suspended";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-xs text-slate-500">Plan</span>
          <select value={form.plan} onChange={set("plan")} className={inputCls}>
            <option value="free">Free</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise / On-prem</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-xs text-slate-500">Requests / minute override</span>
          <input type="number" min="1" value={form.rpm_override} onChange={set("rpm_override")} placeholder="Plan default" className={inputCls} />
        </label>
        <label className="text-sm">
          <span className="text-xs text-slate-500">Included calls / API / month override</span>
          <input type="number" min="0" value={form.quota_override} onChange={set("quota_override")} placeholder="Plan default" className={inputCls} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-xs text-slate-500">Internal notes</span>
        <textarea value={form.notes} onChange={set("notes")} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={busy}
          onClick={() => run(() => send(`/api/admin/orgs/${org.id}`, "PATCH", form), "Organisation updated")}
          className={`${btn} bg-teal-700 text-white hover:bg-teal-800`}
        >
          Save changes
        </button>
        <button
          disabled={busy}
          onClick={() => {
            const verb = suspended ? "Reactivate" : "Suspend";
            if (!confirm(`${verb} ${org.name}? ${suspended ? "" : "All of its API keys will get 403 until reactivated."}`)) return;
            run(
              () => send(`/api/admin/orgs/${org.id}`, "PATCH", { status: suspended ? "active" : "suspended" }),
              suspended ? "Organisation reactivated" : "Organisation suspended"
            );
          }}
          className={`${btn} ${suspended ? "border border-emerald-300 text-emerald-800 hover:bg-emerald-50" : "border border-red-300 text-red-700 hover:bg-red-50"}`}
        >
          {suspended ? "Reactivate" : "Suspend"}
        </button>
        <Feedback error={error} done={done} />
      </div>
    </div>
  );
}

export function RoleButton({ user, isSelf }) {
  const { busy, error, run } = useAction();
  const admin = user.role === "admin";
  return (
    <span className="inline-flex items-center gap-2">
      <button
        disabled={busy || (admin && isSelf)}
        title={admin && isSelf ? "You can't remove your own admin access" : undefined}
        onClick={() => {
          if (!confirm(admin ? `Remove admin access from ${user.email}?` : `Make ${user.email} a platform admin?`)) return;
          run(() => send(`/api/admin/users/${user.id}`, "PATCH", { role: admin ? "member" : "admin" }));
        }}
        className={`rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-40 ${
          admin ? "border-slate-300 text-slate-700 hover:bg-slate-50" : "border-amber-300 text-amber-800 hover:bg-amber-50"
        }`}
      >
        {admin ? "Remove admin" : "Make admin"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function KeyActions({ apiKey }) {
  const { busy, error, run } = useAction();
  if (apiKey.status === "revoked") return <span className="text-xs text-slate-400">Revoked</span>;
  const disabled = apiKey.status === "disabled";
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        disabled={busy}
        onClick={() => run(() => send(`/api/admin/keys/${apiKey.id}`, "PATCH", { disabled: !disabled }))}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
      >
        {disabled ? "Enable" : "Disable"}
      </button>
      <button
        disabled={busy}
        onClick={() => {
          if (!confirm(`Revoke "${apiKey.name}"? Apps using it stop working immediately. This can't be undone.`)) return;
          run(() => send(`/api/admin/keys/${apiKey.id}`, "DELETE"));
        }}
        className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        Revoke
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function ApiControls({ sku, current }) {
  const { busy, error, done, run } = useAction();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(String(current.inrPer1k));
  const [note, setNote] = useState(current.note || "");

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <button
          disabled={busy}
          onClick={() => {
            if (!current.disabled && !confirm(`Disable ${sku} for every customer? Calls will return 503 api_disabled.`)) return;
            run(
              () => send(`/api/admin/apis/${encodeURIComponent(sku)}`, "PATCH", { disabled: !current.disabled, note }),
              current.disabled ? "Enabled" : "Disabled"
            );
          }}
          className={`rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
            current.disabled ? "border-emerald-300 text-emerald-800 hover:bg-emerald-50" : "border-red-200 text-red-700 hover:bg-red-50"
          }`}
        >
          {current.disabled ? "Enable" : "Disable"}
        </button>
        <button onClick={() => setOpen((v) => !v)} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50">
          {open ? "Close" : "Edit"}
        </button>
      </div>
      {open && (
        <div className="w-64 space-y-2 whitespace-normal rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
          <label className="block text-xs">
            <span className="mb-1 block text-slate-500">Overage ₹ per 1,000</span>
            <input type="number" min="0" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-slate-500">Maintenance note (shown in 503 errors)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Upgrading routing engine" className={inputCls} />
          </label>
          <button
            disabled={busy}
            onClick={() => run(() => send(`/api/admin/apis/${encodeURIComponent(sku)}`, "PATCH", { inrPer1k: price, note }), "Saved")}
            className={`${btn} w-full bg-teal-700 text-white hover:bg-teal-800`}
          >
            Save
          </button>
        </div>
      )}
      {(error || done) && <Feedback error={error} done={done} />}
    </div>
  );
}
