import { costingFor, normalizeTrip, toLocation, valhalla } from "@/lib/engines/valhalla";
import { apiRoute, points, preflight, readJson } from "@/lib/gateway";

export const OPTIONS = preflight;

export const POST = apiRoute("route.directions", async (request) => {
  const body = await readJson(request);
  const locations = points(body.locations, "locations", { min: 2, max: 25 });
  const profile = body.profile || "car";
  const { costing, costing_options } = costingFor(profile, body);
  const alternatives = Math.max(0, Math.min(2, Number(body.alternatives) || 0));
  const req = {
    locations: locations.map(toLocation),
    costing,
    costing_options,
    units: "kilometers",
    directions_options: { units: "kilometers", language: body.language || "en-US" },
    // Valhalla only computes alternates for plain A→B requests.
    ...(alternatives && locations.length === 2 ? { alternates: alternatives } : {}),
    ...(body.depart_at ? { date_time: { type: 1, value: String(body.depart_at).slice(0, 16) } } : {}),
  };
  const data = await valhalla("route", req);
  const trips = [data.trip, ...(data.alternates || []).map((a) => a.trip)];
  return { profile, routes: trips.map(normalizeTrip) };
});
