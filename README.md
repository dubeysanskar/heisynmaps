# HeisynMaps

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
| Search | Our own index (SQLite FTS5 + trigram + R*Tree), built from OpenStreetMap by our scripts |
| Addressing | DIGIPIN (India Post's algorithm, checked against its published examples) and MapPIN |
| Database | SQLite locally (better-sqlite3), Postgres via `DATABASE_URL` |

## Independent by design

HeisynMaps runs only its own engines. There is **no code path to any third-party service**: if an engine is missing, its API returns `503 engine_not_configured` instead of quietly using someone else's server. `GET /api/v1/status` reports `"independent": true` and lists any `not_configured` engines.

| Capability | Engine (ours) | Built by |
|---|---|---|
| Search, autocomplete, reverse, nearby | Our SQLite index (FTS5 + trigram typo tolerance + R*Tree), inside the app | `npm run data:search:osm` (from OSM, by us) |
| Map tiles | PMTiles built with Planetiler from OpenStreetMap, served by the app | `npm run data:tiles` |
| Map fonts | Noto Sans (OFL) in `public/fonts` | `npm run data:fonts` |
| PIN codes | India Post directory + boundaries in our database | `npm run data:pincodes` |
| Routing, matrix, isochrones, optimisation, snap | Valhalla (`pyvalhalla` on Windows/macOS, Docker on Linux) | `npm run engine:routing:build` → `npm run engine:routing` |
| Fleet VRP (optional) | VROOM (Docker) | `infra/docker-compose.yml` |

### Where the data comes from, and why nobody can stop us

All data is open data we may keep and use permanently (ODbL, GODL-India, OFL). `scripts/data/sources.mjs` lists several sources per dataset, **non-profit and government first, companies only as backup**, and every download is kept in our own archive (`$HEISYN_DATA_DIR/archive`, with SHA-256 checksums in `manifest.json`). If every source disappeared tomorrow, `npm run setup -- --offline` rebuilds everything from the archive.

| Dataset | Primary source | Backup | Licence |
|---|---|---|---|
| OpenStreetMap (NCR) | OpenStreetMap France, non-profit: Delhi, Haryana and Uttar Pradesh files (checksum-verified) | Geofabrik zones | ODbL |
| OpenStreetMap (India) | OpenStreetMap France `india.osm.pbf` | Geofabrik | ODbL |
| PIN codes | India Post via data.gov.in API (`DATA_GOV_IN_API_KEY`) | Public export of the same directory | GODL-India |
| Fonts | OpenMapTiles font pack (Noto Sans) | our archive | OFL |
| Search | **Built by us** from the OSM file above | optional place export (`--search=export`) | ODbL |

OpenStreetMap is not a company: it is a public database run by a non-profit foundation, and its licence is irrevocable, so data we hold stays usable even if its servers go away. We depend on no one's service; we only refresh our copy when we choose to.

```bash
pip install pyvalhalla==3.9.1 osmium   # routing engine + OSM tools (no Docker needed)
npm run setup                          # fetch open data, build every engine (NCR); --region=india for all India
npm run engine:routing                 # terminal 1: routing on :8002
npm run dev                            # terminal 2: the app
```

Keep `HEISYN_DATA_DIR` outside OneDrive/Dropbox (multi-GB). See `.env.example`.

Delhi NCR spans several OSM extracts (Delhi, Haryana, Uttar Pradesh). Setup merges them with `scripts/data/merge_osm.py`, a streaming merge that keeps memory flat.

## Run it locally

```bash
npm install
npm run setup          # one-time: builds every engine from open data (see above)
npm run dev            # http://localhost:3000
npm run smoke          # in a second terminal: end-to-end test of every API endpoint
```

No Docker is needed on a laptop. Until `npm run setup` has run, map, search and routing calls return `503 engine_not_configured`; they never fall back to outside services.

**Admin access:** the first account created on a fresh database becomes the platform admin. Promote others with `npm run make-admin -- someone@company.com` or list them in `ADMIN_EMAILS`.

Dev mode is slow on a OneDrive-synced folder (each page compiles on first visit). For a fast local run use `npm run preview` (production build + start).

To get an API key, open `/console`, sign up and create a key. Then:

```bash
curl -X POST http://localhost:3000/api/v1/route \
  -H "X-Api-Key: hm_sk_..." -H "Content-Type: application/json" \
  -d '{"locations":[{"lat":28.5355,"lon":77.271},{"lat":28.4595,"lon":77.0266}],"profile":"truck","truck":{"weight_t":12,"height_m":3.8}}'
```

## Production

On a Linux server in an Indian region (8 vCPU / 32 GB for all of India; 4 vCPU / 16 GB is enough for NCR):

```bash
pip install osmium                    # OSM tools for setup
npm ci && npm run setup -- --region=india
cd infra && cp .env.example .env      # set POSTGRES_PASSWORD
docker compose up -d                  # Valhalla routing (+ VROOM, Postgres)
```

Then set these in the app's environment:

```
SEARCH_DB_PATH=/srv/heisyn-data/search/search.db
PMTILES_PATH=/srv/heisyn-data/tiles/region.pmtiles
VALHALLA_URL=http://127.0.0.1:8002
VROOM_URL=http://127.0.0.1:3000
DATABASE_URL=postgres://heisyn:...@127.0.0.1:5432/heisyn
HEISYN_SECRET=...
HEISYN_OWN_HOSTS=routing.internal    # only if an engine runs on another of our servers
```

Finally run `npm run build && npm start` behind nginx or Caddy. Put `/api/v1/tiles/*` behind a CDN. Refresh data weekly with `npm run setup -- --refresh`.

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
src/lib/engines/                localsearch.js (our search), valhalla.js, tiles.js (PMTiles), report.js (status)
src/lib/catalog.js              plans, SKUs, prices and endpoint docs (one source of truth)
src/lib/style.js                MapLibre style generator (light, dark, logistics)
src/lib/digipin.js              DIGIPIN encode/decode
src/lib/db.js                   SQLite/Postgres adapter and schema
infra/                          docker compose for Valhalla, Photon, VROOM, PostGIS
scripts/setup.mjs               one-command independent setup (downloads + builds every engine)
scripts/data/sources.mjs        every dataset: sources (non-profit first), archive, checksums, --offline
scripts/data/osm_places.py     extract searchable places from an OSM .pbf (pyosmium)
scripts/data/build-search-from-osm.mjs   our search index from OSM + India Post districts
scripts/data/build-search-index.mjs      SQLite FTS5/trigram/R*Tree index writer
scripts/data/merge_osm.py      streaming merge of regional OSM extracts
scripts/data/build-tiles.mjs    Planetiler → PMTiles (portable Java; "lite" mode for inland regions)
scripts/data/install-fonts.mjs  map fonts into public/fonts
scripts/engines/routing.mjs     build / run Valhalla natively via pyvalhalla
scripts/smoke-test.mjs          end-to-end API check
```

## Before a public launch

These items come from PRD §7 and §11:

- [ ] **Official India boundary.** Get Survey of India boundary data and put it at `public/data/india-boundary.geojson`; the style picks it up automatically. Get a legal sign-off.
- [ ] Run `npm run setup -- --region=india` on the production server and schedule a weekly refresh.
- [ ] Put tiles and fonts behind our CDN.
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
