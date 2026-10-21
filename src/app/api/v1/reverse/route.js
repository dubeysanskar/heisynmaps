import { tryDigipin } from "@/lib/digipin";
import { reverse } from "@/lib/engines/photon";
import { apiRoute, number, preflight } from "@/lib/gateway";

export const OPTIONS = preflight;

export const GET = apiRoute("search.reverse", async (request) => {
  const url = new URL(request.url);
  const lat = number(url.searchParams.get("lat"), "lat", { min: -90, max: 90 });
  const lon = number(url.searchParams.get("lon"), "lon", { min: -180, max: 180 });
  const place = await reverse(lat, lon);
  return { lat, lon, digipin: tryDigipin(lat, lon), result: place };
});
