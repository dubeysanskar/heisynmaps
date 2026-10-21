import { apiRoute, points, preflight, readJson } from "@/lib/gateway";
import { checkPoints } from "@/lib/geofences";

export const OPTIONS = preflight;

export const POST = apiRoute("geofence.check", async (request, { auth, meter }) => {
  const body = await readJson(request);
  const pts = points(body.points, "points", { min: 1, max: 1000 });
  meter.units = pts.length;
  return { results: await checkPoints(auth.orgId, pts) };
});
