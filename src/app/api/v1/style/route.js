import fs from "node:fs";
import path from "node:path";
import { BRAND } from "@/lib/brand";
import { config, glyphsFor } from "@/lib/config";
import { vectorSource } from "@/lib/engines/tiles";
import { apiRoute, preflight, publicOrigin } from "@/lib/gateway";
import { buildStyle, THEME_NAMES } from "@/lib/style";

export const OPTIONS = preflight;

export const GET = apiRoute("maps.load", async (request, { auth }) => {
  const url = new URL(request.url);
  const theme = THEME_NAMES.includes(url.searchParams.get("theme")) ? url.searchParams.get("theme") : "light";
  const origin = publicOrigin(request);
  const boundaryFile = path.resolve(/*turbopackIgnore: true*/ config.indiaBoundaryGeojson);
  const style = buildStyle({
    theme,
    name: BRAND.product,
    source: vectorSource(origin, auth.raw),
    glyphs: glyphsFor(origin),
    // Served from /public when present — see docs/PRD.md §7 (official boundary of India).
    indiaBoundaryUrl: fs.existsSync(boundaryFile) ? `${origin}/data/india-boundary.geojson` : null,
  });
  return Response.json(style, { headers: { "Cache-Control": "private, max-age=300" } });
});
