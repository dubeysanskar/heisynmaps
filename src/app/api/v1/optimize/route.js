import { config } from "@/lib/config";
import { costingFor, normalizeTrip, PROFILES, toLocation, valhalla } from "@/lib/engines/valhalla";
import { ApiError, apiRoute, point, points, preflight, readJson } from "@/lib/gateway";

export const OPTIONS = preflight;

export const POST = apiRoute("route.optimize", async (request) => {
  const body = await readJson(request);
  if (body.vehicles || body.jobs) return fleet(body);

  // Single vehicle: Valhalla keeps the first and last location fixed and reorders the rest.
  const locations = points(body.locations, "locations", { min: 3, max: 25 });
  const profile = body.profile || "car";
  const { costing, costing_options } = costingFor(profile, body);
  const data = await valhalla("optimized_route", {
    locations: locations.map(toLocation),
    costing,
    costing_options,
    units: "kilometers",
    directions_options: { units: "kilometers" },
  });
  return {
    profile,
    order: data.trip.locations.map((l) => l.original_index),
    route: normalizeTrip(data.trip),
  };
});

// Multi-vehicle VRP (capacities, time windows) through VROOM. VROOM wants integer ids,
// so ours are mapped to 1..n and back.
async function fleet(body) {
  if (!config.vroomUrl) {
    throw new ApiError(
      501,
      "vroom_not_configured",
      "Fleet optimisation needs VROOM. Start it from infra/docker-compose.yml and set VROOM_URL"
    );
  }
  if (!Array.isArray(body.vehicles) || !body.vehicles.length || !Array.isArray(body.jobs) || !body.jobs.length) {
    throw new ApiError(400, "invalid_param", "Send vehicles: [..] and jobs: [..]");
  }
  if (body.jobs.length > 1000 || body.vehicles.length > 100) {
    throw new ApiError(400, "too_large", "At most 1,000 jobs and 100 vehicles");
  }
  const profile = PROFILES[body.profile || "car"] || "auto";
  const vehicleIds = body.vehicles.map((v, i) => v.id ?? `vehicle-${i + 1}`);
  const jobIds = body.jobs.map((j, i) => j.id ?? `job-${i + 1}`);
  const lonLat = (p, name) => {
    const q = point(p, name);
    return [q.lon, q.lat];
  };
  const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
  const req = {
    vehicles: body.vehicles.map((v, i) => ({
      id: i + 1,
      profile,
      start: lonLat(v.start, `vehicles[${i}].start`),
      ...(v.end ? { end: lonLat(v.end, `vehicles[${i}].end`) } : {}),
      ...pick(v, ["capacity", "time_window", "skills"]),
    })),
    jobs: body.jobs.map((j, i) => ({
      id: i + 1,
      location: lonLat(j, `jobs[${i}]`),
      ...pick(j, ["service", "delivery", "pickup", "time_windows", "skills", "priority"]),
    })),
  };

  let res;
  try {
    res = await fetch(config.vroomUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(60000),
    });
  } catch (err) {
    throw new ApiError(502, "optimizer_unavailable", `VROOM unreachable: ${err.message}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.code) throw new ApiError(502, "optimizer_error", data.error || `VROOM returned ${res.status}`);
  return {
    summary: data.summary,
    unassigned: (data.unassigned || []).map((u) => jobIds[u.id - 1]),
    routes: (data.routes || []).map((r) => ({
      vehicle: vehicleIds[r.vehicle - 1],
      duration_s: r.duration,
      distance_m: r.distance,
      steps: r.steps.map((s) => ({
        type: s.type,
        job: ["job", "delivery", "pickup"].includes(s.type) ? jobIds[s.id - 1] : undefined,
        location: s.location,
        arrival_s: s.arrival,
        load: s.load,
      })),
    })),
  };
}
