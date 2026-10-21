import { config, engineMode, engineUrl } from "@/lib/config";
import { getDb } from "@/lib/db";
import { hasLocalTiles } from "@/lib/engines/tiles";
import { preflight, publicRoute } from "@/lib/gateway";

export const OPTIONS = preflight;

async function probe(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": config.userAgent }, signal: AbortSignal.timeout(4000) });
    return { ok: res.ok, latency_ms: Date.now() - started };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export const GET = publicRoute(async () => {
  const [routing, search] = await Promise.all([
    probe(`${engineUrl("valhalla")}/status`),
    probe(`${engineUrl("photon")}/api?q=delhi&limit=1`),
  ]);
  const db = await getDb();
  return {
    ok: routing.ok && search.ok,
    engines: {
      routing: { engine: "valhalla", mode: engineMode("valhalla"), ...routing },
      search: { engine: "photon", mode: engineMode("photon"), ...search },
      tiles: { engine: "pmtiles", mode: hasLocalTiles() ? "self-hosted" : "public-fallback" },
      optimizer: { engine: "vroom", mode: engineMode("vroom") },
      database: { engine: db.kind },
    },
  };
});
