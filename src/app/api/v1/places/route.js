import { apiRoute, number, point, preflight, readJson } from "@/lib/gateway";
import { createPlace, listPlaces } from "@/lib/places";

export const OPTIONS = preflight;

export const GET = apiRoute("places.read", async (request, { auth }) => {
  const url = new URL(request.url);
  const limit = number(url.searchParams.get("limit"), "limit", { min: 1, max: 500, fallback: 100 });
  const offset = number(url.searchParams.get("offset"), "offset", { min: 0, fallback: 0 });
  return { places: await listPlaces(auth.orgId, { limit, offset }) };
});

export const POST = apiRoute("places.write", async (request, { auth }) => {
  const body = await readJson(request);
  const { lat, lon } = point(body, "place");
  return Response.json({ place: await createPlace(auth.orgId, { ...body, lat, lon }) }, { status: 201 });
});
