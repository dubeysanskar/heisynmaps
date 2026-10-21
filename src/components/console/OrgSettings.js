"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OrgSettings({ name: initialName }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [state, setState] = useState({ busy: false, msg: null, error: null });

  async function save(e) {
    e.preventDefault();
    setState({ busy: true, msg: null, error: null });
    const res = await fetch("/api/console/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setState({ busy: false, msg: null, error: data?.error?.message || "Could not save" });
    setState({ busy: false, msg: "Saved", error: null });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-3">
      <label className="block min-w-64 flex-1 text-sm">
        <span className="font-medium text-slate-800">Organisation name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-teal-600"
          required
        />
      </label>
      <button disabled={state.busy} className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60">
        {state.busy ? "Saving…" : "Save"}
      </button>
      {state.msg && <span className="text-sm text-emerald-700">{state.msg}</span>}
      {state.error && <span className="text-sm text-red-700">{state.error}</span>}
    </form>
  );
}
