// DIGIPIN — India Post's national addressing grid (Apache-2.0 algorithm,
// https://github.com/INDIAPOST-gov/digipin). Re-implemented here.
// India's bounding box is split 4x4 ten times; each level contributes one symbol,
// giving a ~3.8m x 3.8m cell for a 10-character code.

const GRID = ["FC98", "J327", "K456", "LMPT"];
const BOUNDS = { minLat: 2.5, maxLat: 38.5, minLon: 63.5, maxLon: 99.5 };
const SYMBOLS = new Set(GRID.join(""));

export function inDigipinBounds(lat, lon) {
  return lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lon >= BOUNDS.minLon && lon <= BOUNDS.maxLon;
}

export function encodeDigipin(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inDigipinBounds(lat, lon)) {
    throw new RangeError("Coordinates are outside the DIGIPIN area (lat 2.5–38.5, lon 63.5–99.5)");
  }
  let { minLat, maxLat, minLon, maxLon } = BOUNDS;
  let code = "";
  for (let level = 0; level < 10; level++) {
    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;
    // Rows run north to south, so the row index is reversed against latitude.
    const row = clamp(3 - Math.floor((lat - minLat) / latDiv));
    const col = clamp(Math.floor((lon - minLon) / lonDiv));
    code += GRID[row][col];
    maxLat = minLat + latDiv * (4 - row);
    minLat = minLat + latDiv * (3 - row);
    minLon = minLon + lonDiv * col;
    maxLon = minLon + lonDiv;
  }
  return code;
}

export function normalizeDigipin(input) {
  const code = String(input || "").toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== 10 || [...code].some((c) => !SYMBOLS.has(c))) return null;
  return code;
}

export function decodeDigipin(input) {
  const code = normalizeDigipin(input);
  if (!code) throw new RangeError("Invalid DIGIPIN: expected 10 characters from 2-9, C, F, J, K, L, M, P, T");
  let { minLat, maxLat, minLon, maxLon } = BOUNDS;
  for (const ch of code) {
    const row = GRID.findIndex((r) => r.includes(ch));
    const col = GRID[row].indexOf(ch);
    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;
    const lat1 = maxLat - latDiv * (row + 1);
    const lat2 = maxLat - latDiv * row;
    const lon1 = minLon + lonDiv * col;
    minLat = lat1;
    maxLat = lat2;
    minLon = lon1;
    maxLon = lon1 + lonDiv;
  }
  return {
    digipin: code,
    lat: round6((minLat + maxLat) / 2),
    lon: round6((minLon + maxLon) / 2),
    bbox: [minLon, minLat, maxLon, maxLat],
  };
}

// Display form used by India Post: XXX-XXX-XXXX
export function formatDigipin(code) {
  const c = normalizeDigipin(code);
  return c ? `${c.slice(0, 3)}-${c.slice(3, 6)}-${c.slice(6)}` : null;
}

export function tryDigipin(lat, lon) {
  return inDigipinBounds(lat, lon) ? encodeDigipin(lat, lon) : null;
}

function clamp(v) {
  return Math.max(0, Math.min(3, v));
}

function round6(v) {
  return Math.round(v * 1e6) / 1e6;
}
