import { costingFor, normalizeTrip, valhalla } from "@/lib/engines/valhalla";
import { apiRoute, points, preflight, readJson } from "@/lib/gateway";

export const OPTIONS = preflight;

// GPS traces are forwarded to the routing engine and never stored.
export const POST = apiRoute("route.snap", async (request) => {
  const body = await readJson(request);
  const trace = points(body.points, "points", { min: 2, max: 5000 });
  const profile = body.profile || "car";
  const { costing, costing_options } = costingFor(profile, body);
  const timed = trace.every((p) => Number.isFinite(Number(p.time)));
  const data = await valhalla("trace_route", {
    shape: trace.map((p) => ({ lat: p.lat, lon: p.lon, ...(timed ? { time: Number(p.time) } : {}) })),
    costing,
    costing_options,
    shape_match: "map_snap",
    ...(timed ? { use_timestamps: true } : {}),
    units: "kilometers",
    directions_options: { units: "kilometers" },
  });
  return { profile, route: normalizeTrip(data.trip) };
});
