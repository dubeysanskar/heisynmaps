import polyline from "@mapbox/polyline";
import { fetchWithRetry, lru } from "../cache";
import { config, engineUrl } from "../config";
import { ApiError } from "../gateway";

// Our profile names → Valhalla costing models.
export const PROFILES = {
  car: "auto",
  truck: "truck",
  bike: "motorcycle",
  scooter: "motor_scooter",
  bicycle: "bicycle",
  foot: "pedestrian",
  bus: "bus",
};

export function costingFor(profile = "car", { truck, avoid } = {}) {
  const costing = PROFILES[profile];
  if (!costing) {
    throw new ApiError(400, "invalid_profile", `profile must be one of ${Object.keys(PROFILES).join(", ")}`);
  }
  const options = {};
  if (profile === "truck" && truck) {
    const map = { weight_t: "weight", height_m: "height", width_m: "width", length_m: "length", axle_load_t: "axle_load" };
    for (const [ours, theirs] of Object.entries(map)) {
      if (truck[ours] !== undefined) options[theirs] = Number(truck[ours]);
    }
    if (truck.axle_count !== undefined) options.axle_count = Number(truck.axle_count);
    if (truck.hazmat) options.hazmat = true;
  }
  const avoidSet = new Set(Array.isArray(avoid) ? avoid : []);
  if (avoidSet.has("tolls")) options.use_tolls = 0;
  if (avoidSet.has("highways")) options.use_highways = 0;
  if (avoidSet.has("ferries")) options.use_ferry = 0;
  return { costing, costing_options: Object.keys(options).length ? { [costing]: options } : undefined };
}

// Routing answers for identical requests are reused for a few minutes.
const routeCache = lru("valhalla", { max: 2000, ttlMs: 5 * 60_000 });

export async function valhalla(action, body) {
  const cacheKey = `${action}:${JSON.stringify(body)}`;
  const cached = routeCache.get(cacheKey);
  if (cached) return cached;
  const data = await callValhalla(action, body);
  routeCache.set(cacheKey, data);
  return data;
}

async function callValhalla(action, body) {
  const base = engineUrl("valhalla"); // throws "not configured" (503) rather than "unreachable"
  let res;
  try {
    res = await fetchWithRetry(`${base}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": config.userAgent },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new ApiError(502, "routing_unavailable", `Routing engine unreachable: ${err.message}`);
  }
  if (res.status === 429 || res.status === 503) {
    throw new ApiError(503, "routing_busy", "Routing is busy right now. Please try again in a moment.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Valhalla 4xx errors are about the request (e.g. 442 "No path could be found").
    const message = data.error || data.status || `Routing engine returned ${res.status}`;
    if (res.status >= 400 && res.status < 500) {
      const noRoute = [442, 443, 171, 170].includes(data.error_code);
      throw new ApiError(noRoute ? 422 : 400, noRoute ? "no_route" : "routing_error", message);
    }
    throw new ApiError(502, "routing_error", message);
  }
  return data;
}

const toLonLat = (encoded) => polyline.decode(encoded, 6).map(([lat, lon]) => [lon, lat]);

// Valhalla trip → our route shape (GeoJSON geometry, metres and seconds).
export function normalizeTrip(trip) {
  const coordinates = [];
  const legs = trip.legs.map((leg) => {
    const coords = toLonLat(leg.shape);
    coordinates.push(...(coordinates.length ? coords.slice(1) : coords));
    return {
      distance_m: Math.round(leg.summary.length * 1000),
      duration_s: Math.round(leg.summary.time),
      steps: (leg.maneuvers || []).map((m) => ({
        instruction: m.instruction,
        distance_m: Math.round(m.length * 1000),
        duration_s: Math.round(m.time),
        type: m.type,
        street_names: m.street_names || [],
        location: coords[m.begin_shape_index] || null,
      })),
    };
  });
  const s = trip.summary;
  return {
    distance_m: Math.round(s.length * 1000),
    duration_s: Math.round(s.time),
    has_toll: Boolean(s.has_toll),
    has_highway: Boolean(s.has_highway),
    has_ferry: Boolean(s.has_ferry),
    geometry: { type: "LineString", coordinates },
    legs,
  };
}

// Newer Valhalla returns {durations, distances}; older returns rows of cells.
export function normalizeMatrix(data, sourceCount, targetCount) {
  const m = data.sources_to_targets;
  if (Array.isArray(m)) {
    const durations = m.map((row) => row.map((c) => (c.time == null ? null : Math.round(c.time))));
    const distances = m.map((row) => row.map((c) => (c.distance == null ? null : Math.round(c.distance * 1000))));
    return { durations, distances };
  }
  if (m && m.durations) {
    return {
      durations: m.durations.map((row) => row.map((v) => (v == null ? null : Math.round(v)))),
      distances: m.distances.map((row) => row.map((v) => (v == null ? null : Math.round(v * 1000)))),
    };
  }
  throw new ApiError(502, "routing_error", `Unexpected matrix response for ${sourceCount}x${targetCount}`);
}

export const toLocation = (p) => ({ lat: p.lat, lon: p.lon });
