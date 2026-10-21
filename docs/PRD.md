# HeisynMaps — Product Requirements Document (PRD)

> Product name: **HeisynMaps** (repo: github.com/dubeysanskar/heisynmaps). Brand strings live in `src/lib/brand.js`.
> Status: v0.1 — 21 Oct 2026. Owner: dubeysanskar.
> Scope: our own map platform plus API SaaS for logistics companies. It competes with Mappls (MapmyIndia), Google Maps Platform, Ola Maps and Delhivery Maps. Rollout order: **Delhi NCR → all of India → international.**

---

## 1. Problem and opportunity

Indian logistics companies (3PLs, quick-commerce, e-commerce last-mile, trucking, field-force) pay heavily for maps and get poor answers on three fronts:

- **Addresses.** Indian addresses are unstructured ("near Hanuman mandir, gali no. 4"), and OSM/Google house-number coverage is sparse.
- **Truck-aware routing.** Height, weight and time-of-day restrictions such as Delhi's no-entry windows for heavy vehicles are rarely modelled.
- **Cost at scale.** Distance-matrix and routing calls grow with fleet size × stops².

| Provider | Model | Indicative price (per 1,000) | Notes |
|---|---|---|---|
| Google Maps (India pricing, since Aug 2024) | Free cap per SKU: 70k Essentials / 35k Pro | Dynamic Maps $2.10, Geocoding $1.50, Autocomplete $0.85, Routes/Matrix Essentials $1.50, Pro $3.00 | India pricing needs India billing and mostly-India usage. Global prices are about 3.3× higher (Dynamic Maps $7, Geocoding $5). |
| Ola Maps (Krutrim) | 100k free calls per API per month; prepaid credits after that (since 1 Sep 2026) | Geocoding ₹99, Autocomplete ₹56, Directions ₹199, Matrix ₹199/1k pairs, Map load ₹141 | Aggressive on price. |
| Mappls (MapmyIndia) | Sales-led, no public pricing | — | Over 120 APIs. Strong on Indian addresses (Mappls PIN, formerly eLoc), telematics and tracking. |
| Delhivery Maps | New, logistics-native | — | Built on Delhivery fleet telemetry. The closest competitor in positioning. |

**Our wedge:** an open-data, self-hosted stack, so our marginal cost per call is close to zero. That lets us:

1. Undercut Ola and Google India on price.
2. Ship logistics-first features (truck routing, matrix, VRP, geofencing, map-matching) as core SKUs, not add-ons.
3. Make India addressing first-class (DIGIPIN plus our own short place codes).
4. Offer **on-prem / VPC deployment.** Enterprises and government (data residency under the Geospatial Guidelines 2021) cannot send fleet data to Google.

## 2. Goals and non-goals

### Goals (v1, Delhi NCR)
- G1. A full-screen consumer map at `/maps` with search, place details, directions, reachability and right-click "what's here" (DIGIPIN).
- G2. A developer API with key management, metering, rate limits and docs, sold per 1,000 calls.
- G3. Logistics endpoints: truck routing, distance matrix, isochrones, stop optimisation, map-matching (snap-to-road) and geofence checks.
- G4. Fully self-hostable. No proprietary map dependency in production.
- G5. Compliance: OSM attribution, India's official boundary depiction and in-India data residency.

### Non-goals (v1)
- Turn-by-turn mobile navigation SDK (Phase 3).
- Live traffic (needs probe data from customer fleets; Phase 3).
- Street-level imagery (allowed for Indian entities, but capex-heavy).
- Satellite basemap (licensing cost; Phase 3 via a commercial imagery partner).

## 3. Target users and core jobs

| Persona | Job to be done | Key endpoints |
|---|---|---|
| Last-mile dispatcher (quick-commerce, courier) | Sequence 20–60 drops per rider, estimate ETAs | `/optimize`, `/matrix`, `/route` (motorcycle, scooter) |
| Trucking / FTL ops | Legal truck routes and accurate transit time | `/route` with truck costing (weight, height, axle load, hazmat) |
| Fleet / telematics product | Clean GPS traces, detect entering and leaving hubs | `/snap`, `/geofences/check` |
| Checkout / onboarding | Capture an address that a rider can actually find | `/autocomplete`, `/geocode`, `/reverse`, `/digipin`, `/places` |
| Planning / network design | Service areas, how many hubs are needed | `/isochrone`, `/matrix` |
| App developer | Embed a branded map | `/style` + MapLibre |

## 4. Research summary: how to build your own map

A modern map platform has five independent layers. Each one is solved by a mature open-source engine, and all of them consume the same **OpenStreetMap** data.

| Layer | What it does | Chosen tech | Why chosen | Alternatives considered |
|---|---|---|---|---|
| **Data** | Roads, POIs, buildings, admin areas | **OpenStreetMap** (Geofabrik India extracts, updated daily). Enrichment: **Google Open Buildings** (CC-BY/ODbL), **Overture Places** (CDLA-Permissive-2.0) | The only global, editable, commercially usable dataset | Paid HERE/TomTom data (costly) |
| **Vector tiles** | Pre-cut map geometry per z/x/y | **Planetiler** (Java; renders all of India in minutes) → **PMTiles**, a single file | One file, served by HTTP range requests; deploys to any disk, S3 or R2 plus a CDN | Martin (Rust) serving PMTiles/PostGIS; OpenMapTiles + Postgres (slow); TileServer-GL |
| **Rendering** | Draws vector tiles in the browser, GPU-accelerated | **MapLibre GL JS** (BSD fork of Mapbox GL v1) | Industry standard, styleable, 3D buildings, a mobile SDK exists | Leaflet (raster only), OpenLayers |
| **Routing** | A→B, matrix, isochrone, TSP, map-matching | **Valhalla** (C++) | Dynamic costing at request time: truck dimensions/weight, motor_scooter, motorcycle, avoid areas, departure time. Ships route, matrix, isochrone, optimized_route, trace_route and locate in one engine | OSRM (fastest, but static profiles: one rebuild per vehicle type); GraphHopper (Java; truck support is paid); openrouteservice |
| **Fleet optimisation (VRP)** | Many vehicles × many jobs, time windows, capacities | **VROOM** with Valhalla as the backend | Solves VRPTW and CVRP in milliseconds to seconds; BSD | OR-Tools (more work), Timefold |
| **Geocoding** | Text → coordinates, autocomplete, reverse | **Photon** (Elastic/OpenSearch, typo-tolerant, prefix autocomplete). India dump: `download1.graphhopper.com/public/asia/india/photon-db-india-1.0-latest.tar.bz2` | Built for search-as-you-type, light to run, prebuilt India index | Nominatim (structured, heavier, weak autocomplete); Pelias (most powerful, heaviest: ES + 5 importers). Pelias is the Phase-2 option if address quality demands it |
| **PIN codes** | Postal area for any point; search by PIN | **India Post All India Pincode Directory** (19,299 PINs, 1.57 lakh post offices with coordinates) + **official PIN boundary GeoJSON** (data.gov.in, GODL-India); in-memory spatial index; boundary → address postcode → nearest post office | Official, free for commercial use with attribution | OSM postcodes (sparse in India; bare numbers collide with other countries, e.g. 110001 in Taipei) |
| **India addressing** | Short, shareable location codes | **DIGIPIN** (India Post, Apache-2.0, a 10-character code for a ~4 m × 4 m cell; launched 27 May 2025) and **MapPIN**, our own 6-character code per saved place (our version of Mappls' eLoc / Mappls PIN) | DIGIPIN is a national standard and is deterministic, so it needs no database lookups | Plus Codes |
| **Product/API layer** | Auth, keys, metering, rate limits, docs, console, the consumer map | **Next.js 16 (JavaScript, App Router)**, Tailwind 4. Database: **SQLite** locally, **Postgres** in production via `DATABASE_URL` (PostGIS from Phase 2) | One deployable app for UI and API gateway; the team's default stack | Separate Go/Node gateway (later, if needed) |

### Why not just OSRM?
OSRM bakes one vehicle profile into a preprocessed graph. Logistics needs per-request truck dimensions, scooters and 2-wheelers (the dominant last-mile vehicle in India), and avoid-polygons. Valhalla handles all of that on a single graph, at roughly 1.5–3× OSRM latency. That is acceptable at this scale. If matrix throughput becomes the bottleneck, add OSRM next to Valhalla for car-only matrices.

### Data sizes and hardware (approximate)

| Region | OSM PBF | PMTiles (z0–14) | Valhalla tiles | Photon index | Suggested server |
|---|---|---|---|---|---|
| Delhi NCR (clipped bbox) | ~60 MB | ~150 MB | ~200 MB | use the India dump | 4 vCPU / 8 GB |
| Northern zone (Geofabrik) | 206 MB | ~500 MB | ~600 MB | — | 4 vCPU / 16 GB |
| All India | ~1.5 GB | ~3 GB | ~4 GB | ~6 GB | 8 vCPU / 32 GB / 100 GB NVMe |
| Planet | ~80 GB | ~120 GB | ~100 GB | ~200 GB | 32 vCPU / 128 GB / 1 TB NVMe |

Builds need Java 21+ (a portable JRE is fine), Python with pyosmium and pyvalhalla, and Node. Docker is optional (production routing). A Windows laptop with 12 GB RAM builds Delhi NCR end to end.

## 5. Functional requirements

### 5.1 Consumer map (`/maps`)
- F1. Full-screen MapLibre map that opens on Delhi NCR (28.6139, 77.2090, z10). Light, dark and "logistics" styles. 3D buildings from z15.
- F2. Search box with debounced autosuggest (≤150 ms server time), biased towards the map centre. Results include the user's org-saved places first.
- F3. Category chips (Petrol pump, EV charging, ATM, Hospital, Restaurant, Parking, Pharmacy, Police) that run a nearby search in the current viewport.
- F4. Place card: name, address, coordinates, **DIGIPIN**, copy and share link, Directions button, "Nearby" button.
- F5. Directions: up to 10 stops, drag-free stop editing, swap, modes **Car, Bike, Scooter, Truck, Walk**. Truck options: weight (t) and height (m). Show alternatives and turn-by-turn steps. An "Optimise order" button appears when there are 3+ stops.
- F6. Right-click menu: What's here (reverse geocode plus DIGIPIN), Directions from here, Directions to here, Reachability (15/30/45 min isochrone).
- F7. Deep links: `/maps?ll=lat,lon&z=` and `/maps?digipin=XXXXXXXXXX`.
- F8. Visible "© OpenStreetMap contributors" attribution, always shown.

### 5.2 Developer platform
- D1. Email and password signup/login. One organisation per user in v1.
- D2. API keys: create, name, revoke. Two types:
  - **server** keys: secret, no origin check.
  - **browser** keys: restricted to allowed origins, safe to embed.
  - Keys are shown once and stored as a SHA-256 hash.
- D3. Auth via `?key=`, `X-Api-Key` or `Authorization: Bearer`.
- D4. Metering per key, per SKU, per day. The console shows the last 30 days and month-to-date against the free tier.
- D5. Rate limit per key per minute by plan. Over the limit returns `429` with `Retry-After`.
- D6. CORS: browser keys get `Access-Control-Allow-Origin` set to the matched origin.
- D7. Docs at `/docs`, generated from one endpoint catalogue (`src/lib/catalog.js`) with curl examples.
- D8. Uniform error envelope: `{ "error": { "code", "message" } }`. All coordinates use **lat/lon in request params, GeoJSON `[lon, lat]` in geometry output**.

### 5.3 API v1 (base `/api/v1`)

| SKU | Method & path | Purpose | Engine |
|---|---|---|---|
| `maps.load` | `GET /style?key=&theme=light\|dark\|logistics` | MapLibre style JSON (one billable map load) | style generator → PMTiles |
| `maps.tiles` | `GET /tiles/{z}/{x}/{y}.pbf?key=` | Vector tiles from local PMTiles | pmtiles |
| `search.autocomplete` | `GET /autocomplete?q=&lat=&lon=&limit=` | Search-as-you-type | Photon + org places |
| `search.geocode` | `GET /geocode?q=` | Forward geocode | Photon + org places |
| `search.reverse` | `GET /reverse?lat=&lon=` | Reverse geocode plus DIGIPIN | Photon |
| `search.nearby` | `GET /nearby?lat=&lon=&category=&radius=` | POIs by category | Photon (`osm_tag` filters) |
| `route.directions` | `POST /route` | Multi-stop routing. Profiles: car, truck, bike (motorcycle), scooter, foot, bicycle. Supports alternatives and truck dimensions | Valhalla `route` |
| `route.matrix` | `POST /matrix` | Duration and distance matrix (≤ 50 × 50 in v1) | Valhalla `sources_to_targets` |
| `route.isochrone` | `POST /isochrone` | Reachability polygons by minutes or km | Valhalla `isochrone` |
| `route.optimize` | `POST /optimize` | Single-vehicle stop sequencing (TSP), or multi-vehicle VRP when `vehicles` and `jobs` are given | Valhalla `optimized_route` / VROOM |
| `route.snap` | `POST /snap` | GPS trace → road-matched path | Valhalla `trace_route` |
| `address.pincode` | `GET /pincode?lat=&lon=` · `?code=` · `?q=`, `GET /pincode/{code}` | PIN covering a point (with method + confidence), PIN details and post offices, prefix / area-name search | India Post data, local |
| `address.digipin` | `GET /digipin?lat=&lon=` or `?code=` | Encode or decode DIGIPIN | local (no network) |
| `places.*` | `GET/POST /places`, `GET/DELETE /places/{mappin}` | The org's private POIs (hubs, warehouses, customers). Each gets a 6-character MapPIN | DB |
| `geofence.*` | `GET/POST /geofences`, `DELETE /geofences/{id}`, `POST /geofences/check` | Polygon or circle fences; point-in-fence checks for up to 1,000 points per call | DB + turf |
| — | `GET /status` | Health of each engine | — |

### 5.4 Pricing (launch hypothesis)

| Plan | Price | Included | Rate limit |
|---|---|---|---|
| Free | ₹0 | 100k calls per SKU per month (matches Ola, beats Google India) | 300 req/min |
| Growth | ₹4,999/mo | 1M calls per SKU, then the overage prices below | 3,000 req/min |
| Enterprise / On-prem | Contract | Unlimited; self-hosted in the customer's VPC, India region, SLA | custom |

Overage per 1,000 calls (about 40–50% under Ola, and well under Google India):

| SKU group | Overage |
|---|---|
| Map loads | ₹60 |
| Autocomplete | ₹25 |
| Geocode / Reverse | ₹40 |
| Directions | ₹80 |
| Matrix | ₹80 per 1,000 elements |
| Optimize | ₹400 |
| Geofence checks | ₹2 |

## 6. Non-functional requirements
- **Latency (p95, NCR):** autocomplete < 150 ms, route < 300 ms, 25 × 25 matrix < 800 ms, tile < 50 ms from the CDN edge.
- **Availability:** 99.9% for the API. Tiles are served from object storage plus a CDN, so they stay up even if the app is down.
- **Security:**
  - Keys are hashed; passwords use scrypt; session cookies are httpOnly, SameSite=Lax.
  - Browser keys are origin-locked.
  - No user PII in logs. GPS traces sent to `/snap` are never stored.
- **Data residency:** all servers in an Indian region (e.g. AWS ap-south-1 Mumbai, or an Indian VPS). This is a requirement for Indian-entity status under the Geospatial Data Guidelines 2021.
- **Freshness:** OSM data rebuilt weekly. A Valhalla and Photon rebuild runs on a cron job.

## 7. Compliance (launch blockers)

1. **India's external boundary.** Under the Criminal Law Amendment Act 1961 s.2, publishing a map of India that does not match Survey of India maps is an offence. OSM draws disputed areas "on the ground" (e.g. the LoC).
   - Requirement: hide OSM `disputed` boundaries and overlay the official SoI external boundary of India (J&K, Ladakh, Arunachal).
   - Source: Survey of India (`indiamaps.gov.in`, `onlinemaps.surveyofindia.gov.in`). DataMeet's GeoJSON mirror can serve as a reference.
   - Confirm the commercial licence with SoI or data.gov.in (GODL) before launch.
   - Implementation hook: `public/data/india-boundary.geojson` is picked up by the style generator automatically (`INDIA_BOUNDARY_GEOJSON`).
2. **ODbL (OpenStreetMap).**
   - Tiles, routes and geocodes are *produced works*: any licence is allowed, but attribution is required.
   - If we publicly ship a *derivative database* (OSM + our edits), it must be offered under ODbL. Keep customer places in a separate *collective* database so share-alike is not triggered.
   - Attribution "© OpenStreetMap contributors" is linked to openstreetmap.org/copyright in the style and in docs.
3. **Geospatial Data Guidelines 2021 / National Geospatial Policy 2022.**
   - Self-certification is enough; no licence is needed.
   - Data finer than 1 m horizontal must be stored and processed in India by an Indian-owned entity. Our company must be Indian-owned and controlled.
   - Do not render items on the "negative list" (sensitive defence installations).
4. **DIGIPIN** is Apache-2.0. We re-implement the published algorithm and credit India Post.

## 8. Data roadmap

| Phase | Coverage | Data work | Exit criteria |
|---|---|---|---|
| **P1: Delhi NCR** (now) | Delhi, Gurugram, Noida, Ghaziabad, Faridabad: bbox `76.84,28.20,77.65,28.90` | Geofabrik `northern-zone` (Delhi, Haryana) + `central-zone` (Noida, Ghaziabad: UP), merged with pyosmium; Planetiler PMTiles clipped to NCR; Valhalla; own search index from the OSM place export | 10 pilot logistics customers; route ETA within ±15% of actuals |
| **P2: All India** | All 28 states and 8 UTs | Full India PBF; SoI boundary overlay; Google Open Buildings import; Overture Places merge; Pelias evaluation for addresses; PostGIS | Address match rate ≥ 85% on a customer sample |
| **P3: International** | SAARC/GCC first (Nepal, Bangladesh, Sri Lanka, UAE, KSA), then planet | Planet PMTiles (or a licensed MapTiler planet); regional Valhalla clusters; multi-region CDN | 99.9% SLA across regions |
| **Moat (ongoing)** | — | Probe data from customer fleets via `/snap` (opt-in): truck no-entry windows, real speeds, gate locations, last-mile "rider notes" at DIGIPIN level | ETAs measurably better than Google for logistics |

## 9. Architecture

```
            ┌───────────── Browser / customer backend ─────────────┐
            │  MapLibre GL  ·  REST calls with API key              │
            └───────────────┬──────────────────────────────────────┘
                            │ HTTPS
       ┌────────────────────▼─────────────────────────────┐
       │  Next.js 16 app                                   │  /maps · /docs · /console · /admin · /api/v1/*
       │  API gateway: keys, scopes, limits, metering      │  SQLite / Postgres: users · orgs · keys · usage
       │  Built-in engines (in-process, no network):       │  places · geofences · PIN codes
       │    · search index (SQLite FTS5 + trigram + R*Tree)│
       │    · vector tiles (PMTiles) · map fonts           │
       │    · PIN codes · DIGIPIN · geofences              │
       └──────────────┬───────────────────────┬───────────┘
                      │                       │
              ┌───────▼───────┐       ┌───────▼───────┐
              │   Valhalla    │       │ VROOM (opt.)  │
              │   :8002       │       │ :3000         │
              └───────────────┘       └───────────────┘
   Everything above is built by us from open data (npm run setup): OpenStreetMap (Geofabrik),
   the OSM place export, India Post PIN data, Noto fonts. Refreshed weekly on the server.
```

**Independence.** At runtime HeisynMaps calls no third-party service: search, tiles, fonts and PIN codes run inside the app, routing runs on our own Valhalla (Docker on Linux, `pyvalhalla` natively on Windows/macOS). `npm run setup` downloads the open data once and builds every engine; `/api/v1/status` returns `"independent": true` and lists any `third_party` engine otherwise.

**No fallbacks.** The code has no path to anyone else's servers. A missing engine answers `503 engine_not_configured`. Data comes from non-profit and government sources first (OpenStreetMap France, data.gov.in), companies only as backup, and every download is archived with checksums so `npm run setup -- --offline` can rebuild everything without any provider (see `scripts/data/sources.mjs`).

## 10. Milestones

| # | Milestone | Contents |
|---|---|---|
| M0 | Done in this repo | PRD; Next.js app; API gateway with keys, metering and rate limits; all v1 endpoints; consumer map; console; docs; docker-compose for engines; NCR data pipeline scripts |
| M1 | NCR self-hosted | Linux VPS (Mumbai) running `infra/docker-compose.yml`, NCR PMTiles, Valhalla, Photon India; Postgres; CDN for tiles |
| M2 | Pilot | 10 logistics design partners; webhook geofence events; usage billing (Razorpay); SoI boundary overlay |
| M3 | All India | India-wide data, Pelias evaluation, Open Buildings, Hindi labels (needs Indic shaping support in MapLibre, which is a known gap), Android/iOS MapLibre SDK samples |
| M4 | Fleet suite | Live tracking (WebSocket), trip replay, ETA sharing links, driver app |
| M5 | International | SAARC/GCC regions, planet tiles, multi-region |

## 11. Risks

| Risk | Mitigation |
|---|---|
| OSM gaps in India (house numbers sparse; minor roads in peri-urban NCR) | DIGIPIN-first UX; customer places; feedback loop of fleet traces; Overture/Open Buildings |
| Search recall for Indian spellings: Photon misses run-together names and renamed cities (e.g. "cyberhub gurgaon" returns nothing, while "cyber hub" works) | Shipped now: retry without the trailing city word inside a box around the user, and rank results within 200 km first. Phase 2: alias table (Gurgaon/Gurugram, Bombay/Mumbai…), n-gram index of customer and OSM names, Pelias evaluation |
| Devanagari and other Indic label shaping in MapLibre is imperfect | English labels in v1; evaluate MapLibre native text shaping and a server-rendered label layer for M3 |
| Boundary depiction law | Launch blocker in §7; legal review before a public launch |
| Valhalla matrix throughput at large fleet sizes | Cap at 50 × 50 in v1; add an OSRM car-matrix sidecar; cache by DIGIPIN cell |
| Competitors' free tiers (Ola 100k/API) | Match the free tier; win on logistics features and on-prem |
| A data provider (mirror, company) stops serving files | Several sources per dataset (non-profit/government first); everything archived with SHA-256; `npm run setup -- --offline` rebuilds without any provider |
| Search quality without third-party exports | Our own OSM extractor + India Post districts; trigram typo tolerance; alias layer planned (Phase 2) |

## 12. Sources
- Google Maps Platform pricing: developers.google.com/maps/billing-and-pricing/pricing and …/india
- Ola Maps pricing: maps.olakrutrim.com/pricing
- Mappls APIs: about.mappls.com/api
- Delhivery Maps: delhivery.com/maps
- Geospatial Data Guidelines 2021 (Trilegal summary); National Geospatial Policy 2022 (PIB)
- Criminal Law Amendment Act 1961 s.2; OSM wiki "Disputed territories"
- DIGIPIN: github.com/INDIAPOST-gov/digipin (Apache-2.0); indiapost.gov.in/digipin
- OSMF Licence/Legal FAQ and Attribution Guidelines
- Overture Maps docs (places/addresses licences); Google Open Buildings; Microsoft Global ML Building Footprints
- Geofabrik India extracts: download.geofabrik.de/asia/india.html
- Photon dumps: download1.graphhopper.com/public/asia/india/
- Planetiler, PMTiles, Martin, MapLibre, Valhalla, VROOM project docs
