// Builds HeisynMaps' search index straight from OpenStreetMap data: no third-party export.
//
//   npm run data:search:osm -- --pbf=delhi-ncr.osm.pbf [--out=search.db]
//
// 1. scripts/data/osm_places.py pulls every named place, POI, road and addressed building out of the .pbf
// 2. this script adds the address hierarchy:
//      locality + city  from OSM place points (suburbs, neighbourhoods, villages, towns, cities)
//      district + state from India Post's post-office directory (government data, loaded by
//                       npm run data:pincodes), which has official district names
// 3. build-search-index.mjs turns the result into the SQLite search index
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { getDb } from "../../src/lib/db.js";

try {
  process.loadEnvFile(".env.local");
} catch {}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=") || "true"];
  })
);
const DATA = path.resolve(process.env.HEISYN_DATA_DIR || "data");
const pbf = path.resolve(args.pbf || path.join(DATA, "osm", "delhi-ncr.osm.pbf"));
const out = path.resolve(args.out || process.env.SEARCH_DB_PATH || path.join(DATA, "search", "search.db"));
const work = path.join(DATA, "search", "work");
const raw = path.join(work, "places.raw.jsonl");
const enriched = path.join(work, "places.jsonl");
fs.mkdirSync(work, { recursive: true });

if (!fs.existsSync(pbf)) {
  console.error(`OSM extract not found: ${pbf}`);
  process.exit(1);
}
const started = Date.now();
const python = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");

// ---------- 1. extract ----------
console.log(`Extracting places from ${path.basename(pbf)} …`);
const ex = spawnSync(python, ["scripts/data/osm_places.py", pbf, raw, path.join(work, "index")], { stdio: "inherit" });
if (ex.status !== 0) {
  console.error("Extraction failed. It needs pyosmium: pip install osmium");
  process.exit(ex.status || 1);
}

// ---------- 2. hierarchy ----------
const CELL = 0.05;
const cellKey = (lat, lon) => `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`;
const km = (a, b, c, d) => {
  const r = Math.PI / 180;
  const h = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

function grid() {
  const cells = new Map();
  return {
    add(p) {
      const k = cellKey(p.lat, p.lon);
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(p);
    },
    // weigh(p) > 1 lets important places win from farther away (score = distance / weight).
    nearest(lat, lon, maxKm, skip, weigh = () => 1) {
      const rings = Math.ceil(maxKm / (CELL * 111)) + 1;
      const ci = Math.floor(lat / CELL);
      const cj = Math.floor(lon / CELL);
      let best = null;
      for (let i = ci - rings; i <= ci + rings; i++) {
        for (let j = cj - rings; j <= cj + rings; j++) {
          for (const p of cells.get(`${i}:${j}`) || []) {
            if (p === skip) continue;
            const d = km(lat, lon, p.lat, p.lon);
            const score = d / weigh(p);
            if (d <= maxKm && (!best || score < best.score)) best = { p, score };
          }
        }
      }
      return best?.p || null;
    },
  };
}

async function* lines(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) if (line) yield JSON.parse(line);
}

const bigCities = grid(); // place=city
const towns = grid(); // town, municipality
const localities = grid();
const byId = new Map();
for await (const r of lines(raw)) {
  if (r.key !== "place") continue;
  const p = { name: r.name, lat: r.lat, lon: r.lon, value: r.value, imp: r.imp };
  byId.set(`${r.t}${r.id}`, p);
  if (r.value === "city") bigCities.add(p);
  else if (["town", "municipality"].includes(r.value)) towns.add(p);
  else if (["suburb", "borough", "quarter", "neighbourhood", "village", "hamlet"].includes(r.value)) localities.add(p);
}

const offices = grid();
try {
  const db = await getDb();
  for (const o of await db.all("SELECT district, state, lat, lon FROM pincode_offices WHERE lat IS NOT NULL")) {
    offices.add({ district: o.district, state: o.state, lat: Number(o.lat), lon: Number(o.lon) });
  }
} catch {
  console.warn("No PIN code data found; districts and states will be missing. Run npm run data:pincodes first.");
}

console.log("Adding address hierarchy …");
const outStream = fs.createWriteStream(enriched, { encoding: "utf8" });
let n = 0;
for await (const r of lines(raw)) {
  const self = byId.get(`${r.t}${r.id}`);
  const isCity = r.key === "place" && ["city", "town", "municipality", "state", "district", "county"].includes(r.value);
  const locality = r.addr_suburb || (isCity ? null : localities.nearest(r.lat, r.lon, 2.5, self)?.name) || null;
  // A real city within 25 km beats a nearer small town ("Kirti Nagar" is in Delhi, not Delhi Cantonment).
  const city =
    r.addr_city ||
    (isCity
      ? null
      : (bigCities.nearest(r.lat, r.lon, 25, self, (p) => (1 + p.imp * 3) ** 2) ||
          towns.nearest(r.lat, r.lon, 10, self) ||
          localities.nearest(r.lat, r.lon, 3, self))?.name) ||
    null;
  const office = offices.nearest(r.lat, r.lon, 40);
  const name = { name: r.name };
  for (const [k, v] of Object.entries(r.names || {})) name[k === "local" ? "loc_name" : k] = v;
  const [w, s, e, nth] = r.bbox;
  const doc = {
    place_id: String(++n),
    object_type: r.t,
    object_id: r.id,
    osm_key: r.key,
    osm_value: r.value,
    categories: [`osm.${r.key}.${r.value}`],
    address_type: r.kind,
    importance: r.imp,
    name,
    address: {
      street: r.street || undefined,
      suburb: locality || undefined,
      city: city || undefined,
      county: office?.district || undefined,
      state: office?.state || undefined,
    },
    housenumber: r.hn || undefined,
    postcode: r.postcode || undefined,
    country_code: "in",
    centroid: [r.lon, r.lat],
    bbox: [w, nth, e, s], // export order: [west, north, east, south]
  };
  if (!outStream.write(JSON.stringify({ type: "Place", content: [doc] }) + "\n")) {
    await new Promise((res) => outStream.once("drain", res));
  }
}
await new Promise((res) => outStream.end(res));
console.log(`Prepared ${n.toLocaleString()} places`);

// ---------- 3. index ----------
const build = spawnSync(process.execPath, ["scripts/data/build-search-index.mjs", `--dump=${enriched}`, `--out=${out}`], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status || 1);
fs.rmSync(path.join(work, "index"), { recursive: true, force: true });
console.log(`Search index built from OpenStreetMap in ${Math.round((Date.now() - started) / 1000)} s → ${out}`);
process.exit(0);
