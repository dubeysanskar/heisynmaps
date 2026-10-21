import fs from "node:fs";
import path from "node:path";

// Public demo services used only when a self-hosted engine is not set up.
// They are for development: their fair-use policies forbid production SaaS traffic.
// With REQUIRE_SELF_HOSTED=1 none of them is ever called.
export const FALLBACK = {
  valhalla: "https://valhalla1.openstreetmap.de",
  photon: "https://photon.komoot.io",
  tilejson: "https://tiles.openfreemap.org/planet",
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
};

export const config = {
  valhallaUrl: process.env.VALHALLA_URL || "",
  photonUrl: process.env.PHOTON_URL || "",
  vroomUrl: process.env.VROOM_URL || "",
  pmtilesPath: path.resolve(/*turbopackIgnore: true*/ process.env.PMTILES_PATH || "data/tiles/region.pmtiles"),
  glyphsUrl: process.env.GLYPHS_URL || "",
  fontsDir: path.resolve(/*turbopackIgnore: true*/ "public/fonts"),
  indiaBoundaryGeojson: process.env.INDIA_BOUNDARY_GEOJSON || "public/data/india-boundary.geojson",
  requireSelfHosted: process.env.REQUIRE_SELF_HOSTED === "1",
  userAgent: "NakshaMaps/0.1 (+https://github.com/dubeysanskar)",
};

export function engineUrl(name) {
  const own = { valhalla: config.valhallaUrl, photon: config.photonUrl }[name];
  if (own) return own.replace(/\/$/, "");
  if (config.requireSelfHosted) {
    throw new Error(`${name} is not configured and REQUIRE_SELF_HOSTED=1`);
  }
  return FALLBACK[name];
}

export function engineMode(name) {
  if (name === "photon" && hasSearchIndex()) return "built-in";
  const own = { valhalla: config.valhallaUrl, photon: config.photonUrl, vroom: config.vroomUrl }[name];
  if (own) return "self-hosted";
  return name === "vroom" ? "disabled" : config.requireSelfHosted ? "not-configured" : "public-fallback";
}

export function hasSearchIndex() {
  return process.env.SEARCH_ENGINE !== "photon" && fs.existsSync(path.resolve(/*turbopackIgnore: true*/ process.env.SEARCH_DB_PATH || "data/search.db"));
}

// Map label fonts: our own copy in public/fonts (npm run data:fonts), a self-hosted URL,
// or the public fallback in development.
export function hasLocalFonts() {
  return fs.existsSync(path.join(config.fontsDir, "Noto Sans Regular", "0-255.pbf"));
}

export function glyphsFor(origin) {
  if (config.glyphsUrl) return config.glyphsUrl;
  if (hasLocalFonts()) return `${origin}/fonts/{fontstack}/{range}.pbf`;
  if (config.requireSelfHosted) throw new Error("No map fonts: run npm run data:fonts or set GLYPHS_URL (REQUIRE_SELF_HOSTED=1)");
  return FALLBACK.glyphs;
}

export function fontsMode() {
  if (config.glyphsUrl) return "self-hosted";
  if (hasLocalFonts()) return "built-in";
  return config.requireSelfHosted ? "not-configured" : "public-fallback";
}
