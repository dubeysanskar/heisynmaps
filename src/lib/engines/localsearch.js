import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { tryDigipin } from "../digipin";
import { haversine } from "../geo";

// HeisynMaps's built-in geocoder: an SQLite file (FTS5 full-text + trigram + R*Tree spatial index)
// built by scripts/data/build-search-index.mjs from OpenStreetMap data. It runs inside the app
// process, so search needs no external service. Results have the same shape as the Photon adapter.

const DB_PATH = path.resolve(/*turbopackIgnore: true*/ process.env.SEARCH_DB_PATH || "data/search.db");

function open() {
  const cached = globalThis.__heisynSearchDb;
  if (cached !== undefined && cached?.path === DB_PATH) return cached?.db || null;
  let db = null;
  if (process.env.SEARCH_ENGINE !== "photon" && fs.existsSync(DB_PATH)) {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    db.pragma("cache_size = -128000"); // 128 MB page cache
    db.pragma("mmap_size = 1073741824"); // let the OS page the index in
    db.hasTrigrams = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'places_tri'").get());
    db.hasTrigramVocab = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'places_tri_vocab'").get());
  }
  globalThis.__heisynSearchDb = { path: DB_PATH, db };
  return db;
}

export function isAvailable() {
  return Boolean(open());
}

export function stats() {
  const db = open();
  if (!db) return null;
  const meta = Object.fromEntries(db.prepare("SELECT key, value FROM meta").all().map((r) => [r.key, r.value]));
  return { places: Number(meta.places || 0), builtAt: meta.built_at || null, source: meta.source || null, typoTolerant: db.hasTrigrams };
}

const tokenize = (q) =>
  (String(q || "")
    .normalize("NFKC")
    .toLowerCase()
    .match(/[\p{L}\p{M}\p{N}]+/gu) || []).slice(0, 8);

const quote = (t) => `"${t.replace(/"/g, '""')}"`;
const ftsQuery = (tokens) => tokens.map((t) => `${quote(t)}*`).join(" ");

function categoryPairs(include) {
  return (include || []).map((c) => c.split(".").slice(1)).filter((p) => p.length === 2);
}

function categorySql(pairs) {
  if (!pairs.length) return { sql: "", args: [] };
  return { sql: ` AND (${pairs.map(() => "(p.osm_key = ? AND p.osm_value = ?)").join(" OR ")})`, args: pairs.flat() };
}

const SELECT_RANKED = (where, extra = "") =>
  `SELECT p.*, bm25(places_fts, 10.0, 4.0, 2.0, 2.5, 2.0, 1.5, 1.0, 3.0) AS rank
     FROM places_fts JOIN places p ON p.id = places_fts.rowid
    WHERE places_fts MATCH ?${where}${extra}
    ORDER BY rank LIMIT ?`;

export function search(q, { lat, lon, limit = 8, bbox, include } = {}) {
  const db = open();
  const tokens = tokenize(q);
  const pairs = categoryPairs(include);
  const cat = categorySql(pairs);
  const box = bbox ? " AND p.lon >= ? AND p.lat >= ? AND p.lon <= ? AND p.lat <= ?" : "";
  const boxArgs = bbox || [];
  const ref = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : bbox ? { lat: (bbox[1] + bbox[3]) / 2, lon: (bbox[0] + bbox[2]) / 2 } : null;

  if (!tokens.length) {
    if (!pairs.length || !bbox) return [];
    // Category-only ("nearby"): walk the (key, value, lat) index, then keep what's inside the box.
    const rows = [];
    const stmt = db.prepare("SELECT * FROM places WHERE osm_key = ? AND osm_value = ? AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? LIMIT 2000");
    for (const [k, v] of pairs) rows.push(...stmt.all(k, v, bbox[1], bbox[3], bbox[0], bbox[2]));
    return dedupe(rows.map((r) => ({ r, d: haversine(ref.lat, ref.lon, r.lat, r.lon) })).sort((a, b) => a.d - b.d).map((x) => x.r))
      .slice(0, limit)
      .map(toResult);
  }

  // 1) Names only: small candidate sets even for very common words ("mumbai", "road").
  const fts = ftsQuery(tokens);
  let rows = db.prepare(SELECT_RANKED(box, cat.sql)).all(`{name alt} : (${fts})`, ...boxArgs, ...cat.args, 300);
  // 2) Any field, for queries that mix a name with its area ("pizza hut noida").
  if (rows.length < limit * 3) {
    const seen = new Set(rows.map((r) => r.id));
    for (const r of db.prepare(SELECT_RANKED(box, cat.sql)).all(fts, ...boxArgs, ...cat.args, 300)) if (!seen.has(r.id)) rows.push(r);
  }
  // 3) Exact names, which bm25 can under-rank when a famous place has many alternate names
  //    ("Mumbai", "Indira Gandhi International Airport").
  const phrase = tokens.join(" ");
  {
    const seen = new Set(rows.map((r) => r.id));
    const best = Math.min(0, ...rows.map((r) => r.rank)); // as relevant as the best text match
    const exact = db
      .prepare(`SELECT p.*, ? AS rank FROM places p WHERE p.name = ? COLLATE NOCASE${box}${cat.sql} ORDER BY p.importance DESC LIMIT 20`)
      .all(best, String(q).trim(), ...boxArgs, ...cat.args);
    for (const r of exact) {
      if (seen.has(r.id)) rows.find((x) => x.id === r.id).rank = best;
      else rows.push(r);
    }
  }
  // 4) Typos: few or no names matched the words, so match names by shared letter triples.
  let fuzzy = new Map();
  const nameHits = rows.filter((r) => tokens.every((t) => r.name.toLowerCase().includes(t))).length;
  if (db.hasTrigrams && phrase.length >= 4 && nameHits < 2) {
    fuzzy = fuzzyCandidates(db, phrase, box, boxArgs, cat);
    const best = Math.min(0, ...rows.map((r) => r.rank));
    const seen = new Set(rows.map((r) => r.id));
    for (const [id, { row, similarity }] of fuzzy) if (!seen.has(id)) rows.push({ ...row, rank: best * similarity });
  }

  const scored = rows.map((r) => {
    const name = r.name.toLowerCase();
    let score = -r.rank; // bm25: lower is better
    if (name === phrase) score += 8;
    else if (name.startsWith(phrase)) score += 4;
    if (tokens.every((t) => name.includes(t))) score += 2.5;
    if (fuzzy.has(r.id)) score += fuzzy.get(r.id).similarity * 12;
    score += (r.importance || 0) * 10;
    if (ref) score += 4 / (1 + haversine(ref.lat, ref.lon, r.lat, r.lon) / 15000);
    if (r.osm_key === "place" || ["city", "state", "county"].includes(r.kind)) score += 1;
    if (r.osm_key === "highway" && r.osm_value !== "bus_stop") score -= 0.5; // roads rarely what people search for by name
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return dedupe(scored.map((x) => x.r)).slice(0, limit).map(toResult);
}

const trigrams = (s) => {
  const t = new Set();
  const padded = `  ${s} `;
  for (let i = 0; i < padded.length - 2; i++) t.add(padded.slice(i, i + 3));
  return t;
};

function fuzzyCandidates(db, phrase, box, boxArgs, cat) {
  let grams = [...trigrams(phrase)].filter((g) => g.trim().length === 3);
  if (!grams.length) return new Map();
  // Use only the rarest few triples: common ones ("ace", "ion") match too many names to be useful or fast.
  if (db.hasTrigramVocab) {
    const freq = db.prepare("SELECT doc FROM places_tri_vocab WHERE term = ?");
    grams = grams
      .map((g) => ({ g, n: freq.get(g)?.doc ?? 0 }))
      .filter((x) => x.n > 0)
      .sort((a, b) => a.n - b.n)
      .slice(0, 5)
      .map((x) => x.g);
    if (!grams.length) return new Map();
  }
  const rows = db
    .prepare(
      `SELECT p.* FROM places_tri JOIN places p ON p.id = places_tri.rowid
        WHERE places_tri MATCH ?${box}${cat.sql}
        ORDER BY bm25(places_tri) LIMIT 400`
    )
    .all(grams.map(quote).join(" OR "), ...boxArgs, ...cat.args);
  const want = trigrams(phrase);
  const out = new Map();
  for (const row of rows) {
    const have = trigrams(row.name.toLowerCase());
    let shared = 0;
    for (const g of want) if (have.has(g)) shared++;
    const similarity = shared / (want.size + have.size - shared); // Jaccard
    if (similarity >= 0.45) out.set(row.id, { row, similarity });
  }
  return out;
}

const POI_KEYS = new Set(["amenity", "shop", "tourism", "office", "leisure", "historic", "building", "craft", "healthcare", "railway", "aeroway", "public_transport"]);
const AREA_KINDS = new Set(["locality", "district", "city", "county", "state", "country"]);

// The most specific named thing at a point: a POI or house, else a street, else the smallest area around it.
export function reverse(lat, lon) {
  const db = open();
  const stmt = db.prepare(
    `SELECT p.* FROM places_geo g JOIN places p ON p.id = g.id
      WHERE g.maxlon >= ? AND g.minlon <= ? AND g.maxlat >= ? AND g.minlat <= ? LIMIT 4000`
  );
  for (const d of [0.0015, 0.006, 0.03]) {
    let best = null;
    for (const r of stmt.all(lon - d, lon + d, lat - d, lat + d)) {
      const isArea = r.e - r.w > 1e-5 || r.n - r.s > 1e-5;
      const inside = lon >= r.w && lon <= r.e && lat >= r.s && lat <= r.n;
      if (r.kind === "country" || r.kind === "state") continue;
      let dist;
      if (isArea && inside) {
        // Containing areas rank by size: a building beats a neighbourhood beats a district.
        dist = Math.sqrt(((r.e - r.w) * (r.n - r.s)) / 2) * 111_000 * 0.5;
      } else {
        dist = haversine(lat, lon, r.lat, r.lon);
      }
      let weight = 1.6;
      if (r.housenumber) weight = 0.8;
      else if (POI_KEYS.has(r.osm_key)) weight = 1;
      else if (r.kind === "street") weight = 1.3;
      else if (AREA_KINDS.has(r.kind) || r.osm_key === "place" || r.osm_key === "boundary") weight = 2;
      const score = dist * weight;
      if (!best || score < best.score) best = { r, score };
    }
    if (best) return toResult(best.r);
  }
  return null;
}

function dedupe(rows) {
  const seen = new Set();
  return rows.filter((r) => {
    const key = `${r.name.toLowerCase()}|${r.osm_value}|${r.lat.toFixed(3)}|${r.lon.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toResult(r) {
  const street = [r.housenumber, r.street].filter(Boolean).join(" ");
  const address = {
    house_number: r.housenumber || null,
    street: r.street || null,
    locality: r.locality || null,
    city: r.city || r.district || null,
    state: r.state || null,
    postcode: r.postcode || null,
    country: r.country_code === "in" ? "India" : null,
    country_code: r.country_code ? r.country_code.toUpperCase() : null,
  };
  const parts = [r.name, street, address.locality, address.city, address.state, address.postcode];
  const isArea = r.e - r.w > 1e-6 || r.n - r.s > 1e-6;
  return {
    id: `osm:${r.osm}`,
    source: "osm",
    name: r.name,
    label: [...new Set(parts.filter(Boolean))].join(", "),
    category: r.osm_key ? `${r.osm_key}:${r.osm_value}` : null,
    type: r.kind || null,
    address,
    lat: r.lat,
    lon: r.lon,
    digipin: tryDigipin(r.lat, r.lon),
    extent: isArea ? [r.w, r.n, r.e, r.s] : null,
  };
}
