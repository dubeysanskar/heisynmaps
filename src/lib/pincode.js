import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { lru } from "./cache";
import { getDb } from "./db";
import { tryDigipin } from "./digipin";
import { haversine } from "./geo";

// India Post PIN codes: lookup, prefix/name search and point → PIN.
// Data is loaded by scripts/data/import-pincodes.mjs (Department of Posts, GODL-India).

const CELL = 0.05; // ~5.5 km grid cells for the nearest-office index
const INDEX_TTL_MS = 10 * 60_000;
const NEAREST_MAX_M = 25_000;

export function normalizePincode(value) {
  const s = String(value ?? "").replace(/\s+/g, "");
  return /^[1-9]\d{5}$/.test(s) ? s : null;
}

// Finds a PIN inside free text: "Connaught Place, New Delhi 110001" → "110001".
export function extractPincode(text) {
  const m = String(text || "").match(/(?:^|[^\d])([1-9]\d{2}\s?\d{3})(?!\d)/);
  return m ? m[1].replace(/\s/, "") : null;
}

const cellKey = (lat, lon) => `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`;

async function index() {
  const cached = globalThis.__heisynPinIndex;
  if (cached && Date.now() - cached.at < INDEX_TTL_MS) return cached;
  const db = await getDb();
  const [offices, boundaries, count] = await Promise.all([
    db.all("SELECT pincode, office_name, lat, lon FROM pincode_offices WHERE lat IS NOT NULL"),
    db.all("SELECT pincode, min_lon, min_lat, max_lon, max_lat FROM pincode_boundaries"),
    db.get("SELECT COUNT(*) AS n FROM pincodes"),
  ]);
  const grid = new Map();
  for (const o of offices) {
    const k = cellKey(o.lat, o.lon);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push({ pincode: o.pincode, name: o.office_name, lat: Number(o.lat), lon: Number(o.lon) });
  }
  const built = {
    at: Date.now(),
    loaded: Number(count?.n || 0) > 0,
    grid,
    boundaries: boundaries.map((b) => ({ pincode: b.pincode, box: [Number(b.min_lon), Number(b.min_lat), Number(b.max_lon), Number(b.max_lat)] })),
  };
  globalThis.__heisynPinIndex = built;
  return built;
}

export async function hasPincodeData() {
  return (await index()).loaded;
}

const geometryCache = lru("pin-geometry", { max: 600, ttlMs: 60 * 60_000 });

async function boundaryGeometry(pincode) {
  const hit = geometryCache.get(pincode);
  if (hit !== undefined) return hit;
  const db = await getDb();
  const row = await db.get("SELECT geometry, source FROM pincode_boundaries WHERE pincode = ?", [pincode]);
  const value = row ? { geometry: JSON.parse(row.geometry), source: row.source } : null;
  geometryCache.set(pincode, value);
  return value;
}

function nearestOffice(idx, lat, lon, maxM = NEAREST_MAX_M) {
  const rings = Math.ceil(maxM / 1000 / (CELL * 111)) + 1;
  const ci = Math.floor(lat / CELL);
  const cj = Math.floor(lon / CELL);
  let best = null;
  for (let r = 0; r <= rings; r++) {
    for (let i = ci - r; i <= ci + r; i++) {
      for (let j = cj - r; j <= cj + r; j++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue; // only the new ring
        for (const o of idx.grid.get(`${i}:${j}`) || []) {
          const d = haversine(lat, lon, o.lat, o.lon);
          if (d <= maxM && (!best || d < best.distance)) best = { ...o, distance: d };
        }
      }
    }
    // Anything in a farther ring is at least r cells away.
    if (best && best.distance < r * CELL * 111_000) break;
  }
  return best;
}

const summaryCache = lru("pin-summary", { max: 5000, ttlMs: 30 * 60_000 });

// One PIN code's summary (no offices or geometry). null if unknown.
export async function getPincodeSummary(pincode) {
  const pin = normalizePincode(pincode);
  if (!pin) return null;
  const hit = summaryCache.get(pin);
  if (hit !== undefined) return hit;
  const db = await getDb();
  const row = await db.get("SELECT * FROM pincodes WHERE pincode = ?", [pin]);
  const value = row ? toSummary(row) : null;
  summaryCache.set(pin, value);
  return value;
}

// Full detail: summary + post offices (+ boundary geometry on request).
export async function getPincode(pincode, { offices = true, geometry = false } = {}) {
  const summary = await getPincodeSummary(pincode);
  if (!summary) return null;
  const out = { ...summary };
  if (offices) {
    const db = await getDb();
    const rows = await db.all(
      "SELECT office_name, office_type, delivery, lat, lon FROM pincode_offices WHERE pincode = ? ORDER BY delivery DESC, office_type DESC, office_name",
      [summary.pincode]
    );
    out.post_offices = rows.map((r) => ({
      name: r.office_name,
      type: { HO: "Head office", PO: "Sub office", BO: "Branch office" }[r.office_type] || r.office_type,
      delivery: Boolean(Number(r.delivery)),
      lat: r.lat == null ? null : Number(r.lat),
      lon: r.lon == null ? null : Number(r.lon),
    }));
  }
  if (geometry && summary.boundary.available) {
    out.geometry = (await boundaryGeometry(summary.pincode))?.geometry || null;
  }
  return out;
}

// Which PIN code covers this point?
//   1. official boundary polygon, when loaded for this area
//   2. the postcode OpenStreetMap has for the nearest address (osmPostcode), if it is a known PIN nearby
//   3. the nearest post office
export async function pincodeAt(lat, lon, { osmPostcode } = {}) {
  const idx = await index();
  if (!idx.loaded || lat < 6 || lat > 37.6 || lon < 68 || lon > 97.6) return null;

  for (const b of idx.boundaries) {
    const [w, s, e, n] = b.box;
    if (lon < w || lon > e || lat < s || lat > n) continue;
    const g = await boundaryGeometry(b.pincode);
    if (g && booleanPointInPolygon([lon, lat], g.geometry)) {
      return { ...(await getPincodeSummary(b.pincode)), method: "boundary", confidence: "high" };
    }
  }

  const osmPin = normalizePincode(osmPostcode);
  if (osmPin) {
    const known = await getPincodeSummary(osmPin);
    if (known?.center && haversine(lat, lon, known.center.lat, known.center.lon) <= 15_000) {
      return { ...known, method: "address", confidence: "medium" };
    }
  }

  const office = nearestOffice(idx, lat, lon);
  if (!office) return null;
  return {
    ...(await getPincodeSummary(office.pincode)),
    method: "nearest_post_office",
    confidence: office.distance <= 3000 ? "medium" : "low",
    nearest_office: { name: office.name, distance_m: Math.round(office.distance) },
  };
}

// Prefix ("1100") or area/post-office name ("lajpat nagar") search.
export async function searchPincodes(q, { limit = 10 } = {}) {
  const text = String(q || "").trim();
  const db = await getDb();
  if (/^[1-9]\d{0,5}$/.test(text.replace(/\s/g, ""))) {
    const prefix = text.replace(/\s/g, "");
    const rows = await db.all("SELECT * FROM pincodes WHERE pincode LIKE ? ORDER BY pincode LIMIT ?", [`${prefix}%`, limit]);
    return rows.map((r) => ({ ...toSummary(r), matched_offices: [] }));
  }
  if (text.length < 3) return [];
  const like = `%${text.toLowerCase().replace(/[%_]/g, "")}%`;
  const offices = await db.all(
    "SELECT pincode, office_name FROM pincode_offices WHERE LOWER(office_name) LIKE ? ORDER BY delivery DESC LIMIT ?",
    [like, limit * 4]
  );
  const byPin = new Map();
  for (const o of offices) {
    if (!byPin.has(o.pincode)) byPin.set(o.pincode, []);
    byPin.get(o.pincode).push(o.office_name);
  }
  const out = [];
  for (const [pin, names] of byPin) {
    if (out.length >= limit) break;
    const s = await getPincodeSummary(pin);
    if (s) out.push({ ...s, matched_offices: names });
  }
  return out;
}

// Same shape as the geocoder's search results.
export function pincodeResult(s) {
  const where = [s.district, s.state].filter(Boolean).join(", ");
  return {
    id: `pincode:${s.pincode}`,
    source: "india_post",
    name: `PIN ${s.pincode}`,
    label: `${s.pincode} · ${where}${s.post_office_count ? ` · ${s.post_office_count} post office${s.post_office_count === 1 ? "" : "s"}` : ""}`,
    category: "address:pincode",
    type: "pincode",
    address: { postcode: s.pincode, city: s.district, state: s.state, country: "India", country_code: "IN" },
    lat: s.center?.lat ?? null,
    lon: s.center?.lon ?? null,
    digipin: s.center ? tryDigipin(s.center.lat, s.center.lon) : null,
    pincode: s.pincode,
    extent: s.bbox ? [s.bbox[0], s.bbox[3], s.bbox[2], s.bbox[1]] : null, // [w, n, e, s] like Photon
  };
}

function toSummary(r) {
  const num = (v) => (v == null ? null : Number(v));
  const center = r.lat == null ? null : { lat: num(r.lat), lon: num(r.lon) };
  return {
    pincode: r.pincode,
    district: r.district,
    state: r.state,
    circle: r.circle,
    region: r.region,
    division: r.division,
    center,
    digipin: center ? tryDigipin(center.lat, center.lon) : null,
    bbox: r.min_lon == null ? null : [num(r.min_lon), num(r.min_lat), num(r.max_lon), num(r.max_lat)],
    post_office_count: num(r.office_count),
    delivery_offices: num(r.delivery_offices),
    boundary: { available: Boolean(Number(r.has_boundary)) },
  };
}
