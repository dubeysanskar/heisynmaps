"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icon, { Logo } from "@/components/Icon";

// Sidebar layout shared by /console (customers) and /admin (platform staff).
//   nav: [{ href, label, icon }]   badge: short label next to the logo ("Console", "Admin")
export default function DashShell({ nav, badge, user, links = [], children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href) => (href === nav[0]?.href ? pathname === href : pathname === href || pathname.startsWith(href + "/"));

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-slate-50 md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white md:sticky md:top-0 md:h-dvh md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-semibold tracking-tight">Naksha</span>
          </Link>
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              badge === "Admin" ? "bg-amber-100 text-amber-800" : "bg-teal-50 text-teal-800"
            }`}
          >
            {badge}
          </span>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                isActive(item.href) ? "bg-teal-50 font-medium text-teal-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.icon && <Icon name={item.icon} size={16} />}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-slate-200 p-3 text-sm md:block">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100">
              {l.label}
            </Link>
          ))}
          <div className="mt-2 px-3">
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
            <button onClick={signOut} className="mt-1 text-xs font-medium text-slate-700 hover:text-red-600">
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 bg-white px-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
