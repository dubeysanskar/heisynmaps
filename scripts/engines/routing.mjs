// Our own routing engine: Valhalla, from the official pyvalhalla package (Windows, macOS, Linux).
// No Docker needed. Same HTTP API as the Docker image, so the app just sets VALHALLA_URL.
//
//   pip install pyvalhalla==3.9.1            # once
//   npm run engine:routing:build              # build routing tiles from the OSM extract (~10–30 min)
//   npm run engine:routing                    # serve on http://127.0.0.1:8002
//
// Options: --pbf=<file> (default $HEISYN_DATA_DIR/osm/delhi-ncr.osm.pbf) --port=8002 --threads=4
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {}

const [command = "serve", ...rest] = process.argv.slice(2);
const args = Object.fromEntries(
  rest.map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=") || "true"];
  })
);
const DATA = path.resolve(process.env.HEISYN_DATA_DIR || "data");
const DIR = path.join(DATA, "valhalla");
const CONFIG = path.join(DIR, "valhalla.json");
const port = Number(args.port || 8002);
const threads = Number(args.threads || 4); // request threads for the service
const buildThreads = Number(args["build-threads"] || 2); // graph build; more threads crashed on Windows
const python = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");

// Locate the Valhalla executables shipped inside pyvalhalla, plus its bundled DLLs on Windows.
function valhallaBins() {
  let pkg;
  try {
    pkg = execFileSync(python, ["-c", "import valhalla, os; print(os.path.dirname(valhalla.__file__))"], { encoding: "utf8" }).trim();
  } catch {
    console.error("pyvalhalla is not installed. Run: pip install pyvalhalla==3.9.1");
    process.exit(1);
  }
  const libs = path.join(path.dirname(pkg), "pyvalhalla.libs");
  const env = { ...process.env, PATH: [libs, process.env.PATH].join(path.delimiter) };
  const exe = (name) => path.join(pkg, "bin", process.platform === "win32" ? `${name}.exe` : name);
  return { exe, env };
}

function writeConfig() {
  fs.mkdirSync(path.join(DIR, "tiles"), { recursive: true }); // get_config() requires it to exist
  const py = `
import json, os, sys, tempfile
from valhalla import get_config
# get_config() insists the tile archive exists; we serve the tile folder, so hand it a placeholder.
placeholder = tempfile.NamedTemporaryFile(suffix=".tar", delete=False)
placeholder.close()
c = get_config(tile_extract=placeholder.name, tile_dir=sys.argv[2])
os.unlink(placeholder.name)
c["mjolnir"]["tile_extract"] = sys.argv[1]
c["mjolnir"]["admin"] = sys.argv[3]
c["mjolnir"]["concurrency"] = int(sys.argv[4])
c["httpd"]["service"]["listen"] = "tcp://127.0.0.1:" + sys.argv[5]
open(sys.argv[6], "w").write(json.dumps(c, indent=2))
`;
  execFileSync(python, [
    "-c",
    py,
    path.join(DIR, "tiles.tar"),
    path.join(DIR, "tiles"),
    path.join(DIR, "admins.sqlite"),
    String(buildThreads),
    String(port),
    CONFIG,
  ], { stdio: "inherit" });
}

function run(bins, name, argv, { allowFail = false } = {}) {
  console.log(`\n▶ ${name} ${argv.join(" ")}`);
  const r = spawnSync(bins.exe(name), argv, { stdio: "inherit", env: bins.env });
  if (r.status === 0) return true;
  if (allowFail) return false;
  console.error(`${name} failed with exit code ${r.status}`);
  process.exit(r.status || 1);
}

if (command === "build") {
  const pbf = path.resolve(args.pbf || path.join(DATA, "osm", "delhi-ncr.osm.pbf"));
  if (!fs.existsSync(pbf)) {
    console.error(`OSM extract not found: ${pbf}`);
    process.exit(1);
  }
  const bins = valhallaBins();
  writeConfig();
  const started = Date.now();
  if (args.from) {
    // Resume an interrupted build from a stage, e.g. --from=parsenodes or --from=build (stage names have no underscores).
    run(bins, "valhalla_build_tiles", ["-c", CONFIG, "-s", args.from, "-e", "cleanup", pbf]);
    console.log(`\nRouting tiles built in ${Math.round((Date.now() - started) / 60000)} min → ${path.join(DIR, "tiles")}`);
    process.exit(0);
  }
  // A fresh build starts from an empty graph so tiles from an earlier, different extract can't linger.
  fs.rmSync(path.join(DIR, "tiles"), { recursive: true, force: true });
  writeConfig();
  run(bins, "valhalla_build_admins", ["-c", CONFIG, pbf]); // country/state rules (driving side, access defaults)
  // The Windows build can crash late in the graph build; parsing results stay on disk, so
  // resume from the "build" stage instead of starting over.
  if (!run(bins, "valhalla_build_tiles", ["-c", CONFIG, pbf], { allowFail: true })) {
    console.log("Tile build stopped early; resuming from the build stage …");
    run(bins, "valhalla_build_tiles", ["-c", CONFIG, "-s", "build", "-e", "cleanup", pbf]);
  }
  console.log(`\nRouting tiles built in ${Math.round((Date.now() - started) / 60000)} min → ${path.join(DIR, "tiles")}`);
  console.log("Start the engine with: npm run engine:routing");
} else if (command === "serve") {
  if (!fs.existsSync(path.join(DIR, "tiles")) || !fs.readdirSync(path.join(DIR, "tiles")).length) {
    console.error("No routing tiles yet. Run: npm run engine:routing:build");
    process.exit(1);
  }
  const bins = valhallaBins();
  writeConfig(); // keeps port/threads in sync with the flags
  console.log(`Valhalla listening on http://127.0.0.1:${port} (Ctrl+C to stop)`);
  // Supervise: restart the engine if it exits unexpectedly; stop if it crash-loops.
  let child;
  let stopping = false;
  const crashes = [];
  const start = () => {
    child = spawn(bins.exe("valhalla_service"), [CONFIG, String(threads)], { stdio: "inherit", env: bins.env });
    child.on("exit", (code) => {
      if (stopping) return process.exit(0);
      const now = Date.now();
      crashes.push(now);
      while (crashes.length && now - crashes[0] > 60_000) crashes.shift();
      if (crashes.length >= 5) {
        console.error(`Valhalla exited ${crashes.length} times in a minute (last code ${code}); giving up.`);
        process.exit(1);
      }
      console.error(`${new Date().toISOString()} Valhalla exited (code ${code}); restarting …`);
      setTimeout(start, 1000);
    });
  };
  start();
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      stopping = true;
      child?.kill();
    });
  }
} else {
  console.error("Usage: node scripts/engines/routing.mjs [build|serve] [--pbf=…] [--port=8002] [--threads=4]");
  process.exit(1);
}
