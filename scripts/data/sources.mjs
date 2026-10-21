// Every dataset HeisynMaps is built from, where to get it, and our own archive of it.
//
// Principles
//   1. No single provider can stop us: each dataset lists alternative sources, non-profit and
//      government first, companies last.
//   2. Everything we download is kept in our archive ($HEISYN_DATA_DIR/archive) with a SHA-256
//      checksum, so rebuilds work offline (`--offline`) even if every source disappears.
//   3. All of it is open data we may keep and use permanently (ODbL / GODL-India / OFL).
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const OSMFR = "https://download.openstreetmap.fr/extracts/asia/india"; // OpenStreetMap France (non-profit association)
const GEOFABRIK = "https://download.geofabrik.de/asia"; // Geofabrik GmbH (company) — backup only

// A "set" is a list of files that together cover the region. Sets are tried in order.
export const DATASETS = {
  "osm-ncr": {
    title: "OpenStreetMap data for Delhi NCR",
    license: "ODbL 1.0 (© OpenStreetMap contributors)",
    sets: [
      {
        provider: "OpenStreetMap France (non-profit)",
        files: [
          `${OSMFR}/national_capital_territory_of_delhi.osm.pbf`,
          `${OSMFR}/haryana.osm.pbf`,
          `${OSMFR}/uttar_pradesh.osm.pbf`,
        ],
        md5: true,
      },
      {
        provider: "Geofabrik (company, backup)",
        files: [`${GEOFABRIK}/india/northern-zone-latest.osm.pbf`, `${GEOFABRIK}/india/central-zone-latest.osm.pbf`],
        md5: true,
      },
    ],
  },
  "osm-india": {
    title: "OpenStreetMap data for all of India",
    license: "ODbL 1.0 (© OpenStreetMap contributors)",
    sets: [
      { provider: "OpenStreetMap France (non-profit)", files: ["https://download.openstreetmap.fr/extracts/asia/india.osm.pbf"], md5: true },
      { provider: "Geofabrik (company, backup)", files: [`${GEOFABRIK}/india-latest.osm.pbf`], md5: true },
    ],
  },
  fonts: {
    title: "Noto Sans map label glyphs",
    license: "SIL Open Font License 1.1",
    sets: [{ provider: "OpenMapTiles font pack (open source)", files: ["https://github.com/openmaptiles/fonts/releases/download/v2.0/v2.0.zip"] }],
  },
  "pincode-directory": {
    title: "India Post All India Pincode Directory",
    license: "Government Open Data Licence – India (© Department of Posts)",
    // The official data.gov.in API is used directly by import-pincodes.mjs when DATA_GOV_IN_API_KEY is set.
    sets: [{ provider: "Public export of the data.gov.in directory", files: ["https://raw.githubusercontent.com/dropdevrahul/pincodes-india/main/pincode.csv"] }],
  },
  "search-export": {
    title: "OSM place export (optional; our own builder makes this from OSM data)",
    license: "ODbL 1.0 (© OpenStreetMap contributors)",
    sets: [
      { provider: "GraphHopper (company, optional)", files: ["https://download1.graphhopper.com/public/asia/india/photon-dump-india-1.0-latest.jsonl.zst"] },
    ],
  },
};

const ARCHIVE = () => path.resolve(process.env.HEISYN_DATA_DIR || "data", "archive");
const MANIFEST = () => path.join(ARCHIVE(), "manifest.json");
const KEEP_VERSIONS = 2;

export function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST(), "utf8"));
  } catch {
    return { entries: [] };
  }
}

function writeManifest(m) {
  fs.mkdirSync(ARCHIVE(), { recursive: true });
  fs.writeFileSync(MANIFEST(), JSON.stringify(m, null, 2));
}

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function md5(file) {
  const hash = createHash("md5");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function downloadTo(url, file) {
  const res = await fetch(url, { headers: { "User-Agent": "HeisynMaps data setup (+https://github.com/dubeysanskar/heisynmaps)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const tmp = `${file}.part`;
  const out = fs.createWriteStream(tmp);
  let done = 0;
  let shown = -1;
  for await (const chunk of res.body) {
    if (!out.write(chunk)) await new Promise((r) => out.once("drain", r));
    done += chunk.length;
    const pct = total ? Math.floor((done / total) * 100) : -1;
    if (pct !== shown && pct % 5 === 0) {
      shown = pct;
      process.stdout.write(`\r    ${pct}% of ${(total / 1e6).toFixed(0)} MB`);
    }
  }
  await new Promise((r) => out.end(r));
  if (total) process.stdout.write("\n");
  fs.renameSync(tmp, file);
}

async function verifyMd5(url, file) {
  try {
    const res = await fetch(`${url}.md5`);
    if (!res.ok) return null;
    const expected = (await res.text()).trim().split(/\s+/)[0].toLowerCase();
    const actual = await md5(file);
    if (expected !== actual) throw new Error(`checksum mismatch for ${path.basename(file)}`);
    return true;
  } catch (err) {
    if (/mismatch/.test(err.message)) throw err;
    return null;
  }
}

// Latest archived copy of a set, if every file of it is still on disk.
function archivedSet(id) {
  const entries = readManifest().entries.filter((e) => e.dataset === id);
  if (!entries.length) return null;
  const latest = entries.reduce((a, b) => (a.fetched_at > b.fetched_at ? a : b));
  const batch = entries.filter((e) => e.batch === latest.batch);
  if (!batch.every((e) => fs.existsSync(e.path))) return null;
  return { provider: latest.provider, fetched_at: latest.fetched_at, files: batch.map((e) => e.path) };
}

// Returns local file paths for a dataset: fresh from the first working source, or from the archive.
//   offline: never touch the network; refresh: download even if archived.
export async function obtain(id, { offline = false, refresh = false } = {}) {
  const dataset = DATASETS[id];
  if (!dataset) throw new Error(`Unknown dataset ${id}`);
  const archived = archivedSet(id);
  if (archived && (offline || !refresh)) {
    console.log(`✓ ${dataset.title}: archived copy from ${archived.fetched_at.slice(0, 10)} (${archived.provider})`);
    return archived.files;
  }
  if (offline) throw new Error(`${dataset.title} is not in the archive yet; run once with network access.`);

  const batch = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13);
  const errors = [];
  for (const set of dataset.sets) {
    console.log(`↓ ${dataset.title} from ${set.provider}`);
    const dir = path.join(ARCHIVE(), id, batch);
    fs.mkdirSync(dir, { recursive: true });
    try {
      const files = [];
      for (const url of set.files) {
        const file = path.join(dir, path.basename(url));
        console.log(`  ${url}`);
        await downloadTo(url, file);
        if (set.md5) await verifyMd5(url, file);
        files.push({ url, file });
      }
      const manifest = readManifest();
      for (const { url, file } of files) {
        manifest.entries.push({
          dataset: id,
          batch,
          provider: set.provider,
          license: dataset.license,
          url,
          path: file,
          bytes: fs.statSync(file).size,
          sha256: await sha256(file),
          fetched_at: new Date().toISOString(),
        });
      }
      prune(manifest, id);
      writeManifest(manifest);
      return files.map((f) => f.file);
    } catch (err) {
      errors.push(`${set.provider}: ${err.message}`);
      console.warn(`  ✗ ${err.message}; trying the next source`);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  if (archived) {
    console.warn(`All sources failed; using the archived copy from ${archived.fetched_at.slice(0, 10)}.`);
    return archived.files;
  }
  throw new Error(`Could not obtain ${dataset.title}:\n  ${errors.join("\n  ")}`);
}

// Keep the newest KEEP_VERSIONS batches of each dataset on disk.
function prune(manifest, id) {
  const batches = [...new Set(manifest.entries.filter((e) => e.dataset === id).map((e) => e.batch))].sort().reverse();
  for (const old of batches.slice(KEEP_VERSIONS)) {
    for (const e of manifest.entries.filter((x) => x.dataset === id && x.batch === old)) fs.rmSync(e.path, { force: true });
    fs.rmSync(path.join(ARCHIVE(), id, old), { recursive: true, force: true });
    manifest.entries = manifest.entries.filter((x) => !(x.dataset === id && x.batch === old));
  }
}

// Record files that were downloaded before the archive existed (no network needed).
export async function adopt(id, files, provider) {
  const manifest = readManifest();
  const batch = "adopted-" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 13);
  const dir = path.join(ARCHIVE(), id, batch);
  fs.mkdirSync(dir, { recursive: true });
  for (const src of files) {
    const dest = path.join(dir, path.basename(src));
    if (!fs.existsSync(dest)) fs.renameSync(src, dest);
    manifest.entries.push({
      dataset: id,
      batch,
      provider,
      license: DATASETS[id].license,
      url: null,
      path: dest,
      bytes: fs.statSync(dest).size,
      sha256: await sha256(dest),
      fetched_at: new Date().toISOString(),
    });
  }
  writeManifest(manifest);
  return files.map((f) => path.join(dir, path.basename(f)));
}
