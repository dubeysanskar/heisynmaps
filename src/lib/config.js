import path from "node:path";

// Public demo services used only when a self-hosted engine URL is not set.
// They are for development: their fair-use policies forbid production SaaS traffic.
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
  glyphsUrl: process.env.GLYPHS_URL || FALLBACK.glyphs,
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
  const own = { valhalla: config.valhallaUrl, photon: config.photonUrl, vroom: config.vroomUrl }[name];
  if (own) return "self-hosted";
  return name === "vroom" ? "disabled" : "public-fallback";
}
