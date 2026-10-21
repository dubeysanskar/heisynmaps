import Link from "next/link";
import { notFound } from "next/navigation";
import ApiRunner from "@/components/api/ApiRunner";
import { Code, CodeTabs } from "@/components/docs/Code";
import PrevNext from "@/components/docs/PrevNext";
import { A, C, Callout, H2, MethodBadge, P } from "@/components/docs/Prose";
import { getSessionUser } from "@/lib/auth";
import { API_GROUPS, endpointBySlug, skuGroup } from "@/lib/catalog";
import { siteOrigin } from "@/lib/docs/origin";
import { prettyJson, snippets } from "@/lib/docs/snippets";
import { firstPartyKey } from "@/lib/keys";
import { effectiveSkus } from "@/lib/settings";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const e = endpointBySlug(slug);
  return e ? { title: `${e.title} API`, description: e.summary } : {};
}

const IN_ORDER = ["path", "query", "body"];
const IN_LABEL = { path: "Path parameters", query: "Query parameters", body: "Body (JSON)" };

export default async function EndpointPage({ params }) {
  const { slug } = await params;
  const endpoint = endpointBySlug(slug);
  if (!endpoint) notFound();

  const [origin, session, skus] = await Promise.all([siteOrigin(), getSessionUser(), effectiveSkus()]);
  const sku = endpoint.sku ? skus[endpoint.sku] : null;
  const scope = endpoint.sku ? skuGroup(endpoint.sku) : null;
  const params_ = endpoint.params || [];
  // Strip server-only/non-serialisable bits before handing the endpoint to a client component.
  const runnerEndpoint = { slug: endpoint.slug, method: endpoint.method, path: endpoint.path, example: endpoint.example };

  return (
    <article className="max-w-4xl">
      <p className="text-sm font-medium text-teal-700">API reference · {endpoint.group}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{endpoint.title}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <MethodBadge method={endpoint.method} />
        <code className="min-w-0 break-all font-mono text-sm text-slate-900">{endpoint.path}</code>
      </div>
      <P>{endpoint.summary}</P>
      {endpoint.description && <P>{endpoint.description}</P>}

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-3">
          <dt className="text-xs text-slate-500">Authentication</dt>
          <dd className="mt-0.5 font-medium text-slate-900">{endpoint.slug === "status" ? "None" : "API key"}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <dt className="text-xs text-slate-500">Key scope</dt>
          <dd className="mt-0.5 font-medium text-slate-900">{scope ? `${scope} · ${API_GROUPS[scope]}` : "—"}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <dt className="text-xs text-slate-500">Billing</dt>
          <dd className="mt-0.5 font-medium text-slate-900">
            {!sku ? "Not billed" : sku.inrPer1k ? `${endpoint.sku} · ₹${sku.inrPer1k} / 1,000 after free tier` : `${endpoint.sku} · free`}
          </dd>
        </div>
      </dl>
      {sku?.disabled && (
        <Callout tone="warn" title="Temporarily unavailable">
          {sku.note || "This API is switched off for maintenance and returns 503 api_disabled."}
        </Callout>
      )}

      {params_.length > 0 && <H2 id="parameters">Parameters</H2>}
      {IN_ORDER.filter((where) => params_.some((p) => p.in === where)).map((where) => (
        <div key={where} className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{IN_LABEL[where]}</p>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {params_
              .filter((p) => p.in === where)
              .map((p) => (
                <li key={p.name} className="px-4 py-3 sm:flex sm:gap-6">
                  <div className="shrink-0 sm:w-44">
                    <code className="font-mono text-[13px] font-semibold text-slate-900">{p.name}</code>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-mono text-slate-500">{p.type}</span>
                      {p.required ? (
                        <span className="rounded bg-amber-100 px-1.5 py-px font-medium text-amber-800">required</span>
                      ) : (
                        <span className="text-slate-400">optional</span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700 sm:mt-0">{p.description}</p>
                </li>
              ))}
          </ul>
        </div>
      ))}

      <H2 id="request">Request</H2>
      <CodeTabs tabs={snippets(endpoint, origin)} />

      <H2 id="response">Example response</H2>
      {typeof endpoint.response === "string" ? (
        <P>{endpoint.response}</P>
      ) : (
        <>
          <Code title="200 OK · application/json" code={prettyJson(endpoint.response)} maxHeight={480} />
          <p className="text-xs text-slate-500">Long coordinate and step arrays are shortened in this example.</p>
        </>
      )}

      <H2 id="try-it">Try it</H2>
      <P>
        Calls the live API.{" "}
        {session ? (
          <>Choose “My account” to use your own quota, or paste a key.</>
        ) : (
          <>
            The demo key is shared and rate limited. <A href="/console">Sign in</A> to use your own account.
          </>
        )}
      </P>
      <div className="mt-4">
        <ApiRunner endpoint={runnerEndpoint} signedIn={Boolean(session)} demoKey={firstPartyKey()} compact />
      </div>

      <H2 id="errors">Errors</H2>
      <P>
        Errors return <C>{`{ "error": { "code", "message" } }`}</C>. Common ones here: <C>invalid_param</C> (400),{" "}
        {endpoint.group === "Routing" && (
          <>
            <C>no_route</C> (422), <C>routing_busy</C> (503),{" "}
          </>
        )}
        {endpoint.group === "Search" && (
          <>
            <C>search_busy</C> (503),{" "}
          </>
        )}
        <C>rate_limited</C> (429) and <C>quota_exceeded</C> (402). See <Link href="/docs/guides/errors" className="font-medium text-teal-700 hover:underline">all error codes</Link>.
      </P>

      <PrevNext href={`/docs/api/${endpoint.slug}`} />
    </article>
  );
}
