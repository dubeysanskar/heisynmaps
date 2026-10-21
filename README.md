# Naksha Maps

Our own map platform and **maps API for logistics**: a Mappls / Google Maps Platform style product built on OpenStreetMap and open-source engines we host ourselves. It launches in **Delhi NCR**, then expands to all of India, then internationally.

- **Consumer map** at `/maps`: search, place cards with DIGIPIN, car/bike/scooter/truck/walk directions, multi-stop routing with "optimise order", right-click "what's here", reachability isochrones, light/dark/logistics themes, 3D buildings.
- **Developer API** at `/api/v1/*`: map styles and tiles, autocomplete, geocode, reverse, nearby, truck routing, distance matrix, isochrones, route optimisation (TSP, and VRP via VROOM), snap-to-road, DIGIPIN, MapPIN saved places, geofences.
- **Developer console** at `/console`: overview, API key creation and management (server/browser keys, website or IP restrictions, per-API scopes, per-key rate limit, daily quota, expiry, rotate, disable, delete), usage by API and by key, 14-day request logs, a live API playground, org settings.
- **Admin dashboard** at `/admin` (platform staff): KPIs and revenue estimate, organisations (plan, suspend, rate/quota overrides), users and roles, every API key, per-API switches and prices, global request logs, engine health, audit log.
- **Docs** at `/docs`: quickstart, 8 guides (auth, errors, limits, SDKs, DIGIPIN, logistics recipes, coverage) and a reference page per endpoint with code samples in four languages and a live "Try it".

Read **[docs/PRD.md](docs/PRD.md)** first. It covers the research, the stack decisions, compliance (India boundary, ODbL), pricing and the roadmap.

## Stack

| Layer | Tech |
|---|---|
| App, API gateway, console | Next.js 16 (JavaScript, App Router), Tailwind 4 |
| Map rendering | MapLibre GL JS 6 with our own style generator ([src/lib/style.js](src/lib/style.js)) |
| Vector tiles | Planetiler → PMTiles (OpenMapTiles schema), served by the app or a CDN |
| Routing | Valhalla: route, matrix, isochrone, optimized_route, trace_route |
| Fleet optimisation | VROOM on top of Valhalla |
| Search | Photon 1.x with the prebuilt India index |
| Addressing | DIGIPIN (India Post's algorithm, checked against its published examples) and MapPIN |
| Database | SQLite locally (better-sqlite3), Postgres via `DATABASE_URL` |

## Independent by design

Naksha runs its own engines. With `npm run setup` done, `GET /api/v1/status` reports `"independent": true`: no request touches a third-party service.

| Capability | Engine (ours) | Built by |
|---|---|---|
| Search, autocomplete, reverse, nearby | Built-in SQLite index (FTS5 + trigram typo tolerance + R*Tree), 18.4 lakh Indian places, runs inside the app | `npm run data:search` |
| Map tiles | PMTiles built with Planetiler from OpenStreetMap, served by the app | `npm run data:tiles` |
| Map fonts | Noto Sans (OFL) in `public/fonts` | `npm run data:fonts` |
| PIN codes | India Post directory + boundaries in the database | `npm run data:pincodes` |
| Routing, matrix, isochrones, optimisation, snap | Valhalla (`pyvalhalla` on Windows/macOS, Docker on Linux) | `npm run engine:routing:build` → `npm run engine:routing` |
| Fleet VRP (optional) | VROOM (Docker) | `infra/docker-compose.yml` |

The only outside contact is the **one-time data download** (OpenStreetMap extracts from Geofabrik, the OSM place export, India Post data, fonts), after which everything works offline. Set `REQUIRE_SELF_HOSTED=1` in production so a missing engine fails loudly instead of silently using a public demo server.

```bash
pip install pyvalhalla==3.9.1     # routing engine (no Docker needed)
npm run setup                     # downloads open data once, builds every engine (NCR); --region=india for all India
npm run engine:routing            # terminal 1: routing on :8002
npm run dev                       # terminal 2: the app
```

Keep `NAKSHA_DATA_DIR` outside OneDrive/Dropbox (multi-GB). See `.env.example`.

Delhi NCR spans two Geofabrik extracts: the Northern Zone (Delhi, Haryana) and the Central Zone (Noida, Ghaziabad and Greater Noida in Uttar Pradesh). `npm run setup` downloads both and merges them with `scripts/data/merge_osm.py` (needs `pip install osmium`), a streaming merge that keeps memory flat. Using only the Northern Zone leaves the UP half of NCR without roads.

## Run it locally

```bash
npm install
npm run data:pincodes  # one-time: India Post PIN codes (19,299 PINs, 1.57 lakh post offices) + NCR boundaries
npm run dev            # http://localhost:3000
npm run smoke          # in a second terminal: end-to-end test of every API endpoint
```

No Docker is needed on a laptop. When `VALHALLA_URL`, `PHOTON_URL` or the PMTiles file are missing, the gateway uses public demo services: valhalla1.openstreetmap.de, photon.komoot.io and OpenFreeMap tiles. **These are for development only.** `GET /api/v1/status` shows which engines are self-hosted.

**Admin access:** the first account created on a fresh database becomes the platform admin. Promote others with `npm run make-admin -- someone@company.com` or list them in `ADMIN_EMAILS`.

Dev mode is slow on a OneDrive-synced folder (each page compiles on first visit). For a fast local run use `npm run preview` (production build + start).

To get an API key, open `/console`, sign up and create a key. Then:

```bash
curl -X POST http://localhost:3000/api/v1/route \
  -H "X-Api-Key: nk_sk_..." -H "Content-Type: application/json" \
  -d '{"locations":[{"lat":28.5355,"lon":77.271},{"lat":28.4595,"lon":77.0266}],"profile":"truck","truck":{"weight_t":12,"height_m":3.8}}'
```

## Self-host the engines (production)

On a Linux server in an Indian region (8 vCPU / 32 GB for all of India; 4 vCPU / 16 GB is enough for NCR):

```bash
cd infra && cp .env.example .env    # set POSTGRES_PASSWORD
docker compose up -d                # Valhalla builds routing tiles, Photon downloads the India index
cd .. && scripts/data/build-tiles.sh ncr   # → data/tiles/region.pmtiles (use `india` for phase 2)
```

Then set these in the app's environment:

```
VALHALLA_URL=http://127.0.0.1:8002
PHOTON_URL=http://127.0.0.1:2322
VROOM_URL=http://127.0.0.1:3000
DATABASE_URL=postgres://naksha:...@127.0.0.1:5432/naksha
NAKSHA_SECRET=...
REQUIRE_SELF_HOSTED=1
```

Finally run `npm run build && npm start` behind nginx or Caddy. Put `/api/v1/tiles/*` behind a CDN.

## Project layout

```
docs/PRD.md                     product requirements and research
src/app/maps                    consumer map explorer
src/app/docs, pricing, console  developer-facing pages
src/app/api/v1/*                public API (each route wraps lib/gateway.js)
src/app/api/auth, api/console   session auth, key management, usage
src/app/console, admin          customer console and staff admin (server pages + client components)
src/lib/gateway.js              auth (key or console session), scopes, origin/IP checks, admin API switches,
                                rate limits, quotas, metering, request log, CORS, errors
src/lib/keys.js                 key create/update/rotate/revoke and the cached key lookup
src/lib/console.js, admin.js    read models for the two dashboards
src/lib/settings.js             admin-editable settings (per-API on/off and prices)
src/lib/engines/                valhalla.js, photon.js, tiles.js (PMTiles)
src/lib/catalog.js              plans, SKUs, prices and endpoint docs (one source of truth)
src/lib/style.js                MapLibre style generator (light, dark, logistics)
src/lib/digipin.js              DIGIPIN encode/decode
src/lib/db.js                   SQLite/Postgres adapter and schema
infra/                          docker compose for Valhalla, Photon, VROOM, PostGIS
scripts/setup.mjs               one-command independent setup (downloads + builds every engine)
scripts/data/build-search-index.mjs   our search index from the OSM place export
scripts/data/build-tiles.mjs    Planetiler → PMTiles (portable Java; "lite" mode for inland regions)
scripts/data/install-fonts.mjs  map fonts into public/fonts
scripts/engines/routing.mjs     build / run Valhalla natively via pyvalhalla
scripts/smoke-test.mjs          end-to-end API check
```

## Before a public launch

These items come from PRD §7 and §11:

- [ ] **Official India boundary.** Get Survey of India boundary data and put it at `public/data/india-boundary.geojson`; the style picks it up automatically. Get a legal sign-off.
- [ ] Self-host every engine and set `REQUIRE_SELF_HOSTED=1`.
- [ ] Self-host fonts (`GLYPHS_URL`) and put tiles on a CDN.
- [ ] Billing (Razorpay) on top of `usage_daily`.
- [ ] Search quality: an alias layer (Gurgaon/Gurugram, run-together names), and an evaluation of Pelias.
- [ ] Load the official all-India PIN boundary file (see "PIN codes" above) so every PIN lookup is boundary-exact.

### PIN codes

`npm run data:pincodes` loads India Post's All India Pincode Directory (from data.gov.in, or the official API when `DATA_GOV_IN_API_KEY` is set) and open PIN boundaries for Delhi NCR. Search, reverse geocoding and nearby results then carry a `pincode`, and `/api/v1/pincode` resolves points, codes, prefixes and area names. Points are matched by official boundary where loaded, then the address postcode, then the nearest post office (the response says which).

Delhi's open boundary file is incomplete (27 of 97 PINs). For exact national coverage, download India Post's "All India Pincode Boundary" GeoJSON from data.gov.in (free login) and run:

```bash
npm run data:pincodes -- --boundaries=./All_India_pincode_Boundary.geojson
```

Map data © OpenStreetMap contributors (ODbL). DIGIPIN © India Post (Apache-2.0). PIN code data © Department of Posts, Government of India (Government Open Data Licence – India).
