import { tileJson } from "@/lib/engines/tiles";
import { ApiError, apiRoute, preflight, publicOrigin } from "@/lib/gateway";

export const OPTIONS = preflight;

export const GET = apiRoute(
  null,
  async (request, { auth }) => {
    const template = `${publicOrigin(request)}/api/v1/tiles/{z}/{x}/{y}.pbf?key=${encodeURIComponent(auth.raw)}`;
    const json = await tileJson(template);
    if (!json) throw new ApiError(404, "no_tiles", "No local tileset. Build one with scripts/data/build-tiles.sh");
    return Response.json(json, { headers: { "Cache-Control": "public, max-age=3600" } });
  },
  { checkOrigin: false }
);
