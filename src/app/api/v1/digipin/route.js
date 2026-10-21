import { decodeDigipin, encodeDigipin, formatDigipin } from "@/lib/digipin";
import { ApiError, apiRoute, number, preflight } from "@/lib/gateway";

export const OPTIONS = preflight;

export const GET = apiRoute("address.digipin", async (request) => {
  const url = new URL(request.url);
  try {
    const code = url.searchParams.get("code");
    if (code) {
      const d = decodeDigipin(code);
      return { ...d, formatted: formatDigipin(d.digipin) };
    }
    const lat = number(url.searchParams.get("lat"), "lat", { min: -90, max: 90 });
    const lon = number(url.searchParams.get("lon"), "lon", { min: -180, max: 180 });
    const digipin = encodeDigipin(lat, lon);
    return { lat, lon, digipin, formatted: formatDigipin(digipin) };
  } catch (err) {
    if (err instanceof RangeError) throw new ApiError(400, "invalid_param", err.message);
    throw err;
  }
});
