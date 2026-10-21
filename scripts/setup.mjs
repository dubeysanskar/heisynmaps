// One command to make Naksha independent of third-party services on this machine:
// downloads the open data once, then builds our own search index, map tiles, fonts, PIN codes
// and routing graph. Re-running skips anything already present (use --refresh to redo).
//
//   npm run setup                      # Delhi NCR region (laptop-friendly)
//   npm run setup -- --region=india    # all India (server: ~32 GB RAM recommended)
//   npm run setup -- --skip=routing,tiles
//
// Data goes to NAKSHA_DATA_DIR (default ./data). On a OneDrive/Dropbox-synced project, point it
// outside the synced folder, e.g. NAKSHA_DATA_DIR=C:\naksha-data in .env.local.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=") || "true"];
  })
);
const region = args.region === "india" ? "india" : "ncr";
const skip = new Set(String(args.skip || "").split(",").filter(Boolean));
const DATA = path.resolve(process.env.NAKSHA_DATA_DIR || "data");
// Delhi NCR spans two Geofabrik zones: Delhi/Haryana (Northern) and Noida/Ghaziabad (Central, UP).
const SOURCES = {
  pbfs: {
    ncr: [
      "https://download.geofabrik.de/asia/india/northern-zone-latest.osm.pbf",
      "https://download.geofabrik.de/asia/india/central-zone-latest.osm.pbf",
    ],
    india: ["https://download.geofabrik.de/asia/india-latest.osm.pbf"],
  }[region],
  searchDump: "https://download1.graphhopper.com/public/asia/india/photon-dump-india-1.0-latest.jsonl.zst",
};
const pbfPath = path.join(DATA, "osm", region === "ncr" ? "delhi-ncr.osm.pbf" : "india-latest.osm.pbf");
const dumpPath = path.join(DATA, "search", "photon-dump-india.jsonl.zst");
const searchDb = process.env.SEARCH_DB_PATH || path.join(DATA, "search", "search.db");
const pmtiles = process.env.PMTILES_PATH || path.join(DATA, "tiles", "region.pmtiles");

async function download(url, file) {
  if (fs.existsSync(file) && !args.refresh) return console.log(`✓ ${path.basename(file)} already downloaded`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  console.log(`↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const tmp = `${file}.part`;
  const out = fs.createWriteStream(tmp);
  let done = 0;
  for await (const chunk of res.body) {
    out.write(chunk);
    done += chunk.length;
    if (total) process.stdout.write(`\r  ${((done / total) * 100).toFixed(0)}% of ${(total / 1e6).toFixed(0)} MB`);
  }
  await new Promise((r) => out.end(r));
  fs.renameSync(tmp, file);
  console.log();
}

function step(name, script, scriptArgs = []) {
  if (skip.has(name)) return console.log(`– skipping ${name}`);
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(process.execPath, [script, ...scriptArgs], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`${name} failed (exit ${r.status}). Fix the error above and re-run npm run setup.`);
    process.exit(r.status || 1);
  }
}

function hasPyvalhalla() {
  try {
    execFileSync(process.platform === "win32" ? "python" : "python3", ["-c", "import valhalla"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

console.log(`Setting up an independent Naksha (${region}) in ${DATA}\n`);
if (!skip.has("tiles") || !skip.has("routing")) {
  const parts = SOURCES.pbfs.map((u) => path.join(DATA, "osm", path.basename(u)));
  for (const [i, u] of SOURCES.pbfs.entries()) await download(u, parts[i]);
  if (parts.length > 1 && (!fs.existsSync(pbfPath) || args.refresh)) {
    console.log("Merging the zones into one extract …");
    const py = process.platform === "win32" ? "python" : "python3";
    const r = spawnSync(py, ["scripts/data/merge_osm.py", pbfPath, ...parts], { stdio: "inherit" });
    if (r.status !== 0) {
      console.error("Merging needs pyosmium: pip install osmium");
      process.exit(1);
    }
  } else if (parts.length === 1 && parts[0] !== pbfPath && !fs.existsSync(pbfPath)) {
    fs.copyFileSync(parts[0], pbfPath);
  }
}
if (!skip.has("search")) await download(SOURCES.searchDump, dumpPath);

step("pincodes", "scripts/data/import-pincodes.mjs");
if (!fs.existsSync(path.resolve("public/fonts/Noto Sans Regular/0-255.pbf")) || args.refresh) step("fonts", "scripts/data/install-fonts.mjs");
if (!fs.existsSync(searchDb) || args.refresh) step("search", "scripts/data/build-search-index.mjs", [`--dump=${dumpPath}`, `--out=${searchDb}`]);
if (!fs.existsSync(pmtiles) || args.refresh) {
  step("tiles", "scripts/data/build-tiles.mjs", [`--pbf=${pbfPath}`, `--out=${pmtiles}`, ...(region === "india" ? ["--bounds=none", "--full"] : [])]);
}
if (!skip.has("routing")) {
  if (hasPyvalhalla()) step("routing", "scripts/engines/routing.mjs", ["build", `--pbf=${pbfPath}`]);
  else console.log("\n– routing: install the engine first with  pip install pyvalhalla==3.9.1  then re-run npm run setup");
}

console.log(`
Done. Make sure .env.local contains:
  NAKSHA_DATA_DIR=${DATA}
  SEARCH_DB_PATH=${searchDb}
  PMTILES_PATH=${pmtiles}
  VALHALLA_URL=http://127.0.0.1:8002
  REQUIRE_SELF_HOSTED=1     # refuse any third-party fallback

Then run the routing engine (npm run engine:routing) next to the app (npm run dev).
GET /api/v1/status reports "independent": true when nothing depends on a third party.`);
