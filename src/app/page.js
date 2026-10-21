import Link from "next/link";
import { headers } from "next/headers";
import HeroMap from "@/components/HeroMap";
import PricingTable from "@/components/PricingTable";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { BRAND } from "@/lib/brand";
import { firstPartyKey } from "@/lib/keys";

const FEATURES = [
  ["Truck-aware routing", "Weight, height, axle load and hazmat applied on every request. Car, bike, scooter, bicycle and walking too."],
  ["Distance matrix", "Travel time and distance for up to 50×50 pickups and drops in one call. Billed per element."],
  ["Route optimisation", "Reorder up to 25 stops for one rider, or plan a whole fleet with capacities and time windows."],
  ["Reachability", "Isochrones show what a hub can serve in 15, 30 or 45 minutes. Use them to plan dark stores and service areas."],
  ["Search & autocomplete", "Typo-tolerant search-as-you-type for places and addresses, biased to where your user is."],
  ["DIGIPIN + MapPIN", "India Post's 4 m address grid built in, plus 6-character codes for your own hubs and customer gates."],
  ["Geofencing", "Circle or polygon fences around hubs and yards. Check up to 1,000 vehicle positions per call."],
  ["Snap to road", "Turn noisy GPS pings into the actual driven path and distance, for billing and trip audits."],
  ["Vector maps & styles", "Light, dark and logistics themes with 3D buildings. Works with MapLibre on web and mobile."],
];

const ROADMAP = [
  ["Now", "Delhi NCR", "Delhi, Gurugram, Noida, Ghaziabad, Faridabad"],
  ["Next", "All India", "28 states & 8 UTs, Survey of India boundary"],
  ["Then", "International", "SAARC & GCC first, then the world"],
];

const curl = (origin) => `curl -X POST ${origin}/api/v1/route \\
  -H "X-Api-Key: $NAKSHA_KEY" -H "Content-Type: application/json" \\
  -d '{
    "locations": [{"lat":28.5355,"lon":77.271}, {"lat":28.4595,"lon":77.0266}],
    "profile": "truck",
    "truck": {"weight_t": 12, "height_m": 3.8}
  }'`;

const js = (origin) => `import maplibregl from "maplibre-gl";

new maplibregl.Map({
  container: "map",
  style: "${origin}/api/v1/style?theme=light&key=YOUR_BROWSER_KEY",
  center: [77.209, 28.6139],
  zoom: 11,
});`;

export default async function Home() {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") || "http"}://${h.get("x-forwarded-host") || h.get("host")}`;
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-teal-50/60 to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-medium text-teal-800">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> Live in Delhi NCR
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl">
                Maps and routing APIs built for Indian logistics
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">{BRAND.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/console" className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-medium text-white hover:bg-teal-800">
                  Get a free API key
                </Link>
                <Link href="/maps" className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium hover:bg-slate-50">
                  Open the map
                </Link>
              </div>
              <p className="mt-4 text-sm text-slate-500">100,000 free calls per API, every month. Billed in INR.</p>
            </div>
            <div className="h-[380px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-2xl shadow-teal-900/10 sm:h-[440px]">
              <HeroMap apiKey={firstPartyKey()} />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Everything a dispatch system needs</h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            One API key for maps, search, routing and fleet. Built on OpenStreetMap and open engines we host ourselves, so you never pay
            Google-scale prices for a distance matrix.
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

        <section className="border-y border-slate-200 bg-slate-950 text-slate-100">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-white">Ship in an afternoon</h2>
              <p className="mt-3 text-slate-400">
                Plain REST and JSON. Coordinates go in as lat/lon; geometry comes back as GeoJSON. The map style drops
                straight into MapLibre GL.
              </p>
              <Link href="/docs" className="mt-6 inline-block text-sm font-medium text-teal-300 hover:underline">
                Read the API reference →
              </Link>
            </div>
            <div className="space-y-4">
              <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-[12.5px] leading-relaxed text-teal-100 ring-1 ring-white/10">
                {curl(origin)}
              </pre>
              <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-[12.5px] leading-relaxed text-slate-200 ring-1 ring-white/10">
                {js(origin)}
              </pre>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
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

        <section id="pricing" className="border-t border-slate-200 bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">Pricing</h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              Free to start. Usage-based after that, with self-hosted enterprise plans for teams whose data has to stay in
              their own network.
            </p>
            <div className="mt-10">
              <PricingTable />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
