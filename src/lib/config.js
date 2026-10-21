import fs from "node:fs";
import path from "node:path";

// Every engine is ours. There are no third-party fallbacks: if an engine is not set up,
// requests fail with a clear "not configured" error (HTTP 503) instead of silently using someone
// else's server. `npm run setup` builds everything (see README "Independent by design").

export const config = {
  valhallaUrl: process.env.VALHALLA_URL || "",
  photonUrl: process.env.PHOTON_URL || "", // optional: a Photon server we run ourselves
  vroomUrl: process.env.VROOM_URL || "",
  pmtilesPath: path.resolve(/*turbopackIgnore: true*/ process.env.PMTILES_PATH || "data/tiles/region.pmtiles"),
  glyphsUrl: process.env.GLYPHS_URL || "",
  fontsDir: path.resolve(/*turbopackIgnore: true*/ "public/fonts"),
  indiaBoundaryGeojson: process.env.INDIA_BOUNDARY_GEOJSON || "public/data/india-boundary.geojson",
  userAgent: "HeisynMaps/0.1 (+https://github.com/dubeysanskar/heisynmaps)",
};

const SETUP_HINT = {
  valhalla: "Routing engine not configured: run npm run engine:routing and set VALHALLA_URL",
  photon: "Search index not built: run npm run setup (or set PHOTON_URL to your own Photon server)",
};

// Thrown when an engine is missing; the gateway turns it into 503 engine_not_configured.
export function notConfigured(message) {
  return Object.assign(new Error(message), { notConfigured: true });
}

export function engineUrl(name) {
  const own = { valhalla: config.valhallaUrl, photon: config.photonUrl }[name];
  if (own) return own.replace(/\/$/, "");
  throw notConfigured(SETUP_HINT[name] || `${name} is not configured`);
}

export function engineMode(name) {
  if (name === "photon" && hasSearchIndex()) return "built-in";
  const own = { valhalla: config.valhallaUrl, photon: config.photonUrl, vroom: config.vroomUrl }[name];
  if (own) return "self-hosted";
  return name === "vroom" ? "disabled" : "not-configured";
}

export function hasSearchIndex() {
  return process.env.SEARCH_ENGINE !== "photon" && fs.existsSync(path.resolve(/*turbopackIgnore: true*/ process.env.SEARCH_DB_PATH || "data/search.db"));
}

// Map label fonts: our own copy in public/fonts (npm run data:fonts) or our own font server (GLYPHS_URL).
export function hasLocalFonts() {
  return fs.existsSync(path.join(config.fontsDir, "Noto Sans Regular", "0-255.pbf"));
}

export function glyphsFor(origin) {
  if (config.glyphsUrl) return config.glyphsUrl;
  if (hasLocalFonts()) return `${origin}/fonts/{fontstack}/{range}.pbf`;
  throw notConfigured("Map fonts not installed: run npm run data:fonts");
}

export function fontsMode() {
  if (config.glyphsUrl) return "self-hosted";
  return hasLocalFonts() ? "built-in" : "not-configured";
}
