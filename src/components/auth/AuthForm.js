"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Sign up / sign in. On success the server layout re-renders with the session.
export default function AuthForm({ initialMode = "signup", title }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: "", company: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Something went wrong");
      router.refresh();
    } catch (err) {
      setError(err.message);
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
      <h1 className="text-3xl font-semibold tracking-tight">
        {title || (mode === "signup" ? "Create your account" : "Welcome back")}
      </h1>
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
