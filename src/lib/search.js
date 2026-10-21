import { NCR } from "./brand";
import { decodeDigipin, formatDigipin, normalizeDigipin } from "./digipin";
import { search } from "./engines/photon";
import { getPlace, MAPPIN_RE, searchPlaces, toResult } from "./places";
import { ApiError, number } from "./gateway";
import { haversine } from "./geo";
import {
  extractPincode,
  getPincodeSummary,
  hasPincodeData,
  normalizePincode,
  pincodeAt,
  pincodeResult,
  searchPincodes,
} from "./pincode";

export function searchParams(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) throw new ApiError(400, "invalid_param", "q is required");
  if (q.length > 200) throw new ApiError(400, "invalid_param", "q is too long");
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  return {
    q,
    // Bias towards Delhi NCR unless the caller says otherwise.
    lat: lat ? number(lat, "lat", { min: -90, max: 90 }) : NCR.center[1],
    lon: lon ? number(lon, "lon", { min: -180, max: 180 }) : NCR.center[0],
    limit: number(url.searchParams.get("limit"), "limit", { min: 1, max: 20, fallback: 8 }),
  };
}

// Order of precedence: DIGIPIN / PIN code → the org's MapPIN → the org's saved places → OSM.
export async function runSearch(orgId, { q, lat, lon, limit }) {
  const results = [];
  const pinData = await hasPincodeData();
  const digipin = normalizeDigipin(q);
  if (digipin) {
    const d = decodeDigipin(digipin);
    results.push({
      id: `digipin:${digipin}`,
      source: "digipin",
      name: `DIGIPIN ${formatDigipin(digipin)}`,
      label: `DIGIPIN ${formatDigipin(digipin)} (${d.lat}, ${d.lon})`,
      category: "address:digipin",
      type: "digipin",
      address: {},
      lat: d.lat,
      lon: d.lon,
      digipin,
    });
  }

  // PIN codes: "110001" → that PIN; "1100" → PIN suggestions. Both skip OSM, whose bare
  // numeric postcodes are mostly other countries' (110001 is also a Taipei postcode).
  const pin = normalizePincode(q);
  const pinPrefix = !pin && /^[1-9]\d{2,4}$/.test(q.replace(/\s/g, ""));
  if (pinData && pin) {
    const s = await getPincodeSummary(pin);
    if (s) results.push(pincodeResult(s));
  } else if (pinData && pinPrefix) {
    for (const s of await searchPincodes(q, { limit: Math.min(limit, 8) })) results.push(pincodeResult(s));
  }

  if (MAPPIN_RE.test(q)) {
    const place = await getPlace(orgId, q);
    if (place) results.push(toResult(place));
  }
  const own = await searchPlaces(orgId, q, Math.min(limit, 5));
  for (const r of own) if (!results.some((x) => x.id === r.id)) results.push(r);

  if (!(pinData && (pin || pinPrefix))) {
    // "lajpat nagar 110024": search the words inside that PIN area and prefer matches there.
    const inText = pinData && !digipin ? extractPincode(q) : null;
    const area = inText ? await getPincodeSummary(inText) : null;
    const text = area ? q.replace(/[1-9]\d{2}\s?\d{3}/, " ").replace(/[\s,]+/g, " ").trim() : q;
    const focus = area?.center || { lat, lon };

    let osm = [];
    try {
      osm = text ? await search(text, { lat: focus.lat, lon: focus.lon, limit, bbox: area?.bbox ? pad(area.bbox, 0.03) : undefined }) : [];
      if (area && !osm.length && text) osm = await search(text, { lat: focus.lat, lon: focus.lon, limit });
      // Indian queries often end in a city qualifier OSM spells differently
      // ("sector 29 gurgaon" vs Gurugram); retry once without the last word, but only
      // near the user so a looser query can't jump to another country.
      const words = text.split(/\s+/);
      if (!osm.length && words.length > 1) {
        const bbox = [focus.lon - 1.5, focus.lat - 1.5, focus.lon + 1.5, focus.lat + 1.5];
        osm = await search(words.slice(0, -1).join(" "), { lat: focus.lat, lon: focus.lon, limit, bbox });
      }
    } catch (err) {
      // If the search engine is down but we already matched a saved place, MapPIN or PIN, answer with those.
      if (!results.length && !area) throw err;
    }
    osm = osm.filter((r) => !(r.category === "place:postcode" && r.address?.country_code !== "IN"));
    // Photon's location bias is soft; keep results within 200 km of the user first
    // so "cyber hub" from Delhi finds Gurugram, not a namesake abroad.
    const near = (r) => haversine(focus.lat, focus.lon, r.lat, r.lon) <= 200_000;
    if (area) await Promise.all(osm.map(addPincode)); // rank on the resolved PIN, not just OSM's
    const inPin = (r) => area && (r.pincode || normalizePincode(r.address?.postcode)) === area.pincode;
    osm = [...osm.filter(inPin), ...osm.filter((r) => !inPin(r) && near(r)), ...osm.filter((r) => !inPin(r) && !near(r))];
    for (const r of osm) {
      if (results.length >= limit) break;
      // Photon can return the same OSM object twice (e.g. node + address entry).
      if (!results.some((x) => x.id === r.id)) results.push(r);
    }
    if (area && results.length < limit && !results.some((x) => x.id === `pincode:${area.pincode}`)) {
      results.push(pincodeResult(area));
    }
  }

  const out = results.slice(0, limit);
  if (pinData) await Promise.all(out.map(addPincode));
  return out;
}

// Every Indian result carries a PIN, resolved like pincodeAt: official boundary first,
// then the postcode OSM has for the address, then the nearest post office.
export async function addPincode(result) {
  if (result.pincode !== undefined || !Number.isFinite(result.lat)) return result;
  const found = await pincodeAt(result.lat, result.lon, { osmPostcode: result.address?.postcode });
  result.pincode = found?.pincode || null;
  if (found) {
    result.pincode_source = found.method;
    const osm = result.address?.postcode;
    result.address = { ...(result.address || {}), postcode: found.pincode };
    if (osm && osm !== found.pincode) result.address.osm_postcode = osm; // keep what OSM said, for transparency
  }
  return result;
}

const pad = ([w, s, e, n], d) => [w - d, s - d, e + d, n + d];
