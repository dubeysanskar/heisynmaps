import { NCR } from "./brand";
import { decodeDigipin, formatDigipin, normalizeDigipin } from "./digipin";
import { search } from "./engines/photon";
import { getPlace, MAPPIN_RE, searchPlaces, toResult } from "./places";
import { ApiError, number } from "./gateway";
import { haversine } from "./geo";

export function searchParams(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) throw new ApiError(400, "invalid_param", "q is required");
  if (q.length > 200) throw new ApiError(400, "invalid_param", "q is too long");
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  return {
    q,
    // Bias towards Delhi NCR unless the caller says otherwise.
    lat: lat ? number(lat, "lat", { min: -90, max: 90 }) : NCR.center[1],
    lon: lon ? number(lon, "lon", { min: -180, max: 180 }) : NCR.center[0],
    limit: number(url.searchParams.get("limit"), "limit", { min: 1, max: 20, fallback: 8 }),
  };
}

// Order of precedence: DIGIPIN → the org's MapPIN → the org's saved places → OSM.
export async function runSearch(orgId, { q, lat, lon, limit }) {
  const results = [];
  const digipin = normalizeDigipin(q);
  if (digipin) {
    const d = decodeDigipin(digipin);
    results.push({
      id: `digipin:${digipin}`,
      source: "digipin",
      name: `DIGIPIN ${formatDigipin(digipin)}`,
      label: `DIGIPIN ${formatDigipin(digipin)} (${d.lat}, ${d.lon})`,
      category: "address:digipin",
      type: "digipin",
      address: {},
      lat: d.lat,
      lon: d.lon,
      digipin,
    });
  }
  if (MAPPIN_RE.test(q)) {
    const place = await getPlace(orgId, q);
    if (place) results.push(toResult(place));
  }
  const own = await searchPlaces(orgId, q, Math.min(limit, 5));
  for (const r of own) if (!results.some((x) => x.id === r.id)) results.push(r);

  let osm = await search(q, { lat, lon, limit });
  // Indian queries often end in a city qualifier OSM spells differently
  // ("sector 29 gurgaon" vs Gurugram); retry once without the last word, but only
  // near the user so a looser query can't jump to another country.
  const words = q.split(/\s+/);
  if (!osm.length && words.length > 1) {
    const bbox = [lon - 1.5, lat - 1.5, lon + 1.5, lat + 1.5];
    osm = await search(words.slice(0, -1).join(" "), { lat, lon, limit, bbox });
  }
  // Photon's location bias is soft; keep results within 200 km of the user first
  // so "cyber hub" from Delhi finds Gurugram, not a namesake abroad.
  const near = (r) => haversine(lat, lon, r.lat, r.lon) <= 200_000;
  osm = [...osm.filter(near), ...osm.filter((r) => !near(r))];
  for (const r of osm) {
    if (results.length >= limit) break;
    results.push(r);
  }
  return results.slice(0, limit);
}
