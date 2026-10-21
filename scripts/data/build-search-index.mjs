// Builds Naksha's own search index (SQLite FTS5 + R*Tree) from an OpenStreetMap place export.
// The app then answers search, autocomplete, reverse geocoding and nearby from this file
// without calling any external search service.
//
//   npm run data:search -- --dump=C:\naksha-data\search\photon-dump-india.jsonl.zst
//   npm run data:search -- --dump=… --bbox=76.4,27.8,78.1,29.3     # only one region
//
// Input: the Nominatim-derived JSONL dump published for Photon (one place per line), e.g.
//   https://download1.graphhopper.com/public/asia/india/photon-dump-india-1.0-latest.jsonl.zst
// Data © OpenStreetMap contributors, ODbL.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { Decompress } from "fzstd";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=") || "true"];
  })
);
const dump = path.resolve(args.dump || process.env.SEARCH_DUMP || "data/search/photon-dump-india.jsonl.zst");
const out = path.resolve(args.out || process.env.SEARCH_DB_PATH || "data/search.db");
const bbox = args.bbox ? args.bbox.split(",").map(Number) : null;

// Trigram index over names: lets "conaught place" find "Connaught Place".
const TRIGRAM_SQL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS places_tri USING fts5(name, content='places', content_rowid='id', tokenize='trigram');
  INSERT INTO places_tri (rowid, name) SELECT id, name FROM places;
  INSERT INTO places_tri (places_tri) VALUES ('optimize');
  CREATE VIRTUAL TABLE IF NOT EXISTS places_tri_vocab USING fts5vocab(places_tri, 'row');
`;

if (args.upgrade) {
  // Add indexes introduced after an index was built, without re-reading the dump.
  const existing = new Database(out);
  const has = (name) => existing.prepare("SELECT 1 FROM sqlite_master WHERE name = ?").get(name);
  if (!has("places_tri")) {
    console.log("Adding typo-tolerant name index …");
    existing.exec(TRIGRAM_SQL);
  }
  existing.exec("DROP INDEX IF EXISTS places_category; CREATE INDEX places_category ON places(osm_key, osm_value, lat);");
  existing.exec("CREATE INDEX IF NOT EXISTS places_name ON places(name COLLATE NOCASE, importance);");
  existing.exec("CREATE VIRTUAL TABLE IF NOT EXISTS places_tri_vocab USING fts5vocab(places_tri, 'row');");
  existing.close();
  console.log(`Upgraded ${out}`);
  process.exit(0);
}

if (!fs.existsSync(dump)) {
  console.error(`Dump not found: ${dump}\nDownload it from https://download1.graphhopper.com/public/asia/india/`);
  process.exit(1);
}

const tmp = `${out}.building`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(tmp, { force: true });
const db = new Database(tmp);
db.pragma("journal_mode = OFF");
db.pragma("synchronous = OFF");
db.exec(`
  CREATE TABLE places (
    id INTEGER PRIMARY KEY,
    osm TEXT NOT NULL,
    name TEXT NOT NULL,
    alt TEXT,
    osm_key TEXT,
    osm_value TEXT,
    kind TEXT,
    importance REAL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    w REAL, s REAL, e REAL, n REAL,
    housenumber TEXT,
    street TEXT,
    locality TEXT,
    city TEXT,
    district TEXT,
    state TEXT,
    postcode TEXT,
    country_code TEXT
  );
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
`);

const insert = db.prepare(`INSERT INTO places (id, osm, name, alt, osm_key, osm_value, kind, importance, lat, lon, w, s, e, n,
  housenumber, street, locality, city, district, state, postcode, country_code)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const pick = (obj, ...keys) => {
  for (const k of keys) if (obj?.[k]) return String(obj[k]);
  return null;
};

let id = 0;
let seen = 0;
let skipped = 0;
let batch = [];
const flush = db.transaction((rows) => {
  for (const r of rows) insert.run(r);
});

function addPlace(p) {
  seen++;
  const [lon, lat] = p.centroid || [];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return skipped++;
  if (bbox && (lon < bbox[0] || lat < bbox[1] || lon > bbox[2] || lat > bbox[3])) return skipped++;
  const n = p.name || {};
  const a = p.address || {};
  let name = pick(n, "name:en", "name", "int_name", "official_name", "short_name");
  if (!name && p.housenumber && a.street) name = `${p.housenumber} ${a.street}`;
  if (!name) return skipped++;
  // Other spellings and scripts (Hindi, local names) stay searchable.
  const alt = [...new Set(Object.entries(n).filter(([k, v]) => v && v !== name && /^(name(:hi|:ur|:pa|:bn|:ta|:te|:mr|:gu|:kn|:ml)?|alt_name|old_name|short_name|official_name|loc_name)$/.test(k)).map(([, v]) => v))].join(" ; ");
  const [w, north, e, south] = p.bbox || [lon, lat, lon, lat]; // dump order: [west, north, east, south]
  batch.push([
    ++id,
    `${p.object_type}${p.object_id}`,
    name,
    alt || null,
    p.osm_key || null,
    p.osm_value || null,
    p.address_type || null,
    Number(p.importance) || 0,
    lat,
    lon,
    Math.min(w, e),
    Math.min(north, south),
    Math.max(w, e),
    Math.max(north, south),
    p.housenumber || null,
    pick(a, "street"),
    pick(a, "suburb", "neighbourhood", "locality", "district"),
    pick(a, "city"),
    pick(a, "county"),
    pick(a, "state"),
    p.postcode || null,
    p.country_code || null,
  ]);
  if (batch.length >= 5000) {
    flush(batch);
    batch = [];
  }
}

const started = Date.now();
const decoder = new TextDecoder("utf-8");
let carry = "";
const stream = new Decompress((chunk, final) => {
  const text = carry + decoder.decode(chunk, { stream: !final });
  const lines = text.split("\n");
  carry = final ? "" : lines.pop();
  for (const line of lines) {
    if (!line.includes('"type":"Place"')) continue;
    try {
      for (const p of JSON.parse(line).content) addPlace(p);
    } catch {
      skipped++;
    }
  }
});

const fd = fs.openSync(dump, "r");
const size = fs.fstatSync(fd).size;
const buf = Buffer.alloc(4 * 1024 * 1024);
let read = 0;
for (;;) {
  const n = fs.readSync(fd, buf, 0, buf.length, read);
  if (!n) break;
  read += n;
  stream.push(new Uint8Array(buf.subarray(0, n)), read >= size);
  process.stdout.write(`\r  ${((read / size) * 100).toFixed(1)}% · ${id.toLocaleString()} places`);
}
fs.closeSync(fd);
if (batch.length) flush(batch);
console.log(`\nRead ${seen.toLocaleString()} records, kept ${id.toLocaleString()}, skipped ${skipped.toLocaleString()}`);

console.log("Building full-text index …");
db.exec(`
  CREATE VIRTUAL TABLE places_fts USING fts5(
    name, alt, street, locality, city, district, state, postcode,
    content='places', content_rowid='id',
    tokenize="unicode61 remove_diacritics 2", prefix='1 2 3 4'
  );
  INSERT INTO places_fts (rowid, name, alt, street, locality, city, district, state, postcode)
    SELECT id, name, alt, street, locality, city, district, state, postcode FROM places;
  INSERT INTO places_fts (places_fts) VALUES ('optimize');
`);
console.log("Building spatial index …");
db.exec(`
  CREATE VIRTUAL TABLE places_geo USING rtree(id, minlon, maxlon, minlat, maxlat);
  INSERT INTO places_geo SELECT id, w, e, s, n FROM places;
  CREATE INDEX places_category ON places(osm_key, osm_value, lat);
  CREATE INDEX places_name ON places(name COLLATE NOCASE, importance);
`);
console.log("Building typo-tolerant name index …");
db.exec(TRIGRAM_SQL);
const meta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
meta.run("source", path.basename(dump));
meta.run("built_at", new Date().toISOString());
meta.run("places", String(id));
meta.run("bbox", bbox ? bbox.join(",") : "");
db.close();
fs.renameSync(tmp, out);
console.log(`Done in ${((Date.now() - started) / 1000).toFixed(0)} s → ${out} (${(fs.statSync(out).size / 1e6).toFixed(0)} MB)`);
