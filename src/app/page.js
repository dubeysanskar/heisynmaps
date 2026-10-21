import Link from "next/link";
import HeroMap from "@/components/HeroMap";
import Icon from "@/components/Icon";
import ApiDemo from "@/components/landing/ApiDemo";
import PricingTable from "@/components/PricingTable";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { BRAND } from "@/lib/brand";
import { siteOrigin } from "@/lib/docs/origin";
import { firstPartyKey } from "@/lib/keys";

const FACTS = ["Truck, bike & scooter routing", "DIGIPIN on every Indian result", "100k free calls per API / month"];

const USE_CASES = [
  {
    icon: "route",
    title: "Quick commerce & last mile",
    body: "Sequence 20–60 drops per rider with scooter and bike profiles, promise slots from real service areas, and share ETAs per stop.",
    apis: [
      ["Optimise", "optimize"],
      ["Isochrone", "isochrone"],
      ["Directions", "route"],
    ],
  },
  {
    icon: "server",
    title: "Trucking & FTL",
    body: "Legal routes for the vehicle's real weight, height and axle load. Avoid tolls when the client won't pay them; plan night runs with a departure time.",
    apis: [
      ["Truck routing", "route"],
      ["Distance matrix", "matrix"],
      ["Snap to road", "snap"],
    ],
  },
  {
    icon: "users",
    title: "Field force & fleet ops",
    body: "Fence every hub, yard and customer site, then check a whole fleet's positions in one call to log arrivals and departures.",
    apis: [
      ["Geofences", "geofences-create"],
      ["Geofence check", "geofences-check"],
      ["Reverse geocode", "reverse"],
    ],
  },
  {
    icon: "pin",
    title: "Checkout address capture",
    body: "Autocomplete biased to the customer, a dropped pin turned into a 4 m DIGIPIN, and your own MapPINs for gates and loading docks.",
    apis: [
      ["Autocomplete", "autocomplete"],
      ["DIGIPIN", "digipin"],
      ["MapPIN", "places-create"],
    ],
  },
];

const FEATURES = [
  ["Truck-aware routing", "Weight, height, width, length, axle load and hazmat on every request. Car, bike, scooter, bicycle and walking too."],
  ["Distance matrix", "Travel time and distance for up to 50×50 pickups and drops in one call. Billed per element."],
  ["Route optimisation", "Reorder up to 25 stops for one rider, or plan a fleet with capacities and time windows."],
  ["Reachability", "Isochrones show what a hub can serve in 15, 30 or 45 minutes."],
  ["Search & autocomplete", "Typo-tolerant search-as-you-type, ranked near your user, with your saved places first."],
  ["DIGIPIN + MapPIN", "India Post's 4 m address grid built in, plus 6-character codes for your own places."],
  ["Geofencing", "Circle or polygon fences. Check up to 1,000 vehicle positions per call."],
  ["Snap to road", "Turn noisy GPS pings into the driven path and distance. Traces are never stored."],
  ["Vector maps & styles", "Light, dark and logistics themes with 3D buildings, for MapLibre on web, Android and iOS."],
];

const ROADMAP = [
  ["Now", "Delhi NCR", "Delhi, Gurugram, Noida, Ghaziabad, Faridabad"],
  ["Next", "All India", "28 states & 8 union territories"],
  ["Then", "International", "SAARC & GCC first, then the world"],
];

const FAQ = [
  [
    "Where does the map data come from?",
    "OpenStreetMap, rendered and routed on engines we host ourselves, plus India Post's DIGIPIN grid. Your saved places stay private to your organisation. Keep the “© OpenStreetMap contributors” credit visible on any map you show.",
  ],
  [
    "Which areas are covered?",
    "Delhi NCR is live and tuned first. All of India is next, then SAARC and GCC countries. DIGIPIN works anywhere inside India's grid.",
  ],
  [
    "Which vehicles can I route?",
    "Car, truck (with weight, height, width, length, axle load and hazmat), motorcycle, scooter, bicycle, walking and bus. Truck limits are applied per request, so every vehicle in your fleet can have its own dimensions.",
  ],
  [
    "What happens when I go past the free allowance?",
    "On the Free plan, that API stops with HTTP 402 until next month, so you are never billed by surprise. On Growth you pay per 1,000 calls beyond the allowance, in rupees.",
  ],
  [
    "Can I lock down my keys?",
    "Yes. Browser keys only work from the origins you list. Server keys can be limited to IP addresses. Any key can be scoped to certain APIs, given its own rate limit and daily quota, set to expire, disabled or rotated.",
  ],
  [
    "Can we run it in our own network?",
    "Yes, on the Enterprise plan. The whole platform runs in your VPC or data centre, so fleet and customer data never leaves it.",
  ],
  [
    "Do you store GPS traces?",
    "No. Traces sent to snap-to-road are processed and discarded. Request logs (path, status, latency, key) are kept for 14 days for debugging and billing.",
  ],
];

export default async function Home() {
  const origin = await siteOrigin();
  const demoKey = firstPartyKey();

  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-teal-50/70 to-white">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-medium text-teal-800">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> Live in Delhi NCR
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.4rem]">
                Maps and routing APIs built for Indian logistics
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">{BRAND.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/console" className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-medium text-white hover:bg-teal-800">
                  Get a free API key
                </Link>
                <Link href="/docs" className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium hover:bg-slate-50">
                  Read the docs
                </Link>
                <Link href="/maps" className="rounded-xl px-5 py-3 text-sm font-medium text-teal-800 hover:bg-teal-50">
                  Open the map →
                </Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                {FACTS.map((f) => (
                  <li key={f} className="flex items-center gap-1.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" className="text-teal-600" aria-hidden="true">
                      <path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="h-[360px] min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-2xl shadow-teal-900/10 sm:h-[440px]">
              <HeroMap apiKey={demoKey} />
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Built for operations</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">One API for every leg of the delivery</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {USE_CASES.map((u) => (
              <div key={u.title} className="flex flex-col rounded-2xl border border-slate-200 p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <Icon name={u.icon} size={20} />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{u.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{u.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {u.apis.map(([label, slug]) => (
                    <Link
                      key={label}
                      href={`/docs/api/${slug}`}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-teal-600 hover:text-teal-800"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Live API */}
        <section className="border-y border-slate-200 bg-slate-50/70">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Try it now</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Real requests, real responses</h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              These calls hit the live API with a shared demo key. Sign up for your own key and quota.
            </p>
            <div className="mt-8">
              <ApiDemo demoKey={demoKey} />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Everything a dispatch system needs</h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Built on OpenStreetMap and open engines we host ourselves, so a distance matrix doesn&apos;t cost Google-scale money.
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([title, body]) => (
              <div key={title} className="bg-white p-6">
                <h3 className="font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Developer experience */}
        <section className="bg-slate-950 text-slate-100">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
            <div className="min-w-0">
              <h2 className="text-3xl font-semibold tracking-tight text-white">Ship in an afternoon</h2>
              <p className="mt-3 text-slate-400">
                Plain REST and JSON. Coordinates go in as lat/lon; geometry comes back as GeoJSON. The map style drops straight
                into MapLibre on web, Android and iOS.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  ["/docs/guides/quickstart", "Quickstart — first truck route in five minutes"],
                  ["/docs/guides/maps-sdk", "Maps SDK — web, React, Android, iOS"],
                  ["/docs/guides/logistics-recipes", "Recipes — dispatch, service areas, hub alerts"],
                  ["/docs/guides/authentication", "Keys — scopes, origin and IP locks, quotas"],
                ].map(([href, label]) => (
                  <li key={href}>
                    <Link href={href} className="text-teal-300 hover:underline">
                      {label} →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0 space-y-4">
              <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-[12.5px] leading-relaxed text-teal-100 ring-1 ring-white/10">
                {`curl -X POST ${origin}/api/v1/route \\
  -H "X-Api-Key: $NAKSHA_KEY" -H "Content-Type: application/json" \\
  -d '{
    "locations": [{"lat":28.5355,"lon":77.271}, {"lat":28.4595,"lon":77.0266}],
    "profile": "truck",
    "truck": {"weight_t": 12, "height_m": 3.8}
  }'`}
              </pre>
              <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-[12.5px] leading-relaxed text-slate-200 ring-1 ring-white/10">
                {`new maplibregl.Map({
  container: "map",
  style: "${origin}/api/v1/style?theme=logistics&key=YOUR_BROWSER_KEY",
  center: [77.209, 28.6139],
  zoom: 11,
});`}
              </pre>
            </div>
          </div>
        </section>

        {/* Coverage */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Coverage roadmap</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {ROADMAP.map(([when, title, body], i) => (
              <div key={title} className={`rounded-2xl border p-6 ${i === 0 ? "border-teal-600 bg-teal-50/50" : "border-slate-200"}`}>
                <p className={`text-xs font-semibold uppercase tracking-wider ${i === 0 ? "text-teal-700" : "text-slate-500"}`}>{when}</p>
                <p className="mt-2 text-xl font-semibold">{title}</p>
                <p className="mt-1 text-sm text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing teaser */}
        <section id="pricing" className="border-t border-slate-200 bg-slate-50/60">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">Pricing</h2>
                <p className="mt-3 max-w-2xl text-slate-600">Free to start. Pay per 1,000 calls after that, in rupees.</p>
              </div>
              <Link href="/pricing" className="text-sm font-medium text-teal-700 hover:underline">
                Per-API prices →
              </Link>
            </div>
            <div className="mt-10">
              <PricingTable showSkus={false} />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Questions</h2>
          <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                  {q}
                  <Icon name="chevron" size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-5xl rounded-3xl bg-teal-800 px-6 py-12 text-center text-white sm:px-12">
            <h2 className="text-3xl font-semibold tracking-tight">Start routing in five minutes</h2>
            <p className="mx-auto mt-3 max-w-xl text-teal-100">
              Free key, 100,000 calls per API every month, no card. Upgrade when your fleet does.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/console" className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-teal-900 hover:bg-teal-50">
                Get a free API key
              </Link>
              <Link href="/docs/guides/quickstart" className="rounded-xl border border-teal-400/60 px-5 py-3 text-sm font-medium text-white hover:bg-teal-700">
                Read the quickstart
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
