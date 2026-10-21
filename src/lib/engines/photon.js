import { fetchWithRetry, lru } from "../cache";
import { config, engineUrl } from "../config";
import { ApiError } from "../gateway";
import { tryDigipin } from "../digipin";
import * as local from "./localsearch";

// Search runs on Naksha's built-in index (localsearch.js) whenever it has been built.
// Photon is only used when there is no index: a self-hosted one via PHOTON_URL, or the
// public demo in development.

// Categories for /nearby → Photon 1.x category filters (include=osm.<key>.<value>,...),
// which work without a text query.
export const CATEGORIES = {
  fuel: { label: "Petrol pump", include: ["osm.amenity.fuel"] },
  ev_charging: { label: "EV charging", include: ["osm.amenity.charging_station"] },
  atm: { label: "ATM", include: ["osm.amenity.atm", "osm.amenity.bank"] },
  hospital: { label: "Hospital", include: ["osm.amenity.hospital", "osm.amenity.clinic"] },
  pharmacy: { label: "Pharmacy", include: ["osm.amenity.pharmacy"] },
  restaurant: { label: "Restaurant", include: ["osm.amenity.restaurant", "osm.amenity.fast_food", "osm.amenity.cafe"] },
  parking: { label: "Parking", include: ["osm.amenity.parking"] },
  police: { label: "Police", include: ["osm.amenity.police"] },
  toilets: { label: "Toilets", include: ["osm.amenity.toilets"] },
  warehouse: { label: "Warehouse", include: ["osm.building.warehouse", "osm.landuse.industrial"] },
};

async function photon(pathname, params) {
  const url = new URL(`${engineUrl("photon")}${pathname}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    for (const item of Array.isArray(v) ? v : [v]) url.searchParams.append(k, String(item));
  }
  const cached = searchCache.get(url.href);
  if (cached) return cached;
  let res;
  try {
    res = await fetchWithRetry(url, { headers: { "User-Agent": config.userAgent }, signal: AbortSignal.timeout(10000) });
  } catch (err) {
    throw new ApiError(502, "search_unavailable", `Search engine unreachable: ${err.message}`);
  }
  if (res.status === 429 || res.status === 503) {
    throw new ApiError(503, "search_busy", "Search is busy right now. Please try again in a moment.");
  }
  if (!res.ok) throw new ApiError(502, "search_error", `Search engine returned ${res.status}`);
  const data = await res.json();
  const results = (data.features || []).map(normalizeFeature);
  searchCache.set(url.href, results);
  return results;
}

// Identical searches (autocomplete prefixes, popular places) are served from memory.
const searchCache = lru("photon", { max: 5000, ttlMs: 30 * 60_000 });

export async function search(q, { lat, lon, limit = 8, bbox, include } = {}) {
  if (local.isAvailable()) return local.search(q, { lat, lon, limit, bbox, include });
  return photon("/api", {
    q,
    lat,
    lon,
    limit,
    lang: "en",
    bbox: bbox ? bbox.join(",") : undefined,
    include: include ? include.join(",") : undefined,
  });
}

export async function reverse(lat, lon) {
  if (local.isAvailable()) return local.reverse(lat, lon);
  const [first] = await photon("/reverse", { lat, lon, limit: 1, lang: "en" });
  return first || null;
}

function normalizeFeature(f) {
  const p = f.properties || {};
  const [lon, lat] = f.geometry.coordinates;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const address = {
    house_number: p.housenumber || null,
    street: p.street || null,
    locality: p.locality || p.district || null,
    city: p.city || p.county || null,
    state: p.state || null,
    postcode: p.postcode || null,
    country: p.country || null,
    country_code: p.countrycode || null,
  };
  const name = p.name || street || address.locality || address.city || "Unnamed place";
  const parts = [name, street, address.locality, address.city, address.state, address.postcode];
  const label = [...new Set(parts.filter(Boolean))].join(", ");
  return {
    id: `osm:${p.osm_type}${p.osm_id}`,
    source: "osm",
    name,
    label,
    category: p.osm_key ? `${p.osm_key}:${p.osm_value}` : null,
    type: p.type || null,
    address,
    lat,
    lon,
    digipin: tryDigipin(lat, lon),
    extent: p.extent || null, // [minLon, maxLat, maxLon, minLat] when the result is an area
  };
}
