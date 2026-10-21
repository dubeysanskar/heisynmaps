// One command to make HeisynMaps fully independent on this machine: fetch open data (non-profit and
// government sources first, kept in our own archive), then build our own search index, map tiles,
// fonts, PIN codes and routing graph. Re-running skips anything already built.
//
//   npm run setup                         # Delhi NCR (laptop-friendly)
//   npm run setup -- --region=india       # all India (server: ~32 GB RAM recommended)
//   npm run setup -- --offline            # rebuild only from our archive, no network at all
//   npm run setup -- --refresh            # fetch fresh data and rebuild everything
//   npm run setup -- --skip=routing,tiles
//   npm run setup -- --search=export      # use a ready-made place export instead of building from OSM
//
// Data goes to HEISYN_DATA_DIR (default ./data). On a OneDrive/Dropbox-synced project, point it
// outside the synced folder, e.g. HEISYN_DATA_DIR=C:\heisyn-data in .env.local.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DATASETS, obtain } from "./data/sources.mjs";

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
const offline = args.offline === "true";
const refresh = args.refresh === "true";
const skip = new Set(String(args.skip || "").split(",").filter(Boolean));
const DATA = path.resolve(process.env.HEISYN_DATA_DIR || "data");
const python = process.platform === "win32" ? "python" : "python3";
const pbfPath = path.join(DATA, "osm", region === "ncr" ? "delhi-ncr.osm.pbf" : "india.osm.pbf");
const searchDb = process.env.SEARCH_DB_PATH || path.join(DATA, "search", "search.db");
const pmtiles = process.env.PMTILES_PATH || path.join(DATA, "tiles", "region.pmtiles");
const stale = (file) => refresh || !fs.existsSync(file);

function run(name, cmd, cmdArgs) {
  if (skip.has(name)) return console.log(`– skipping ${name}`);
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`${name} failed (exit ${r.status}). Fix the error above and re-run npm run setup.`);
    process.exit(r.status || 1);
  }
}

function has(module) {
  try {
    execFileSync(python, ["-c", `import ${module}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

console.log(`Setting up an independent HeisynMaps (${region}${offline ? ", offline" : ""}) in ${DATA}\n`);
fs.mkdirSync(path.join(DATA, "osm"), { recursive: true });

// 1. OpenStreetMap extract (merged into one sorted file when the region spans several files)
const needsOsm = !(skip.has("tiles") && skip.has("routing") && skip.has("search"));
if (needsOsm && stale(pbfPath)) {
  const parts = await obtain(region === "ncr" ? "osm-ncr" : "osm-india", { offline, refresh });
  if (parts.length > 1) {
    if (!has("osmium")) {
      console.error("Merging the regional files needs pyosmium: pip install osmium");
      process.exit(1);
    }
    run("merge", python, ["scripts/data/merge_osm.py", pbfPath, ...parts]);
  } else {
    fs.copyFileSync(parts[0], pbfPath);
  }
}

// 2. PIN codes (India Post via data.gov.in) — needed before search, which uses them for districts
if (!skip.has("pincodes")) {
  const pinArgs = [];
  if (!process.env.DATA_GOV_IN_API_KEY) {
    const [csv] = await obtain("pincode-directory", { offline, refresh });
    pinArgs.push(`--csv=${csv}`);
  }
  run("pincodes", process.execPath, ["scripts/data/import-pincodes.mjs", ...pinArgs]);
}

// 3. Fonts
if (!skip.has("fonts") && (refresh || !fs.existsSync(path.resolve("public/fonts/Noto Sans Regular/0-255.pbf")))) {
  const [zip] = await obtain("fonts", { offline, refresh });
  run("fonts", process.execPath, ["scripts/data/install-fonts.mjs", `--zip=${zip}`]);
}

// 4. Search index — built from OSM by us (default), or from a ready-made export
if (!skip.has("search") && stale(searchDb)) {
  if (args.search === "export") {
    const [dump] = await obtain("search-export", { offline, refresh });
    run("search", process.execPath, ["scripts/data/build-search-index.mjs", `--dump=${dump}`, `--out=${searchDb}`]);
  } else {
    if (!has("osmium")) {
      console.error("Building search from OpenStreetMap needs pyosmium: pip install osmium");
      process.exit(1);
    }
    run("search", process.execPath, ["scripts/data/build-search-from-osm.mjs", `--pbf=${pbfPath}`, `--out=${searchDb}`]);
  }
}

// 5. Map tiles
if (!skip.has("tiles") && stale(pmtiles)) {
  run("tiles", process.execPath, ["scripts/data/build-tiles.mjs", `--pbf=${pbfPath}`, `--out=${pmtiles}`, ...(region === "india" ? ["--bounds=none", "--full"] : [])]);
}

// 6. Routing graph
if (!skip.has("routing")) {
  const tilesDir = path.join(DATA, "valhalla", "tiles");
  const built = fs.existsSync(tilesDir) && fs.readdirSync(tilesDir).some((d) => /^\d$/.test(d));
  if (built && !refresh) console.log("\n✓ routing graph already built");
  else if (has("valhalla")) run("routing", process.execPath, ["scripts/engines/routing.mjs", "build", `--pbf=${pbfPath}`]);
  else console.log("\n– routing: install the engine first with  pip install pyvalhalla==3.9.1  then re-run npm run setup");
}

console.log(`
Done. Sources and licences of everything used: ${path.join(DATA, "archive", "manifest.json")}
(${Object.keys(DATASETS).length} datasets tracked; rebuild offline any time with npm run setup -- --offline)

Make sure .env.local contains:
  HEISYN_DATA_DIR=${DATA}
  SEARCH_DB_PATH=${searchDb}
  PMTILES_PATH=${pmtiles}
  VALHALLA_URL=http://127.0.0.1:8002

Then run the routing engine (npm run engine:routing) next to the app (npm run dev).
GET /api/v1/status shows "independent": true and no "not_configured" engines when everything is ready.`);
