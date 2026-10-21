import { costingFor, normalizeMatrix, toLocation, valhalla } from "@/lib/engines/valhalla";
import { ApiError, apiRoute, points, preflight, readJson } from "@/lib/gateway";

export const OPTIONS = preflight;

export const POST = apiRoute("route.matrix", async (request, { meter }) => {
  const body = await readJson(request);
  const sources = points(body.sources, "sources", { min: 1, max: 50 });
  const targets = body.targets ? points(body.targets, "targets", { min: 1, max: 50 }) : sources;
  if (sources.length * targets.length > 2500) throw new ApiError(400, "too_large", "At most 2,500 elements");
  const profile = body.profile || "car";
  const { costing, costing_options } = costingFor(profile, body);
  const data = await valhalla("sources_to_targets", {
    sources: sources.map(toLocation),
    targets: targets.map(toLocation),
    costing,
    costing_options,
    units: "kilometers",
  });
  meter.units = sources.length * targets.length;
  return { profile, ...normalizeMatrix(data, sources.length, targets.length) };
});
