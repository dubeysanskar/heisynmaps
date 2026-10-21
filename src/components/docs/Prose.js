import Link from "next/link";

// Small building blocks for docs pages (server-renderable).

export function H2({ id, children }) {
  return (
    <h2 id={id} className="mt-12 scroll-mt-24 text-xl font-semibold tracking-tight text-slate-950">
      {id ? (
        <a href={`#${id}`} className="hover:underline">
          {children}
        </a>
      ) : (
        children
      )}
    </h2>
  );
}

export function H3({ children }) {
  return <h3 className="mt-8 text-base font-semibold text-slate-900">{children}</h3>;
}

export function P({ children }) {
  return <p className="mt-3 leading-relaxed text-slate-700">{children}</p>;
}

export function UL({ children }) {
  return <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-slate-700 marker:text-slate-400">{children}</ul>;
}

export function OL({ children }) {
  return <ol className="mt-3 list-decimal space-y-1.5 pl-5 leading-relaxed text-slate-700 marker:text-slate-400">{children}</ol>;
}

export function C({ children }) {
  return <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800">{children}</code>;
}

export function A({ href, children }) {
  const external = /^https?:/.test(href);
  return external ? (
    <a href={href} className="font-medium text-teal-700 underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <Link href={href} className="font-medium text-teal-700 underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

const TONES = {
  info: "border-sky-200 bg-sky-50 text-sky-950",
  tip: "border-teal-200 bg-teal-50 text-teal-950",
  warn: "border-amber-200 bg-amber-50 text-amber-950",
};

export function Callout({ tone = "info", title, children }) {
  return (
    <div className={`mt-5 rounded-xl border px-4 py-3 text-sm leading-relaxed ${TONES[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

// rows: [[cell, cell, …], …]; first column is rendered as code when `codeFirst`.
export function Table({ head, rows, codeFirst = true }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="align-top">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-2.5 ${j === 0 && codeFirst ? "whitespace-nowrap font-mono text-[13px] text-slate-900" : "text-slate-700"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MethodBadge({ method, className = "" }) {
  const tone =
    method === "GET"
      ? "bg-sky-100 text-sky-800"
      : method === "DELETE"
        ? "bg-red-100 text-red-800"
        : "bg-teal-100 text-teal-800";
  return <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${tone} ${className}`}>{method}</span>;
}
