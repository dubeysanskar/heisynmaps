import Link from "next/link";

// Small presentational helpers for /admin (server-component safe).

export const fmtNum = (v) => Number(v || 0).toLocaleString("en-IN");
export const fmtInr = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const fmtPct = (v) => `${(Number(v || 0) * 100).toFixed(Number(v) && Number(v) < 0.01 ? 2 : 1)}%`;
export const fmtMs = (v) => (v == null ? "—" : `${Math.round(v).toLocaleString("en-IN")} ms`);

export function fmtDate(iso, { time = false } = {}) {
  if (!iso) return "—";
  const d = new Date(iso);
  return time
    ? d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(iso) {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.max(0, s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

const BADGE = {
  active: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  suspended: "bg-red-50 text-red-700 ring-red-200",
  disabled: "bg-amber-50 text-amber-800 ring-amber-200",
  expired: "bg-slate-100 text-slate-600 ring-slate-200",
  revoked: "bg-slate-100 text-slate-500 ring-slate-200",
  admin: "bg-amber-50 text-amber-800 ring-amber-200",
  member: "bg-slate-100 text-slate-600 ring-slate-200",
  free: "bg-slate-100 text-slate-700 ring-slate-200",
  growth: "bg-teal-50 text-teal-800 ring-teal-200",
  enterprise: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  system: "bg-sky-50 text-sky-800 ring-sky-200",
  "self-hosted": "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "public-fallback": "bg-amber-50 text-amber-800 ring-amber-200",
};

const LABEL = {
  "self-hosted": "Self-hosted",
  "public-fallback": "Dev fallback",
  disabled: "Disabled",
  sqlite: "SQLite",
  postgres: "Postgres",
  enterprise: "Enterprise",
};

export function Badge({ value, children }) {
  const text = children || LABEL[value] || (value ? value[0].toUpperCase() + value.slice(1) : "");
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
        BADGE[value] || "bg-slate-100 text-slate-700 ring-slate-200"
      }`}
    >
      {text}
    </span>
  );
}

export function StatusCode({ status }) {
  const cls =
    status >= 500 ? "bg-red-100 text-red-800" : status >= 400 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
  return <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${cls}`}>{status}</span>;
}

// Tables scroll inside their card, never the page.
export function Table({ head, children, empty, colSpan, minWidth = 640 }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
            {head.map((h, i) => (
              <th
                key={i}
                className={`whitespace-nowrap px-5 pb-2 font-medium ${typeof h === "object" && h.right ? "text-right" : ""}`}
              >
                {typeof h === "object" ? h.label : h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {children}
          {empty && (
            <tr>
              <td colSpan={colSpan || head.length} className="px-5 py-8 text-center text-slate-500">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, right, mono, wrap, className = "" }) {
  return (
    <td className={`${wrap ? "whitespace-normal" : "whitespace-nowrap"} px-5 py-2.5 ${right ? "text-right tabular-nums" : ""} ${mono ? "font-mono text-xs" : ""} ${className}`}>
      {children}
    </td>
  );
}

// GET-form search box; filters live in the URL so pages stay server-rendered.
export function SearchForm({ action, q, placeholder, children }) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="h-9 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 sm:w-64"
      />
      {children}
      <button className="h-9 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700">Filter</button>
    </form>
  );
}

export function Pager({ basePath, params, offset, limit, hasMore }) {
  const href = (o) => {
    const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)), offset: String(o) });
    return `${basePath}?${qs}`;
  };
  if (!offset && !hasMore) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      {offset > 0 ? (
        <Link href={href(Math.max(0, offset - limit))} className="text-teal-700 hover:underline">
          ← Newer
        </Link>
      ) : (
        <span />
      )}
      <span className="text-xs text-slate-500">
        Showing {offset + 1}–{offset + limit}
      </span>
      {hasMore ? (
        <Link href={href(offset + limit)} className="text-teal-700 hover:underline">
          Older →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
