// Imports India Post PIN codes into the database (SQLite, or Postgres via DATABASE_URL).
//
//   npm run data:pincodes                       # directory + open NCR boundaries
//   npm run data:pincodes -- --boundaries=all   # open boundaries for every state (partial coverage)
//   npm run data:pincodes -- --boundaries=./All_India_pincode_Boundary.geojson   # official file (complete)
//   npm run data:pincodes -- --csv=./pincode.csv --boundaries=none
//
// Sources (Government Open Data Licence – India; attribute "Department of Posts, Government of India"):
//   Directory: data.gov.in "All India Pincode Directory" (post offices with lat/lon). Uses the official
//              API when DATA_GOV_IN_API_KEY is set, otherwise a public CSV export of the same dataset.
//   Boundaries: the official "All India Pincode Boundary" GeoJSON from data.gov.in (free login), or the
//              simplified per-state split published by bharatviz.org (incomplete for some states, e.g. Delhi).
import fs from "node:fs";
import path from "node:path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { getDb } from "../../src/lib/db.js";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=") || "true"];
  })
);
const CACHE = path.resolve("data/pincodes");
const MIRROR_CSV = "https://raw.githubusercontent.com/dropdevrahul/pincodes-india/main/pincode.csv";
const API_RESOURCE = "5c2f62fe5afa4119a499fec9d604d5bd";
const BHARATVIZ = "https://geo.bharatviz.org/geojsons/pincodes";
const BHARATVIZ_INDEX = "https://raw.githubusercontent.com/saketlab/bharatviz/main/src/lib/pincode-mapping.json";
const NCR_STATES = ["delhi", "haryana", "uttar_pradesh"];
const INDIA = { minLat: 6, maxLat: 37.6, minLon: 68, maxLon: 97.6 };

fs.mkdirSync(CACHE, { recursive: true });

// ---------------- download helpers ----------------

async function download(url, file) {
  if (fs.existsSync(file) && !args.refresh) return file;
  process.stdout.write(`Downloading ${url} … `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log(`${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
  return file;
}

function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  const header = rows.shift().map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

async function loadDirectory() {
  if (args.csv) {
    const file = /^https?:/.test(args.csv) ? await download(args.csv, path.join(CACHE, "directory.csv")) : path.resolve(args.csv);
    return parseCsv(fs.readFileSync(file, "utf8"));
  }
  const key = process.env.DATA_GOV_IN_API_KEY;
  if (key) {
    console.log("Fetching the directory from the data.gov.in API …");
    const out = [];
    for (let offset = 0; ; offset += 1000) {
      const url = `https://api.data.gov.in/resource/${API_RESOURCE}?api-key=${key}&format=json&limit=1000&offset=${offset}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`data.gov.in API → HTTP ${res.status}`);
      const { records = [] } = await res.json();
      out.push(...records.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase().replace(/[^a-z]/g, ""), String(v ?? "").trim()]))));
      process.stdout.write(`\r  ${out.length} offices`);
      if (records.length < 1000) break;
    }
    console.log();
    return out;
  }
  const file = await download(MIRROR_CSV, path.join(CACHE, "directory.csv"));
  return parseCsv(fs.readFileSync(file, "utf8"));
}

async function loadBoundaries() {
  const mode = args.boundaries || "ncr";
  if (mode === "none") return [];
  if (mode !== "ncr" && mode !== "all") {
    console.log(`Reading boundaries from ${mode}`);
    return JSON.parse(fs.readFileSync(path.resolve(mode), "utf8")).features.map((f) => ({ f, source: "india-post-official" }));
  }
  let files = NCR_STATES;
  if (mode === "all") {
    const index = await (await fetch(BHARATVIZ_INDEX)).json();
    files = Object.values(index).map((u) => path.basename(u, ".geojson"));
  }
  const features = [];
  for (const name of files) {
    try {
      const file = await download(`${BHARATVIZ}/${name}.geojson`, path.join(CACHE, `boundary-${name}.geojson`));
      for (const f of JSON.parse(fs.readFileSync(file, "utf8")).features) features.push({ f, source: "india-post-simplified" });
    } catch (err) {
      console.warn(`  skipped ${name}: ${err.message}`);
    }
  }
  return features;
}

// ---------------- cleaning ----------------

const titleCase = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\bAnd\b/g, "and")
    .trim() || null;

function cleanPoint(lat, lon) {
  let a = Number.parseFloat(lat);
  let o = Number.parseFloat(lon);
  if (!Number.isFinite(a) || !Number.isFinite(o)) return null;
  const inside = (y, x) => y >= INDIA.minLat && y <= INDIA.maxLat && x >= INDIA.minLon && x <= INDIA.maxLon;
  if (inside(a, o)) return [a, o];
  if (inside(o, a)) return [o, a]; // swapped columns are common in the source
  return null;
}

const median = (xs) => {
  const s = [...xs].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const mode = (xs) => {
  const counts = new Map();
  for (const x of xs) if (x) counts.set(x, (counts.get(x) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
};

const km = (lat1, lon1, lat2, lon2) => {
  const r = Math.PI / 180;
  const h = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

function roundGeometry(g) {
  const round = (c) => (typeof c[0] === "number" ? [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5] : c.map(round));
  return { type: g.type, coordinates: round(g.coordinates) };
}

function bboxOf(g) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c) => {
    if (typeof c[0] === "number") {
      b[0] = Math.min(b[0], c[0]);
      b[1] = Math.min(b[1], c[1]);
      b[2] = Math.max(b[2], c[0]);
      b[3] = Math.max(b[3], c[1]);
    } else c.forEach(walk);
  };
  walk(g.coordinates);
  return b;
}

// Area-weighted centroid of the largest outer ring (fallback when offices fall outside the polygon).
function polygonCentroid(g) {
  const rings = g.type === "Polygon" ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]);
  let best = null;
  for (const ring of rings) {
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[i + 1];
      const f = x0 * y1 - x1 * y0;
      a += f;
      cx += (x0 + x1) * f;
      cy += (y0 + y1) * f;
    }
    if (!a) continue;
    const c = { area: Math.abs(a / 2), lon: cx / (3 * a), lat: cy / (3 * a) };
    if (!best || c.area > best.area) best = c;
  }
  return best;
}

// ---------------- main ----------------

const started = Date.now();
const raw = await loadDirectory();
console.log(`Directory: ${raw.length.toLocaleString()} post offices`);

const offices = [];
for (const r of raw) {
  const pincode = String(r.pincode || "").replace(/\D/g, "");
  if (!/^[1-9]\d{5}$/.test(pincode)) continue;
  if (/\btest\b/i.test(r.officename || "") || pincode === "999999") continue; // placeholder rows in the source
  const pt = cleanPoint(r.latitude, r.longitude);
  offices.push({
    pincode,
    office_name: (r.officename || "").replace(/\s+/g, " ").trim(),
    office_type: r.officetype || null,
    delivery: /^delivery$/i.test(r.delivery) ? 1 : 0,
    district: titleCase(r.district),
    state: titleCase(r.statename),
    circle: r.circlename || null,
    region: /reporting/i.test(r.regionname || "") ? null : r.regionname || null, // "DivReportingCircle" is a placeholder
    division: r.divisionname || null,
    lat: pt ? pt[0] : null,
    lon: pt ? pt[1] : null,
  });
}

const boundaryFeatures = await loadBoundaries();
const boundaries = new Map();
for (const { f, source } of boundaryFeatures) {
  const p = f.properties || {};
  const pin = String(p.pincode ?? p.Pincode ?? p.PINCODE ?? p.pin_code ?? "").replace(/\D/g, "");
  if (!/^[1-9]\d{5}$/.test(pin) || !f.geometry || !["Polygon", "MultiPolygon"].includes(f.geometry.type)) continue;
  const geometry = roundGeometry(f.geometry);
  const prev = boundaries.get(pin);
  // Some files split one PIN into several features; merge them into a MultiPolygon.
  if (prev) {
    const polys = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
    prev.geometry = { type: "MultiPolygon", coordinates: [...polys(prev.geometry), ...polys(geometry)] };
  } else boundaries.set(pin, { geometry, source });
}
console.log(`Boundaries: ${boundaries.size.toLocaleString()} PIN areas`);

const byPin = new Map();
for (const o of offices) {
  if (!byPin.has(o.pincode)) byPin.set(o.pincode, []);
  byPin.get(o.pincode).push(o);
}

const summaries = [];
let outliers = 0;
for (const [pincode, list] of byPin) {
  let pts = list.filter((o) => o.lat != null);
  let center = null;
  if (pts.length) {
    const m = { lat: median(pts.map((o) => o.lat)), lon: median(pts.map((o) => o.lon)) };
    const kept = pts.filter((o) => km(o.lat, o.lon, m.lat, m.lon) <= 50);
    outliers += pts.length - kept.length;
    for (const o of pts) if (!kept.includes(o)) o.lat = o.lon = null; // a mis-geocoded office would mislead lookups
    pts = kept.length ? kept : pts;
    center = { lat: median(pts.map((o) => o.lat)), lon: median(pts.map((o) => o.lon)) };
  }
  const boundary = boundaries.get(pincode);
  let bbox = null;
  if (boundary) {
    bbox = bboxOf(boundary.geometry);
    if (!center || !booleanPointInPolygon([center.lon, center.lat], boundary.geometry)) {
      const c = polygonCentroid(boundary.geometry);
      if (c) center = { lat: c.lat, lon: c.lon };
    }
  } else if (pts.length) {
    // Without a boundary, frame the core of the area: offices within twice the median
    // distance from the centre (at least 3 km), so one stray office can't stretch it.
    const dist = pts.map((o) => km(o.lat, o.lon, center.lat, center.lon));
    const limit = Math.max(3, 2 * median(dist));
    const core = pts.filter((o, i) => dist[i] <= limit);
    const pad = 0.01;
    bbox = [
      Math.min(...core.map((o) => o.lon)) - pad,
      Math.min(...core.map((o) => o.lat)) - pad,
      Math.max(...core.map((o) => o.lon)) + pad,
      Math.max(...core.map((o) => o.lat)) + pad,
    ];
  }
  summaries.push([
    pincode,
    mode(list.map((o) => o.district)),
    mode(list.map((o) => o.state)),
    mode(list.map((o) => o.circle)),
    mode(list.map((o) => o.region)),
    mode(list.map((o) => o.division)),
    center ? Math.round(center.lat * 1e6) / 1e6 : null,
    center ? Math.round(center.lon * 1e6) / 1e6 : null,
    bbox?.[0] ?? null,
    bbox?.[1] ?? null,
    bbox?.[2] ?? null,
    bbox?.[3] ?? null,
    list.length,
    list.filter((o) => o.delivery).length,
    boundary ? 1 : 0,
  ]);
}
console.log(`PIN codes: ${summaries.length.toLocaleString()} (${outliers} mis-placed office coordinates dropped)`);

const db = await getDb();
const sqlite = db.kind === "sqlite";
async function insertMany(table, columns, rows, chunk = 400) {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const placeholders = part.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
    await db.run(`INSERT INTO ${table} (${columns.join(", ")}) VALUES ${placeholders}`, part.flat());
  }
}

if (sqlite) await db.exec("BEGIN");
await db.run("DELETE FROM pincode_offices");
await db.run("DELETE FROM pincodes");
await db.run("DELETE FROM pincode_boundaries");
await insertMany(
  "pincode_offices",
  ["pincode", "office_name", "office_type", "delivery", "district", "state", "lat", "lon"],
  offices.map((o) => [o.pincode, o.office_name, o.office_type, o.delivery, o.district, o.state, o.lat, o.lon])
);
await insertMany(
  "pincodes",
  ["pincode", "district", "state", "circle", "region", "division", "lat", "lon", "min_lon", "min_lat", "max_lon", "max_lat", "office_count", "delivery_offices", "has_boundary"],
  summaries
);
await insertMany(
  "pincode_boundaries",
  ["pincode", "geometry", "min_lon", "min_lat", "max_lon", "max_lat", "source"],
  [...boundaries].map(([pin, b]) => [pin, JSON.stringify(b.geometry), ...bboxOf(b.geometry), b.source]),
  50
);
if (sqlite) await db.exec("COMMIT");

console.log(`Imported in ${((Date.now() - started) / 1000).toFixed(1)} s. Restart the app (or wait 10 minutes) to load the new index.`);
process.exit(0);
