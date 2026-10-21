import { ApiError, apiRoute, preflight } from "@/lib/gateway";
import { deleteGeofence } from "@/lib/geofences";

export const OPTIONS = preflight;

export const DELETE = apiRoute("geofence.write", async (request, { auth, params }) => {
  if (!(await deleteGeofence(auth.orgId, params.id))) throw new ApiError(404, "not_found", "No such geofence");
  return { deleted: true };
});
