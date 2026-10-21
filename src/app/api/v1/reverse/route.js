import { tryDigipin } from "@/lib/digipin";
import { reverse } from "@/lib/engines/photon";
import { apiRoute, number, preflight } from "@/lib/gateway";
import { hasPincodeData, pincodeAt } from "@/lib/pincode";

export const OPTIONS = preflight;

export const GET = apiRoute("search.reverse", async (request) => {
  const url = new URL(request.url);
  const lat = number(url.searchParams.get("lat"), "lat", { min: -90, max: 90 });
  const lon = number(url.searchParams.get("lon"), "lon", { min: -180, max: 180 });
  const place = await reverse(lat, lon);
  const pin = (await hasPincodeData()) ? await pincodeAt(lat, lon, { osmPostcode: place?.address?.postcode }) : null;
  if (place && pin) {
    const osm = place.address?.postcode;
    place.pincode = pin.pincode;
    place.address = { ...place.address, postcode: pin.pincode };
    if (osm && osm !== pin.pincode) place.address.osm_postcode = osm;
  }
  return {
    lat,
    lon,
    digipin: tryDigipin(lat, lon),
    pincode: pin
      ? { pincode: pin.pincode, district: pin.district, state: pin.state, method: pin.method, confidence: pin.confidence }
      : null,
    result: place,
  };
});
