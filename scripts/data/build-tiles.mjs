// Builds our own vector tiles (OpenMapTiles schema → one PMTiles file) from OpenStreetMap with
// Planetiler. Works on Windows, macOS and Linux; needs Java 21+ (a portable JRE is fine).
//
//   npm run data:tiles                                   # NCR from $NAKSHA_DATA_DIR/osm/delhi-ncr.osm.pbf
//   npm run data:tiles -- --pbf=india-latest.osm.pbf --bounds=none --full     # all India, production
//
// Options
//   --pbf=<file>          OSM extract (Geofabrik). Default: $NAKSHA_DATA_DIR/osm/delhi-ncr.osm.pbf
//   --bounds=ncr|none|w,s,e,n   Clip the output. Default: ncr
//   --out=<file>          Default: $PMTILES_PATH or data/tiles/region.pmtiles
//   --full                Download ocean polygons, Natural Earth and lake centerlines (~1.4 GB) for
//                         complete low-zoom and coastal rendering. Without it ("lite") empty stand-ins are
//                         used: fine for inland regions such as Delhi NCR, where OSM supplies rivers and lakes.
//   --java=<java>  --planetiler=<jar>  --memory=3g
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

try {
  process.loadEnvFile(".env.local");
} catch {}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=") || "true"];
  })
);
const DATA = path.resolve(process.env.NAKSHA_DATA_DIR || "data");
const NCR = "76.84,28.20,77.65,28.90";
const PLANETILER_URL = "https://github.com/onthegomap/planetiler/releases/download/v0.10.2/planetiler.jar";

const pbf = path.resolve(args.pbf || path.join(DATA, "osm", "delhi-ncr.osm.pbf"));
const out = path.resolve(args.out || process.env.PMTILES_PATH || "data/tiles/region.pmtiles");
const bounds = args.bounds === "none" ? null : args.bounds && args.bounds !== "ncr" ? args.bounds : NCR;
const work = path.join(DATA, "planetiler");
const full = args.full === "true";

if (!fs.existsSync(pbf)) {
  console.error(`OSM extract not found: ${pbf}\nDownload one from https://download.geofabrik.de/asia/india.html`);
  process.exit(1);
}
fs.mkdirSync(path.join(work, "sources"), { recursive: true });
fs.mkdirSync(path.dirname(out), { recursive: true });

// ---------- Java + Planetiler ----------

function findJava() {
  if (args.java) return args.java;
  const exe = process.platform === "win32" ? "java.exe" : "java";
  const candidates = [process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, "bin", exe)];
  const tools = path.join(DATA, "tools");
  if (fs.existsSync(tools)) {
    for (const d of fs.readdirSync(tools)) if (/^jdk|^jre/i.test(d)) candidates.push(path.join(tools, d, "bin", exe));
  }
  for (const c of candidates) if (c && fs.existsSync(c)) return c;
  return "java"; // on PATH
}

async function findPlanetiler() {
  const jar = path.resolve(args.planetiler || path.join(DATA, "tools", "planetiler.jar"));
  if (fs.existsSync(jar)) return jar;
  console.log(`Downloading Planetiler → ${jar}`);
  const res = await fetch(PLANETILER_URL);
  if (!res.ok) throw new Error(`Planetiler download failed: HTTP ${res.status}`);
  fs.mkdirSync(path.dirname(jar), { recursive: true });
  fs.writeFileSync(jar, Buffer.from(await res.arrayBuffer()));
  return jar;
}

// ---------- empty stand-in sources for "lite" builds ----------

function zipFiles(zipPath, dir, files) {
  fs.rmSync(zipPath, { force: true });
  if (process.platform === "win32" || process.platform === "darwin") {
    const tar = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe") : "tar";
    execFileSync(tar, ["-a", "-c", "-f", zipPath, "-C", dir, ...files]);
  } else {
    execFileSync("zip", ["-j", "-q", zipPath, ...files.map((f) => path.join(dir, f))]);
  }
}

// A valid shapefile with zero features (main + index + attribute table + projection).
function writeEmptyShapefile(dir, base, shapeType, prj) {
  const header = Buffer.alloc(100);
  header.writeInt32BE(9994, 0);
  header.writeInt32BE(50, 24); // length in 16-bit words
  header.writeInt32LE(1000, 28);
  header.writeInt32LE(shapeType, 32);
  fs.writeFileSync(path.join(dir, `${base}.shp`), header);
  fs.writeFileSync(path.join(dir, `${base}.shx`), header);
  const dbf = Buffer.alloc(32 + 32 + 2);
  const now = new Date();
  dbf.writeUInt8(0x03, 0);
  dbf.writeUInt8(now.getFullYear() - 1900, 1);
  dbf.writeUInt8(now.getMonth() + 1, 2);
  dbf.writeUInt8(now.getDate(), 3);
  dbf.writeUInt32LE(0, 4); // records
  dbf.writeUInt16LE(32 + 32 + 1, 8); // header length
  dbf.writeUInt16LE(1 + 10, 10); // record length
  dbf.write("OSM_ID", 32, "ascii");
  dbf.write("N", 32 + 11, "ascii");
  dbf.writeUInt8(10, 32 + 16);
  dbf.writeUInt8(0x0d, 64);
  dbf.writeUInt8(0x1a, 65);
  fs.writeFileSync(path.join(dir, `${base}.dbf`), dbf);
  fs.writeFileSync(path.join(dir, `${base}.prj`), prj);
  return [`${base}.shp`, `${base}.shx`, `${base}.dbf`, `${base}.prj`];
}

const WGS84 =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
const WEB_MERCATOR =
  'PROJCS["WGS_84_Pseudo_Mercator",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Mercator"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",0.0],PARAMETER["Standard_Parallel_1",0.0],UNIT["Meter",1.0]]';

function liteSources() {
  const dir = path.join(work, "lite");
  fs.mkdirSync(dir, { recursive: true });
  const water = path.join(dir, "water-polygons-split-3857.zip");
  zipFiles(water, dir, writeEmptyShapefile(dir, "water_polygons", 5, WEB_MERCATOR));
  const lakes = path.join(dir, "lake_centerline.shp.zip");
  zipFiles(lakes, dir, writeEmptyShapefile(dir, "lake_centerline", 3, WGS84));
  const sqlite = path.join(dir, "natural_earth_vector.sqlite");
  fs.rmSync(sqlite, { force: true });
  const ne = new Database(sqlite);
  ne.exec("CREATE TABLE naksha_placeholder (id INTEGER)");
  ne.close();
  const neZip = path.join(dir, "natural_earth_vector.sqlite.zip");
  zipFiles(neZip, dir, ["natural_earth_vector.sqlite"]);
  return { water, lakes, ne: neZip };
}

// ---------- run ----------

const java = findJava();
const jar = await findPlanetiler();
const sources = full ? null : liteSources();
const planetilerArgs = [
  `-Xmx${args.memory || "3g"}`,
  "-jar",
  jar,
  `--osm_path=${pbf}`,
  `--output=${out}`,
  `--tmpdir=${path.join(work, "tmp")}`,
  `--download_dir=${path.join(work, "sources")}`,
  "--maxzoom=14",
  "--languages=en,hi",
  "--force",
  ...(bounds ? [`--bounds=${bounds}`] : []),
  ...(full
    ? ["--download"]
    : [`--water_polygons_path=${sources.water}`, `--natural_earth_path=${sources.ne}`, `--lake_centerlines_path=${sources.lakes}`]),
];
console.log(`Building ${full ? "full" : "lite"} tiles from ${path.basename(pbf)}${bounds ? ` within ${bounds}` : ""} → ${out}`);
const started = Date.now();
const run = spawnSync(java, planetilerArgs, { stdio: "inherit" });
if (run.status !== 0) {
  console.error(`Planetiler failed (exit ${run.status}). Is Java 21+ installed? Try --java=<path to java>.`);
  process.exit(run.status || 1);
}
console.log(`Done in ${Math.round((Date.now() - started) / 1000)} s → ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
console.log("Restart the app: /api/v1/status should report tiles as self-hosted.");
