import { apiRoute, preflight, readJson } from "@/lib/gateway";
import { createGeofence, listGeofences } from "@/lib/geofences";

export const OPTIONS = preflight;

export const GET = apiRoute("geofence.read", async (request, { auth }) => ({
  geofences: await listGeofences(auth.orgId),
}));

export const POST = apiRoute("geofence.write", async (request, { auth }) => {
  const body = await readJson(request);
  return Response.json({ geofence: await createGeofence(auth.orgId, body) }, { status: 201 });
});
