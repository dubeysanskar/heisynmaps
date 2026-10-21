"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SecretReveal } from "./ui";

export default function KeyActions({ apiKey }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [rotated, setRotated] = useState(null);
  const [error, setError] = useState(null);

  async function call(action, url, init) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Something went wrong");
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function rotate() {
    if (!confirm(`Rotate "${apiKey.name}"? The current secret stops working immediately.`)) return;
    const data = await call("rotate", `/api/console/keys/${apiKey.id}/rotate`, { method: "POST" });
    if (data) setRotated(data.key);
  }

  async function toggle() {
    const disabled = apiKey.status !== "disabled";
    const data = await call("toggle", `/api/console/keys/${apiKey.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled }),
    });
    if (data) router.refresh();
  }

  async function revoke() {
    if (!confirm(`Delete "${apiKey.name}" permanently? Apps using it will stop working. This cannot be undone.`)) return;
    const data = await call("revoke", `/api/console/keys/${apiKey.id}`, { method: "DELETE" });
    if (data) {
      router.push("/console/keys");
      router.refresh();
    }
  }

  if (rotated) {
    return (
      <SecretReveal
        apiKey={rotated}
        onDone={() => {
          setRotated(null);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={rotate} disabled={!!busy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
          {busy === "rotate" ? "Rotating…" : "Rotate secret"}
        </button>
        <button onClick={toggle} disabled={!!busy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
          {busy === "toggle" ? "Saving…" : apiKey.status === "disabled" ? "Enable key" : "Disable key"}
        </button>
        <button onClick={revoke} disabled={!!busy} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60">
          {busy === "revoke" ? "Deleting…" : "Delete key"}
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
