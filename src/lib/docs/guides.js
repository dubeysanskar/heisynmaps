import { Code } from "@/components/docs/Code";
import { A, C, Callout, H2, H3, OL, P, Table, UL } from "@/components/docs/Prose";
import { API_GROUPS, PLANS } from "@/lib/catalog";
import { GUIDE_META } from "./nav";

// Guide pages. Each Body receives { origin } (the site's own base URL) for samples.
const fmt = (n) => n.toLocaleString("en-IN");

const BODIES = {
  quickstart: ({ origin }) => (
    <>
      <P>Four steps from zero to a truck route. You need a terminal with <C>curl</C>, nothing else.</P>
      <H2 id="account">1. Create an account</H2>
      <P>
        Sign up in the <A href="/console">console</A>. The Free plan includes {fmt(PLANS.free.includedPerSku)} calls per API every
        month and needs no card.
      </P>
      <H2 id="key">2. Create a server key</H2>
      <P>
        Open <A href="/console/keys/new">Console → API keys → Create key</A>, pick <b>Server</b> and copy the key. It starts with{" "}
        <C>nk_sk_</C> and is shown only once. Keep it in an environment variable:
      </P>
      <Code title="bash" code={`export NAKSHA_KEY="nk_sk_…"`} />
      <H2 id="call">3. Make your first call</H2>
      <P>Geocode a Delhi NCR address. Every Indian result carries a DIGIPIN.</P>
      <Code title="bash" code={`curl "${origin}/api/v1/geocode?q=Sector%2018%20Noida" -H "X-Api-Key: $NAKSHA_KEY"`} />
      <P>Then route a 12-tonne truck from Okhla to Gurugram:</P>
      <Code
        title="bash"
        code={`curl -X POST "${origin}/api/v1/route" \\
  -H "X-Api-Key: $NAKSHA_KEY" -H "Content-Type: application/json" \\
  -d '{"locations":[{"lat":28.5355,"lon":77.271},{"lat":28.4595,"lon":77.0266}],
       "profile":"truck","truck":{"weight_t":12,"height_m":3.8}}'`}
      />
      <P>
        The answer has <C>distance_m</C>, <C>duration_s</C>, a GeoJSON <C>geometry</C> you can draw on any map, and turn-by-turn{" "}
        <C>steps</C>.
      </P>
      <H2 id="map">4. Show the map</H2>
      <P>
        Create a <b>Browser</b> key locked to your site's origin and load our style in MapLibre. The full setup is in the{" "}
        <A href="/docs/guides/maps-sdk">Maps SDK guide</A>.
      </P>
      <Callout tone="tip" title="Try before you code">
        Every <A href="/docs/api/route">API reference page</A> has a live <b>Try it</b> panel, and the console has a playground. Both
        call the real API.
      </Callout>
    </>
  ),

  authentication: () => (
    <>
      <P>Every request except <C>/api/v1/status</C> needs an API key. Send it in whichever way suits your client:</P>
      <Table
        head={["Where", "Example"]}
        rows={[
          ["Header (recommended)", <C key="h">X-Api-Key: nk_sk_…</C>],
          ["Bearer token", <C key="b">Authorization: Bearer nk_sk_…</C>],
          ["Query string", <C key="q">?key=nk_pub_…</C>],
        ]}
        codeFirst={false}
      />
      <P>
        Use the query string only where you can't set headers, such as a MapLibre style URL. Keys in URLs end up in logs and browser
        history.
      </P>

      <H2 id="types">Server keys and browser keys</H2>
      <Table
        head={["", "Server key", "Browser key"]}
        codeFirst={false}
        rows={[
          ["Prefix", <C key="1">nk_sk_</C>, <C key="2">nk_pub_</C>],
          ["Where it lives", "Your backend only. Treat it like a password.", "Front-end code and map styles on your website"],
          ["Lock", "Optional IP allowlist", "Required list of allowed origins"],
          ["Typical use", "Dispatch, matrix, optimisation, geofence checks", "Showing the map, autocomplete in a checkout form"],
        ]}
      />
      <H3>Allowed origins (browser keys)</H3>
      <P>
        The request's <C>Origin</C> header, or the <C>Referer</C> when a browser leaves Origin out, must match one entry. Requests
        with neither are refused with <C>origin_required</C>.
      </P>
      <UL>
        <li>
          <C>https://app.example.com</C> matches that exact scheme and host
        </li>
        <li>
          <C>app.example.com</C> matches the host on any scheme
        </li>
        <li>
          <C>*.example.com</C> matches any one-level subdomain
        </li>
        <li>
          <C>http://localhost:3000</C> is handy during development
        </li>
      </UL>
      <P>
        Vector tile and TileJSON requests skip the origin check, because MapLibre fetches them from web workers that don't always
        send a Referer. Map loads through <C>/api/v1/style</C> are still checked.
      </P>
      <H3>IP allowlist (server keys)</H3>
      <P>
        List exact addresses (<C>203.0.113.7</C>, IPv6 too) or IPv4 CIDR ranges (<C>10.20.0.0/16</C>). The client IP is the first
        address in <C>X-Forwarded-For</C>. Anything else gets <C>ip_not_allowed</C>. Leave the list empty to allow any IP.
      </P>

      <H2 id="scopes">Scopes</H2>
      <P>
        Limit what a key can call. A key with no scopes can call everything. Calling an API outside a key's scopes returns{" "}
        <C>403 scope_denied</C>.
      </P>
      <Table
        head={["Scope", "Covers"]}
        rows={Object.entries(API_GROUPS).map(([id, label]) => [
          id,
          {
            maps: "Map style and vector tiles",
            search: "Autocomplete, geocode, reverse, nearby",
            routing: "Directions, matrix, isochrones, optimisation, snap to road",
            fleet: "Create, list, delete and check geofences",
            addressing: "DIGIPIN and saved places (MapPIN)",
          }[id] || label,
        ])}
      />

      <H2 id="limits">Per-key limits</H2>
      <UL>
        <li>
          <b>Requests per minute</b> can be set lower than your plan's limit, so one noisy integration can't use up the whole
          account. The effective limit is the lower of the two.
        </li>
        <li>
          <b>Daily quota</b> caps the calls a key can make per UTC day. Once it's used up the key gets <C>429 daily_quota_exceeded</C>{" "}
          until midnight UTC.
        </li>
        <li>
          <b>Expiry date</b>: after it, the key returns <C>401 key_expired</C>. Useful for contractors and pilots.
        </li>
      </UL>

      <H2 id="lifecycle">Disable, rotate, revoke</H2>
      <UL>
        <li>
          <b>Disable</b> pauses a key (<C>403 key_disabled</C>) and keeps its settings. Enable it again any time.
        </li>
        <li>
          <b>Rotate</b> issues a new secret with the same name, scopes and limits. The old secret stops working immediately, so
          deploy the new one first if you can't afford a gap.
        </li>
        <li>
          <b>Revoke</b> deletes the key for good.
        </li>
      </UL>
      <Callout tone="warn" title="Leaked a server key?">
        Rotate it in the console right away, then check <A href="/console/logs">request logs</A> for calls you don't recognise.
      </Callout>
    </>
  ),

  errors: () => (
    <>
      <P>Errors use normal HTTP status codes and always have the same JSON body:</P>
      <Code title="json" code={`{\n  "error": {\n    "code": "invalid_param",\n    "message": "lat must be a number between -90 and 90"\n  }\n}`} />
      <P>
        Branch on <C>code</C>, which is stable. <C>message</C> is for humans and may change. The code is also in the{" "}
        <C>X-Naksha-Error</C> response header.
      </P>
      <H2 id="auth">Authentication and access</H2>
      <Table
        head={["Code", "Status", "Meaning"]}
        rows={[
          ["missing_key", "401", "No key in the header, Bearer token or ?key="],
          ["invalid_key", "401", "Key is wrong or has been revoked"],
          ["key_expired", "401", "Key is past its expiry date"],
          ["not_signed_in", "401", "Console playground call without a session"],
          ["key_disabled", "403", "Key is disabled in the console"],
          ["origin_required", "403", "Browser key used without an Origin or Referer (e.g. from a server)"],
          ["origin_not_allowed", "403", "Browser key used from an origin that isn't on its list"],
          ["ip_not_allowed", "403", "Server key used from an IP that isn't on its allowlist"],
          ["scope_denied", "403", "Key isn't scoped for this API group"],
          ["account_suspended", "403", "The organisation is suspended. Contact support."],
        ]}
      />
      <H2 id="limits">Limits and quotas</H2>
      <Table
        head={["Code", "Status", "Meaning"]}
        rows={[
          ["rate_limited", "429", "Per-minute limit hit. Wait for Retry-After seconds."],
          ["daily_quota_exceeded", "429", "The key's daily quota is used up (resets at midnight UTC)"],
          ["quota_exceeded", "402", "Free plan's monthly allowance for this API is used up. Upgrade to continue."],
        ]}
      />
      <H2 id="requests">Bad requests</H2>
      <Table
        head={["Code", "Status", "Meaning"]}
        rows={[
          ["invalid_param", "400", "A parameter is missing, out of range or the wrong type (message says which)"],
          ["invalid_json", "400", "Body isn't valid JSON"],
          ["invalid_profile", "400", "Unknown routing profile"],
          ["too_large", "400", "Too many points, elements, jobs or vehicles, or a geometry that's too big"],
          ["invalid_tile", "400", "Tile coordinates out of range"],
          ["not_found", "404", "No place or geofence with that id/MapPIN in your organisation"],
          ["no_tiles", "404", "Server has no local tileset (development setups)"],
          ["no_route", "422", "The stops can't be connected with this profile, e.g. a truck too tall for every way in"],
          ["routing_error", "400", "Routing engine rejected the request (message has details)"],
        ]}
      />
      <H2 id="server">Server side</H2>
      <Table
        head={["Code", "Status", "What to do"]}
        rows={[
          ["routing_busy / search_busy", "503", "Engine is overloaded. Retry with backoff."],
          ["api_disabled", "503", "This API is switched off for maintenance. Message says why."],
          ["vroom_not_configured", "501", "Fleet optimisation isn't enabled on this server"],
          ["routing_unavailable / search_unavailable / optimizer_unavailable", "502", "Engine unreachable. Retry with backoff."],
          ["routing_error / search_error / optimizer_error", "502", "Engine returned an unexpected error"],
          ["internal_error", "500", "Our bug. Retry once, then tell support with the time of the request."],
        ]}
      />
      <H2 id="retry">Retrying safely</H2>
      <P>Retry 429, 502, 503 and network errors with exponential backoff and jitter. Don't retry other 4xx errors: fix the request.</P>
      <Code
        title="js"
        code={`async function naksha(url, init, attempt = 0) {
  const res = await fetch(url, init);
  if ([429, 502, 503].includes(res.status) && attempt < 4) {
    const wait = Number(res.headers.get("Retry-After")) * 1000 || 500 * 2 ** attempt;
    await new Promise((r) => setTimeout(r, wait + Math.random() * 250));
    return naksha(url, init, attempt + 1);
  }
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error.message), { code: data.error.code, status: res.status });
  return data;
}`}
      />
    </>
  ),

  "rate-limits": () => (
    <>
      <P>Three independent limits apply to every call. Whichever is hit first wins.</P>
      <H2 id="per-minute">Requests per minute</H2>
      <Table
        head={["Plan", "Requests / minute", "Included calls per API per month", "After that"]}
        codeFirst={false}
        rows={[
          [PLANS.free.name, fmt(PLANS.free.rpm), fmt(PLANS.free.includedPerSku), "Blocked until next month (402 quota_exceeded)"],
          [PLANS.growth.name, fmt(PLANS.growth.rpm), fmt(PLANS.growth.includedPerSku), "Billed per 1,000 calls"],
          [PLANS.enterprise.name, fmt(PLANS.enterprise.rpm), "Unlimited", "Contract"],
        ]}
      />
      <P>
        The limit is counted per key in fixed one-minute windows. You can give a key a lower limit of its own in the console. Every
        response tells you where you stand:
      </P>
      <Code title="http" code={`X-RateLimit-Limit: 300\nX-RateLimit-Remaining: 287`} />
      <P>
        Over the limit you get <C>429 rate_limited</C> with a <C>Retry-After</C> header (seconds until the next window).
      </P>
      <H2 id="daily">Daily quota per key</H2>
      <P>
        Optional, set per key. It counts billable units per UTC day and returns <C>429 daily_quota_exceeded</C> once used up. Use it
        to stop a bug in one integration from burning the whole month's allowance.
      </P>
      <H2 id="monthly">Monthly allowance</H2>
      <P>
        Each API (SKU) has its own monthly allowance, counted for the whole organisation. Some APIs bill per unit rather than per
        request:
      </P>
      <UL>
        <li>
          <b>Distance matrix</b>: one unit per source × target element (a 10×10 matrix is 100 units)
        </li>
        <li>
          <b>Geofence check</b>: one unit per point checked
        </li>
        <li>
          <b>DIGIPIN</b> and <b>vector tiles</b> are free
        </li>
      </UL>
      <P>
        See live counts in <A href="/console/usage">Console → Usage</A> and prices on the <A href="/pricing">pricing page</A>.
      </P>
      <H2 id="tips">Staying under the limits</H2>
      <UL>
        <li>Debounce autocomplete by about 200 ms and wait for 2–3 characters before searching</li>
        <li>Cache geocodes for addresses you see again; the result for a DIGIPIN never changes</li>
        <li>Use one matrix call instead of many route calls when you only need times and distances</li>
        <li>Send the latest position of all vehicles in one geofence check (up to 1,000 points)</li>
      </UL>
    </>
  ),

  "maps-sdk": ({ origin }) => (
    <>
      <P>
        Naksha maps are standard MapLibre style JSON, so any MapLibre SDK can show them. Create a <b>Browser</b> key in the{" "}
        <A href="/console/keys/new">console</A> with your site's origin, then point the SDK at the style URL:
      </P>
      <Code title="style URL" code={`${origin}/api/v1/style?theme=light&key=YOUR_BROWSER_KEY`} />
      <P>
        Themes: <C>light</C>, <C>dark</C> and <C>logistics</C> (muted base, bold truck corridors, toll roads and industrial zones
        highlighted). Each style request counts as one map load.
      </P>

      <H2 id="web">Web: plain HTML</H2>
      <Code
        title="index.html"
        code={`<link href="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js"></script>

<div id="map" style="height: 480px"></div>
<script>
  const map = new maplibregl.Map({
    container: "map",
    style: "${origin}/api/v1/style?theme=light&key=YOUR_BROWSER_KEY",
    center: [77.209, 28.6139], // [lon, lat] — Delhi
    zoom: 11,
  });
  map.addControl(new maplibregl.NavigationControl());
</script>`}
      />

      <H2 id="bundler">Web: npm and a bundler</H2>
      <Code title="bash" code="npm install maplibre-gl" />
      <P>
        MapLibre GL JS 6 ships as ES modules and runs tile parsing in a separate module worker. Copy{" "}
        <C>node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs</C> into your public folder (e.g. in a postinstall script) and tell
        MapLibre where it is before creating a map:
      </P>
      <Code
        title="map.js"
        code={`import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

const map = new maplibregl.Map({
  container: "map",
  style: "${origin}/api/v1/style?theme=logistics&key=YOUR_BROWSER_KEY",
  center: [77.209, 28.6139],
  zoom: 11,
});`}
      />

      <H2 id="react">React</H2>
      <Code title="bash" code="npm install @vis.gl/react-maplibre maplibre-gl" />
      <Code
        title="DeliveryMap.jsx"
        code={`import { Map, Marker, NavigationControl } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

export default function DeliveryMap({ stops }) {
  return (
    <Map
      initialViewState={{ longitude: 77.209, latitude: 28.6139, zoom: 11 }}
      style={{ width: "100%", height: 480 }}
      mapStyle="${origin}/api/v1/style?theme=light&key=YOUR_BROWSER_KEY"
    >
      <NavigationControl position="top-right" />
      {stops.map((s) => (
        <Marker key={s.id} longitude={s.lon} latitude={s.lat} />
      ))}
    </Map>
  );
}`}
      />

      <H2 id="route">Drawing a route</H2>
      <P>Route geometry is plain GeoJSON, so add it as a source:</P>
      <Code
        title="js"
        code={`const res = await fetch("/your-backend/route"); // your server calls /api/v1/route with its server key
const { routes } = await res.json();

map.addSource("route", { type: "geojson", data: { type: "Feature", geometry: routes[0].geometry } });
map.addLayer({
  id: "route",
  type: "line",
  source: "route",
  layout: { "line-cap": "round", "line-join": "round" },
  paint: { "line-color": "#14b8a6", "line-width": 6 },
});`}
      />

      <H2 id="android">Android</H2>
      <Code title="build.gradle.kts" code={`dependencies {\n    implementation("org.maplibre.gl:android-sdk:13.7.1")\n}`} />
      <Code
        title="MainActivity.kt"
        code={`class MainActivity : AppCompatActivity() {
    private lateinit var mapView: MapView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MapLibre.getInstance(this)
        setContentView(R.layout.activity_main)
        mapView = findViewById(R.id.mapView)
        mapView.onCreate(savedInstanceState)
        mapView.getMapAsync { map ->
            map.setStyle("${origin}/api/v1/style?theme=light&key=YOUR_KEY")
            map.cameraPosition = CameraPosition.Builder()
                .target(LatLng(28.6139, 77.209)).zoom(11.0).build()
        }
    }
    // Forward onStart/onResume/onPause/onStop/onDestroy to mapView as usual.
}`}
      />

      <H2 id="ios">iOS</H2>
      <P>
        Add the Swift package <C>https://github.com/maplibre/maplibre-gl-native-distribution</C> (6.31.0 or later).
      </P>
      <Code
        title="MapViewController.swift"
        code={`import MapLibre
import UIKit

final class MapViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let url = URL(string: "${origin}/api/v1/style?theme=light&key=YOUR_KEY")
        let mapView = MLNMapView(frame: view.bounds, styleURL: url)
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        mapView.setCenter(CLLocationCoordinate2D(latitude: 28.6139, longitude: 77.209), zoomLevel: 11, animated: false)
        view.addSubview(mapView)
    }
}`}
      />
      <Callout tone="info" title="Keys in mobile apps">
        Native apps don't send an <C>Origin</C>, so a browser key won't work there. Use a dedicated server key scoped to{" "}
        <C>maps</C> only, with a daily quota, and rotate it with app releases. Send other API calls through your own backend.
      </Callout>
      <Callout tone="warn" title="Attribution">
        Keep the map's attribution control visible. Map data is © OpenStreetMap contributors under the ODbL.
      </Callout>
    </>
  ),

  "digipin-mappin": ({ origin }) => (
    <>
      <P>
        Indian addresses are often unstructured, like “near Hanuman mandir, gali no. 4”. PIN codes place an address in its
        postal area; two short codes then make the exact spot unambiguous.
      </P>
      <H2 id="digipin">DIGIPIN</H2>
      <P>
        DIGIPIN is India Post's national addressing grid. India's bounding box (lat 2.5–38.5, lon 63.5–99.5) is split into a 4×4
        grid ten times over, giving a 10-character code for a cell of roughly 4 m × 4 m. It is written in groups like{" "}
        <C>39J-49K-P2C8</C>, using only the symbols <C>2–9 C F J K L M P T</C>.
      </P>
      <UL>
        <li>It is deterministic: the same point always gives the same code, with no database involved.</li>
        <li>
          Every Indian result from <C>/geocode</C>, <C>/autocomplete</C>, <C>/reverse</C> and <C>/nearby</C> includes its{" "}
          <C>digipin</C>.
        </li>
        <li>Search accepts a DIGIPIN directly, with or without dashes.</li>
        <li>Encoding and decoding are free.</li>
      </UL>
      <Code title="bash" code={`# encode\ncurl "${origin}/api/v1/digipin?lat=28.6315&lon=77.2167" -H "X-Api-Key: $NAKSHA_KEY"\n\n# decode\ncurl "${origin}/api/v1/digipin?code=39J-49K-P2C8" -H "X-Api-Key: $NAKSHA_KEY"`} />
      <P>
        Our implementation follows India Post's open-source algorithm (Apache-2.0) and is tested against its published examples.
        Store the 10 characters without dashes; show dashes to people.
      </P>
      <Callout tone="tip" title="Checkout tip">
        Ask customers to drop a pin, save its DIGIPIN with the order and show it on the rider's app. A 4 m cell beats a landmark
        description.
      </Callout>

      <H2 id="pincode">PIN codes</H2>
      <P>
        All 19,300 India Post PIN codes and their 1.57 lakh post offices are built in. Use{" "}
        <A href="/docs/api/pincode">/pincode</A> to find the PIN covering a point, look up a PIN, or search by prefix or area
        name, and <A href="/docs/api/pincode-detail">/pincode/{"{code}"}</A> for one PIN with its post offices and boundary.
      </P>
      <Code
        title="bash"
        code={`# which PIN is this delivery point in?
curl "${origin}/api/v1/pincode?lat=28.495&lon=77.0896" -H "X-Api-Key: $NAKSHA_KEY"

# a PIN, its post offices and boundary
curl "${origin}/api/v1/pincode/122002?geometry=1" -H "X-Api-Key: $NAKSHA_KEY"

# PINs for an area name, or starting with 2013
curl "${origin}/api/v1/pincode?q=lajpat%20nagar" -H "X-Api-Key: $NAKSHA_KEY"
curl "${origin}/api/v1/pincode?q=2013" -H "X-Api-Key: $NAKSHA_KEY"`}
      />
      <UL>
        <li>
          Search understands PINs: <C>110001</C> returns that PIN area, <C>2013</C> suggests 201301–201309, and{" "}
          <C>lajpat nagar 110024</C> searches inside that PIN first.
        </li>
        <li>
          Every result from <C>/geocode</C>, <C>/autocomplete</C>, <C>/reverse</C> and <C>/nearby</C> has a <C>pincode</C> and a{" "}
          <C>pincode_source</C>. <C>address.postcode</C> holds the same value; if OpenStreetMap had a different postcode it is kept
          as <C>address.osm_postcode</C>.
        </li>
      </UL>
      <P>A point is matched to a PIN in this order, and the response says which method was used:</P>
      <Table
        head={["method", "confidence", "how"]}
        rows={[
          ["boundary", "high", "Inside the official India Post PIN boundary"],
          ["address", "medium", "Postcode on the nearest OpenStreetMap address, if it is a real PIN within 15 km"],
          ["nearest_post_office", "medium (within 3 km) / low", "PIN of the nearest post office"],
        ]}
      />
      <Callout tone="info" title="Boundaries">
        Official boundaries are loaded for Delhi NCR where open data exists. For complete national coverage, download India
        Post&apos;s &ldquo;All India Pincode Boundary&rdquo; GeoJSON from data.gov.in and run{" "}
        <C>npm run data:pincodes -- --boundaries=./All_India_pincode_Boundary.geojson</C>. PIN data © Department of Posts,
        Government of India, under the Government Open Data Licence – India.
      </Callout>
      <H2 id="mappin">MapPIN</H2>
      <P>
        A MapPIN is a 6-character code for a place <i>you</i> save: a warehouse, dark store, customer gate or loading dock. Create
        one with <A href="/docs/api/places-create">POST /api/v1/places</A>:
      </P>
      <Code
        title="bash"
        code={`curl -X POST "${origin}/api/v1/places" -H "X-Api-Key: $NAKSHA_KEY" -H "Content-Type: application/json" \\
  -d '{"name":"Okhla DC-1","lat":28.5355,"lon":77.271,"category":"warehouse"}'`}
      />
      <UL>
        <li>MapPINs use no 0/O/1/I, so they survive being read out over the phone.</li>
        <li>They are private to your organisation. Other customers can't resolve them.</li>
        <li>
          They work anywhere search does: typing <C>KAE35N</C> into autocomplete returns the place first.
        </li>
        <li>Your saved places are matched by name ahead of OpenStreetMap results, so “okhla dc” finds your hub.</li>
      </UL>
    </>
  ),

  "logistics-recipes": ({ origin }) => (
    <>
      <P>End-to-end patterns built from the APIs. Each step links to its reference page, where you can try it live.</P>

      <H2 id="dispatch">Dispatch: assign and sequence deliveries</H2>
      <OL>
        <li>
          Geocode new orders once with <A href="/docs/api/geocode">/geocode</A> and store the coordinates and DIGIPIN.
        </li>
        <li>
          Build travel times between riders and orders with one <A href="/docs/api/matrix">/matrix</A> call (sources = riders,
          targets = orders). Assign each order to the rider with the lowest time, or feed the matrix into your own assignment
          logic.
        </li>
        <li>
          For each rider, sequence their stops with <A href="/docs/api/optimize">/optimize</A> using the <C>bike</C> or{" "}
          <C>scooter</C> profile. The first location is the rider's position; the last is fixed too, so put the return-to-hub stop
          last.
        </li>
        <li>
          Send the reordered stops to <A href="/docs/api/route">/route</A> for turn-by-turn steps and an ETA per leg.
        </li>
      </OL>
      <Code
        title="js"
        code={`// 1 rider, 5 drops: get the best order, then the route in that order
const stops = [rider, ...drops, hub];
const opt = await naksha("${origin}/api/v1/optimize", post({ locations: stops, profile: "scooter" }));
const ordered = opt.order.map((i) => stops[i]);
const eta = opt.route.legs.reduce((acc, leg, i) => {
  acc.push((acc[i - 1] || 0) + leg.duration_s);
  return acc;
}, []);`}
      />
      <Callout tone="info">
        Fleet-wide planning with capacities and time windows (<C>vehicles</C> + <C>jobs</C>) runs on the self-hosted optimiser.
        Ask us to enable it for your account.
      </Callout>

      <H2 id="service-area">Service areas for dark stores and hubs</H2>
      <P>
        Call <A href="/docs/api/isochrone">/isochrone</A> with <C>minutes: [10, 20, 30]</C> from each store. Store the polygons and
        check new customer locations against them before promising a delivery slot. Re-run it when you add stores.
      </P>
      <Code
        title="json"
        code={`POST /api/v1/isochrone
{ "location": { "lat": 28.5355, "lon": 77.271 }, "minutes": [10, 20, 30], "profile": "scooter" }`}
      />

      <H2 id="hub-arrival">Hub arrival and departure alerts</H2>
      <OL>
        <li>
          Create a circle fence around each hub once: <A href="/docs/api/geofences-create">POST /geofences</A> with{" "}
          <C>center</C> and <C>radius_m: 300</C>.
        </li>
        <li>
          Every minute, send the latest position of every vehicle in one <A href="/docs/api/geofences-check">/geofences/check</A>{" "}
          call (up to 1,000 points).
        </li>
        <li>
          Compare each vehicle's <C>inside</C> list with the previous one in your own store: a new id means arrived, a missing id
          means departed.
        </li>
      </OL>

      <H2 id="trip-audit">Trip audits and distance billing</H2>
      <P>
        At the end of a trip, send the GPS trace to <A href="/docs/api/snap">/snap</A>. The matched <C>distance_m</C> is far more
        reliable than adding up raw GPS jumps, and the matched geometry shows the road actually driven. Include each point's{" "}
        <C>time</C> (epoch seconds) for better matching. Traces are not stored.
      </P>

      <H2 id="trucks">Truck routing</H2>
      <P>
        Pass the vehicle's real dimensions on every <A href="/docs/api/route">/route</A>, <A href="/docs/api/matrix">/matrix</A> and{" "}
        <A href="/docs/api/optimize">/optimize</A> call so low bridges and weight-restricted roads are avoided:
      </P>
      <Code title="json" code={`"profile": "truck",\n"truck": { "weight_t": 16, "height_m": 4.0, "width_m": 2.5, "length_m": 9, "axle_load_t": 9, "hazmat": false }`} />
      <P>
        Add <C>depart_at</C> for night runs and <C>avoid: ["tolls"]</C> when the client doesn't reimburse tolls. A{" "}
        <C>422 no_route</C> means no legal path exists for those dimensions.
      </P>
    </>
  ),

  coverage: () => (
    <>
      <H2 id="where">Where it works</H2>
      <Table
        head={["Phase", "Area", "Status"]}
        codeFirst={false}
        rows={[
          ["1", "Delhi NCR: Delhi, Gurugram, Noida, Ghaziabad, Faridabad", "Live"],
          ["2", "All of India: 28 states and 8 union territories", "Next"],
          ["3", "International, starting with SAARC and GCC countries", "Planned"],
        ]}
      />
      <P>
        Routing and search work beyond NCR today, but quality is tuned and checked for NCR first. DIGIPIN works anywhere inside
        India's grid.
      </P>
      <H2 id="sources">Data sources</H2>
      <UL>
        <li>
          <b>OpenStreetMap</b>: roads, places, points of interest, buildings. Rebuilt from fresh extracts on a regular
          schedule.
        </li>
        <li>
          <b>DIGIPIN</b>: India Post's open addressing grid (Apache-2.0).
        </li>
        <li>
          <b>Your saved places</b>: kept separate from map data and private to your organisation.
        </li>
      </UL>
      <H2 id="attribution">Attribution</H2>
      <P>
        Map data is © OpenStreetMap contributors and available under the Open Database License. Anywhere you show our map or data,
        keep a visible credit: “© OpenStreetMap contributors”, linked to{" "}
        <A href="https://www.openstreetmap.org/copyright">openstreetmap.org/copyright</A>. The MapLibre attribution control does this
        for you. You may collapse it behind an “i” button.
      </P>
      <H2 id="privacy">Privacy</H2>
      <UL>
        <li>GPS traces sent to /snap are processed and not stored.</li>
        <li>Request logs (path, status, latency, key) are kept for 14 days for debugging and billing.</li>
        <li>Enterprise customers can run the whole platform in their own network.</li>
      </UL>
    </>
  ),
};

export const GUIDES = GUIDE_META.map((meta) => ({ ...meta, Body: BODIES[meta.slug] }));

export const guideBySlug = (slug) => GUIDES.find((g) => g.slug === slug);
