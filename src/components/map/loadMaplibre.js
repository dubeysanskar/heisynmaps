// Client-only MapLibre loader (scripts/copy-maplibre-worker.mjs puts the worker in /public).
export async function loadMaplibre() {
  const mod = await import("maplibre-gl");
  const maplibregl = mod.default ?? mod; // v6 is ESM with named exports
  if (!globalThis.__nakshaWorkerSet) {
    maplibregl.setWorkerUrl(`${window.location.origin}/vendor/maplibre-gl-worker.mjs`);
    globalThis.__nakshaWorkerSet = true;
  }
  return maplibregl;
}
