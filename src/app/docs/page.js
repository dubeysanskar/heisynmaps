import Link from "next/link";
import Icon from "@/components/Icon";
import { Code } from "@/components/docs/Code";
import PrevNext from "@/components/docs/PrevNext";
import { A, C, H2, P } from "@/components/docs/Prose";
import { ENDPOINTS } from "@/lib/catalog";
import { GUIDE_META } from "@/lib/docs/nav";
import { siteOrigin } from "@/lib/docs/origin";

export const metadata = { title: "Introduction" };

const START = [
  { href: "/docs/guides/quickstart", icon: "play", title: "Quickstart", body: "Key to first truck route in five minutes." },
  { href: "/docs/guides/maps-sdk", icon: "map", title: "Show the map", body: "MapLibre on web, React, Android and iOS." },
  { href: "/docs/guides/logistics-recipes", icon: "route", title: "Logistics recipes", body: "Dispatch, service areas, hub alerts, trip audits." },
  { href: "/docs/guides/authentication", icon: "key", title: "Keys & security", body: "Server vs browser keys, scopes and limits." },
];

export default async function DocsHome() {
  const origin = await siteOrigin();
  const groups = [...new Set(ENDPOINTS.map((e) => e.group))];

  return (
    <article className="max-w-3xl">
      <p className="text-sm font-medium text-teal-700">Documentation</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Build with HeisynMaps</h1>
      <P>
        One REST API for maps, search, truck-aware routing, distance matrices, route optimisation, geofencing and DIGIPIN, built
        for Indian logistics. Requests and responses are JSON. Coordinates go in as <C>lat</C>/<C>lon</C>; geometry comes back as
        GeoJSON <C>[lon, lat]</C>. Distances are in metres and durations in seconds.
      </P>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {START.map((s) => (
          <Link key={s.href} href={s.href} className="group rounded-2xl border border-slate-200 p-5 hover:border-teal-600 hover:shadow-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <Icon name={s.icon} size={18} />
            </span>
            <p className="mt-3 font-semibold text-slate-900 group-hover:text-teal-800">{s.title}</p>
            <p className="mt-1 text-sm text-slate-600">{s.body}</p>
          </Link>
        ))}
      </div>

      <H2 id="base-url">Base URL and authentication</H2>
      <Code title="base URL" code={`${origin}/api/v1`} />
      <P>
        Send your key as <C>X-Api-Key</C> (or <C>Authorization: Bearer</C>, or <C>?key=</C>). Get one free in the{" "}
        <A href="/console">console</A>. Read <A href="/docs/guides/authentication">Authentication</A> for key types and locks.
      </P>
      <Code title="bash" code={`curl "${origin}/api/v1/digipin?lat=28.6315&lon=77.2167" -H "X-Api-Key: $HEISYN_KEY"`} />

      <H2 id="reference">API reference</H2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g} className="rounded-2xl border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-900">{g}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {ENDPOINTS.filter((e) => e.group === g).map((e) => (
                <li key={e.slug}>
                  <Link href={`/docs/api/${e.slug}`} className="text-teal-700 hover:underline">
                    {e.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <H2 id="guides">Guides</H2>
      <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200">
        {GUIDE_META.map((g) => (
          <li key={g.slug}>
            <Link href={`/docs/guides/${g.slug}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50">
              <span>
                <span className="block font-medium text-slate-900">{g.title}</span>
                <span className="block text-sm text-slate-600">{g.summary}</span>
              </span>
              <span className="text-slate-400">→</span>
            </Link>
          </li>
        ))}
      </ul>

      <PrevNext href="/docs" />
    </article>
  );
}
