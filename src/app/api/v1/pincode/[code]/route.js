import { ApiError, apiRoute, preflight } from "@/lib/gateway";
import { getPincode, hasPincodeData, normalizePincode } from "@/lib/pincode";

export const OPTIONS = preflight;

// GET /api/v1/pincode/110001?geometry=1
export const GET = apiRoute("address.pincode", async (request, { params }) => {
  if (!(await hasPincodeData())) {
    throw new ApiError(503, "pincode_data_missing", "PIN code data is not loaded on this server. Run npm run data:pincodes.");
  }
  const code = normalizePincode(params.code);
  if (!code) throw new ApiError(400, "invalid_param", "PIN code must be 6 digits, e.g. 110001");
  const geometry = new URL(request.url).searchParams.get("geometry") === "1";
  const detail = await getPincode(code, { geometry });
  if (!detail) throw new ApiError(404, "not_found", `No PIN code ${code}`);
  return detail;
});
