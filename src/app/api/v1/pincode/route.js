import { reverse } from "@/lib/engines/photon";
import { ApiError, apiRoute, number, preflight } from "@/lib/gateway";
import { getPincode, hasPincodeData, normalizePincode, pincodeAt, searchPincodes } from "@/lib/pincode";

export const OPTIONS = preflight;

// One endpoint, three modes:
//   ?code=110001         → that PIN's details and post offices
//   ?lat=…&lon=…         → the PIN code covering a point
//   ?q=1100 | lajpat     → PINs by prefix or by area / post-office name
export const GET = apiRoute("address.pincode", async (request) => {
  if (!(await hasPincodeData())) {
    throw new ApiError(503, "pincode_data_missing", "PIN code data is not loaded on this server. Run npm run data:pincodes.");
  }
  const url = new URL(request.url);
  const p = url.searchParams;

  if (p.has("code")) {
    const code = normalizePincode(p.get("code"));
    if (!code) throw new ApiError(400, "invalid_param", "code must be a 6-digit Indian PIN code");
    const detail = await getPincode(code, { geometry: p.get("geometry") === "1" });
    if (!detail) throw new ApiError(404, "not_found", `No PIN code ${code}`);
    return detail;
  }

  if (p.has("lat") || p.has("lon")) {
    const lat = number(p.get("lat"), "lat", { min: -90, max: 90 });
    const lon = number(p.get("lon"), "lon", { min: -180, max: 180 });
    // The nearest OSM address's postcode refines the guess where no boundary is loaded.
    const osm = await reverse(lat, lon).catch(() => null);
    const found = await pincodeAt(lat, lon, { osmPostcode: osm?.address?.postcode });
    if (!found) throw new ApiError(404, "not_found", "No PIN code found near this point (outside India?)");
    return { lat, lon, ...found };
  }

  const q = (p.get("q") || "").trim();
  if (!q) throw new ApiError(400, "invalid_param", "Pass code, lat & lon, or q");
  const limit = number(p.get("limit"), "limit", { min: 1, max: 50, fallback: 10 });
  return { query: q, results: await searchPincodes(q, { limit }) };
});
