"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { MethodBadge } from "./Prose";

export default function DocsSidebar({ nav }) {
  const pathname = usePathname();
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const sections = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return nav;
    return nav
      .map((s) => ({ ...s, items: s.items.filter((i) => `${i.label} ${s.title} ${i.method || ""}`.toLowerCase().includes(q)) }))
      .filter((s) => s.items.length);
  }, [nav, filter]);

  const current = nav.flatMap((s) => s.items).find((i) => i.href === pathname);

  const list = (
    <div className="space-y-6">
      <label className="relative block">
        <Icon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter docs"
          aria-label="Filter docs"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        />
      </label>
      {sections.length === 0 && <p className="text-sm text-slate-500">Nothing matches “{filter}”.</p>}
      {sections.map((s) => (
        <div key={s.title}>
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{s.title}</p>
          <ul className="mt-1.5 space-y-0.5">
            {s.items.map((item) => {
              const active = item.href === pathname;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                      active ? "bg-teal-50 font-medium text-teal-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {item.method && <MethodBadge method={item.method} className="w-[52px] shrink-0 text-center" />}
                    <span className="min-w-0 truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Mobile: collapsible bar under the site header */}
      <div className="sticky top-16 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <Icon name="book" size={16} className="text-teal-700" />
            {current?.label || "Documentation"}
          </span>
          <Icon name="chevron" size={16} className={open ? "rotate-180" : ""} />
        </button>
        {open && <div className="max-h-[70dvh] overflow-y-auto border-t border-slate-100 px-4 py-4">{list}</div>}
      </div>

      {/* Desktop: sticky column */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto py-8 pr-4">{list}</div>
      </aside>
    </>
  );
}
