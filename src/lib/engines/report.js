import { config, engineMode, engineUrl, fontsMode } from "../config";
import { getDb } from "../db";
import { hasPincodeData } from "../pincode";
import * as local from "./localsearch";
import { hasLocalTiles } from "./tiles";

// One view of every engine: what runs it and whether it still depends on a third party.
// mode: built-in (inside the app) · self-hosted (our server) · public-fallback (third party, dev only)
//       · not-configured · disabled · missing

async function probe(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": config.userAgent }, signal: AbortSignal.timeout(4000) });
    return { ok: res.ok, status: res.status, latency_ms: Date.now() - started };
  } catch (err) {
    return { ok: false, error: err.message, latency_ms: Date.now() - started };
  }
}

const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

const safeUrl = (name) => {
  try {
    return engineUrl(name);
  } catch {
    return null;
  }
};

export async function engineReport() {
  const valhalla = safeUrl("valhalla");
  const searchStats = local.stats();
  const photon = searchStats ? null : safeUrl("photon");
  const [routingProbe, searchProbe, db, pins] = await Promise.all([
    valhalla ? probe(`${valhalla}/status`) : { ok: false, error: "not configured" },
    searchStats ? { ok: true } : photon ? probe(`${photon}/api?q=delhi&limit=1`) : { ok: false, error: "not configured" },
    getDb(),
    hasPincodeData(),
  ]);
  const vroom = config.vroomUrl ? await probe(config.vroomUrl.replace(/\/$/, "") + "/health") : {};

  const engines = {
    routing: { engine: "Valhalla", mode: engineMode("valhalla"), host: hostOf(valhalla), ...routingProbe },
    search: searchStats
      ? { engine: "Naksha search index", mode: "built-in", ok: true, places: searchStats.places, built_at: searchStats.builtAt }
      : { engine: "Photon", mode: engineMode("photon"), host: hostOf(photon), ...searchProbe },
    tiles: { engine: "PMTiles", mode: hasLocalTiles() ? "self-hosted" : config.requireSelfHosted ? "not-configured" : "public-fallback", ok: true },
    fonts: { engine: "Map fonts", mode: fontsMode(), ok: true },
    pincodes: { engine: "India Post PIN codes", mode: pins ? "built-in" : "missing", ok: pins },
    optimizer: { engine: "VROOM", mode: engineMode("vroom"), host: config.vroomUrl ? hostOf(config.vroomUrl) : null, ...vroom },
    database: { engine: db.kind === "postgres" ? "Postgres" : "SQLite", mode: "self-hosted", ok: true },
  };
  const thirdParty = Object.entries(engines)
    .filter(([, e]) => e.mode === "public-fallback")
    .map(([name, e]) => ({ name, engine: e.engine, host: e.host || null }));
  return { engines, thirdParty };
}
