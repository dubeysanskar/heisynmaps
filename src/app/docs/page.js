import { headers } from "next/headers";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ENDPOINTS } from "@/lib/catalog";

export const metadata = { title: "API reference — Naksha Maps" };

const slug = (e) => `${e.method}-${e.path}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function example(origin, e) {
  if (!e.example) return null;
  if (e.method === "GET") {
    const qs = new URLSearchParams(Object.entries(e.example.query || {}).map(([k, v]) => [k, String(v)])).toString();
    const auth = e.sku ? `${qs ? "&" : ""}key=$NAKSHA_KEY` : "";
    return `curl "${origin}${e.path}${qs || auth ? "?" : ""}${qs}${auth}"`;
  }
  return `curl -X ${e.method} "${origin}${e.path}" \\
  -H "X-Api-Key: $NAKSHA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(e.example.body, null, 2)}'`;
}

function ParamTable({ title, rows }) {
  if (!rows) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <table className="mt-2 w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {Object.entries(rows).map(([k, v]) => (
            <tr key={k}>
              <td className="w-40 py-1.5 pr-4 align-top font-mono text-[13px] text-slate-900">{k}</td>
              <td className="py-1.5 text-slate-600">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DocsPage() {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") || "http"}://${h.get("x-forwarded-host") || h.get("host")}`;
  const groups = [...new Set(ENDPOINTS.map((e) => e.group))];

  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-6xl gap-10 px-4 py-12 sm:px-6">
        <nav className="sticky top-24 hidden h-fit w-56 shrink-0 text-sm lg:block">
          <a href="#auth" className="block py-1 font-medium text-slate-900">
            Authentication
          </a>
          {groups.map((g) => (
            <div key={g} className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{g}</p>
              {ENDPOINTS.filter((e) => e.group === g).map((e) => (
                <a key={slug(e)} href={`#${slug(e)}`} className="block py-1 text-slate-600 hover:text-slate-900">
                  {e.title}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <main className="min-w-0 flex-1">
          <h1 className="text-4xl font-semibold tracking-tight">API reference</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Base URL <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">{origin}/api/v1</code>. Requests and
            responses are JSON. Inputs use <code>lat</code>/<code>lon</code>; geometry comes back as GeoJSON{" "}
            <code>[lon, lat]</code>. Distances are in metres and durations in seconds.
          </p>

          <section id="auth" className="mt-10 scroll-mt-24 rounded-2xl border border-slate-200 p-6">
            <h2 className="text-xl font-semibold">Authentication</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Create keys in the <Link href="/console" className="text-teal-700 underline">console</Link>. Send them as{" "}
              <code>X-Api-Key</code>, <code>Authorization: Bearer</code> or <code>?key=</code>. <b>Server keys</b> are
              secret. <b>Browser keys</b> only work from the origins you list, so they are safe to put in front-end code.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              <li>
                <code>401</code> missing or invalid key · <code>403</code> origin not allowed · <code>429</code> rate
                limited (see <code>Retry-After</code>) · <code>422</code> no route found
              </li>
              <li>
                Errors always look like <code>{`{"error": {"code": "...", "message": "..."}}`}</code>
              </li>
              <li>
                <code>X-RateLimit-Limit</code> and <code>X-RateLimit-Remaining</code> come back on every response.
              </li>
            </ul>
          </section>

          {groups.map((g) => (
            <section key={g} className="mt-14">
              <h2 className="text-2xl font-semibold tracking-tight">{g}</h2>
              {ENDPOINTS.filter((e) => e.group === g).map((e) => (
                <article key={slug(e)} id={slug(e)} className="mt-6 scroll-mt-24 rounded-2xl border border-slate-200 p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
                        e.method === "GET" ? "bg-sky-100 text-sky-800" : "bg-teal-100 text-teal-800"
                      }`}
                    >
                      {e.method}
                    </span>
                    <code className="text-[15px] font-medium text-slate-900">{e.path}</code>
                    {e.sku && <span className="ml-auto font-mono text-xs text-slate-400">sku: {e.sku}</span>}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{e.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{e.summary}</p>
                  <ParamTable title="Query parameters" rows={e.query} />
                  <ParamTable title="Body" rows={e.body} />
                  {example(origin, e) && (
                    <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-[12.5px] leading-relaxed text-teal-100">
                      {example(origin, e)}
                    </pre>
                  )}
                </article>
              ))}
            </section>
          ))}

          <section className="mt-14 rounded-2xl bg-slate-50 p-6 text-sm leading-relaxed text-slate-600">
            <h2 className="text-base font-semibold text-slate-900">Attribution</h2>
            Map data © <a href="https://www.openstreetmap.org/copyright" className="underline">OpenStreetMap contributors</a>,
            available under the ODbL. Keep the attribution visible on any map you show. DIGIPIN is India Post&apos;s open
            addressing grid.
          </section>
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
