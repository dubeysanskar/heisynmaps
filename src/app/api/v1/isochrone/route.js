import { costingFor, valhalla } from "@/lib/engines/valhalla";
import { ApiError, apiRoute, point, preflight, readJson } from "@/lib/gateway";

export const OPTIONS = preflight;

const COLORS = ["#0d9488", "#2563eb", "#7c3aed", "#db2777"];

export const POST = apiRoute("route.isochrone", async (request) => {
  const body = await readJson(request);
  const location = point(body.location, "location");
  const profile = body.profile || "car";
  const byTime = Array.isArray(body.minutes);
  const values = byTime ? body.minutes : body.km;
  const max = byTime ? 120 : 100;
  if (!Array.isArray(values) || !values.length || values.length > 4 || values.some((v) => !(v > 0 && v <= max))) {
    throw new ApiError(400, "invalid_param", "Send minutes: [..] (1–4 values ≤ 120) or km: [..] (1–4 values ≤ 100)");
  }
  const { costing, costing_options } = costingFor(profile, body);
  const sorted = values.map(Number).sort((a, b) => a - b);
  const data = await valhalla("isochrone", {
    locations: [location],
    costing,
    costing_options,
    contours: sorted.map((v, i) => ({ [byTime ? "time" : "distance"]: v, color: COLORS[i].slice(1) })),
    polygons: true,
    denoise: 0.3,
    generalize: 40,
  });
  return {
    type: "FeatureCollection",
    features: (data.features || [])
      .filter((f) => f.geometry && f.geometry.type !== "Point")
      .map((f) => {
        const value = f.properties.contour;
        return {
          type: "Feature",
          geometry: f.geometry,
          properties: { [byTime ? "minutes" : "km"]: value, color: COLORS[sorted.indexOf(value)] || COLORS[0] },
        };
      }),
  };
});
