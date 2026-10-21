import { CATEGORIES, search } from "@/lib/engines/photon";
import { ApiError, apiRoute, number, preflight } from "@/lib/gateway";
import { haversine } from "@/lib/geo";
import { hasPincodeData } from "@/lib/pincode";
import { addPincode } from "@/lib/search";

export const OPTIONS = preflight;

export const GET = apiRoute("search.nearby", async (request) => {
  const url = new URL(request.url);
  const lat = number(url.searchParams.get("lat"), "lat", { min: -90, max: 90 });
  const lon = number(url.searchParams.get("lon"), "lon", { min: -180, max: 180 });
  const radius = number(url.searchParams.get("radius"), "radius", { min: 100, max: 25000, fallback: 3000 });
  const limit = number(url.searchParams.get("limit"), "limit", { min: 1, max: 50, fallback: 20 });
  const category = CATEGORIES[url.searchParams.get("category")];
  if (!category) {
    throw new ApiError(400, "invalid_param", `category must be one of ${Object.keys(CATEGORIES).join(", ")}`);
  }
  const dLat = radius / 111320;
  const dLon = radius / (111320 * Math.cos((lat * Math.PI) / 180));
  const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
  const results = (await search("", { lat, lon, limit, bbox, include: category.include }))
    .map((r) => ({ ...r, distance_m: Math.round(haversine(lat, lon, r.lat, r.lon)) }))
    .filter((r) => r.distance_m <= radius)
    .sort((a, b) => a.distance_m - b.distance_m);
  if (await hasPincodeData()) await Promise.all(results.map(addPincode));
  return { category: url.searchParams.get("category"), radius_m: radius, results };
});
