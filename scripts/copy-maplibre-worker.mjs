// MapLibre 6's ESM build runs its tile parsing in a module worker that bundlers
// don't emit. Copy it into /public so the client can point setWorkerUrl() at it.
import fs from "node:fs";
import path from "node:path";

const src = path.resolve("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
const dest = path.resolve("public/vendor/maplibre-gl-worker.mjs");

if (!fs.existsSync(src)) {
  console.warn("maplibre-gl worker not found; skipping copy");
  process.exit(0);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("Copied MapLibre worker → public/vendor/maplibre-gl-worker.mjs");
