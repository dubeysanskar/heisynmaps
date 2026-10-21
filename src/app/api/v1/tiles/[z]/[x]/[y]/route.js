import { getTile } from "@/lib/engines/tiles";
import { ApiError, apiRoute, preflight } from "@/lib/gateway";

export const OPTIONS = preflight;

export const GET = apiRoute(
  "maps.tiles",
  async (request, { params }) => {
    const z = Number.parseInt(params.z, 10);
    const x = Number.parseInt(params.x, 10);
    const y = Number.parseInt(params.y, 10); // "123.pbf" → 123
    if (![z, x, y].every(Number.isInteger) || z < 0 || z > 22) {
      throw new ApiError(400, "invalid_tile", "Tile coordinates are invalid");
    }
    const tile = await getTile(z, x, y);
    if (!tile) return new Response(null, { status: 204, headers: { "Cache-Control": "public, max-age=86400" } });
    return new Response(tile, {
      headers: {
        "Content-Type": "application/x-protobuf",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  },
  { checkOrigin: false }
);
