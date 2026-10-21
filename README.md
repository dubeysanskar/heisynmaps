# Naksha Maps

Our own map platform and **maps API for logistics**: a Mappls / Google Maps Platform style product built on OpenStreetMap and open-source engines we host ourselves. It launches in **Delhi NCR**, then expands to all of India, then internationally.

- **Consumer map** at `/maps`: search, place cards with DIGIPIN, car/bike/scooter/truck/walk directions, multi-stop routing with "optimise order", right-click "what's here", reachability isochrones, light/dark/logistics themes, 3D buildings.
- **Developer API** at `/api/v1/*`: map styles and tiles, autocomplete, geocode, reverse, nearby, truck routing, distance matrix, isochrones, route optimisation (TSP, and VRP via VROOM), snap-to-road, DIGIPIN, MapPIN saved places, geofences.
- **SaaS layer**: signup, server and browser API keys (origin-locked), per-key rate limits, per-SKU daily metering, usage console, pricing and docs.

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

## Run it locally

```bash
npm install
npm run dev            # http://localhost:3000
npm run smoke          # in a second terminal: end-to-end test of every API endpoint
```

No Docker is needed on a laptop. When `VALHALLA_URL`, `PHOTON_URL` or the PMTiles file are missing, the gateway uses public demo services: valhalla1.openstreetmap.de, photon.komoot.io and OpenFreeMap tiles. **These are for development only.** `GET /api/v1/status` shows which engines are self-hosted.

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
src/lib/gateway.js              key auth, origin checks, rate limits, metering, CORS, errors
src/lib/engines/                valhalla.js, photon.js, tiles.js (PMTiles)
src/lib/catalog.js              plans, SKUs, prices and endpoint docs (one source of truth)
src/lib/style.js                MapLibre style generator (light, dark, logistics)
src/lib/digipin.js              DIGIPIN encode/decode
src/lib/db.js                   SQLite/Postgres adapter and schema
infra/                          docker compose for Valhalla, Photon, VROOM, PostGIS
scripts/data/build-tiles.sh     Planetiler → PMTiles
scripts/smoke-test.mjs          end-to-end API check
```

## Before a public launch

These items come from PRD §7 and §11:

- [ ] **Official India boundary.** Get Survey of India boundary data and put it at `public/data/india-boundary.geojson`; the style picks it up automatically. Get a legal sign-off.
- [ ] Self-host every engine and set `REQUIRE_SELF_HOSTED=1`.
- [ ] Self-host fonts (`GLYPHS_URL`) and put tiles on a CDN.
- [ ] Billing (Razorpay) on top of `usage_daily`.
- [ ] Search quality: an alias layer (Gurgaon/Gurugram, run-together names), and an evaluation of Pelias.

Map data © OpenStreetMap contributors (ODbL). DIGIPIN © India Post (Apache-2.0).
