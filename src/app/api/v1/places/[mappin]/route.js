import { ApiError, apiRoute, preflight } from "@/lib/gateway";
import { deletePlace, getPlace } from "@/lib/places";

export const OPTIONS = preflight;

export const GET = apiRoute("places.read", async (request, { auth, params }) => {
  const place = await getPlace(auth.orgId, params.mappin);
  if (!place) throw new ApiError(404, "not_found", "No place with this MapPIN");
  return { place };
});

export const DELETE = apiRoute("places.write", async (request, { auth, params }) => {
  if (!(await deletePlace(auth.orgId, params.mappin))) throw new ApiError(404, "not_found", "No place with this MapPIN");
  return { deleted: true };
});
