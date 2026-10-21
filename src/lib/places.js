import crypto from "node:crypto";
import { getDb, newId, now } from "./db";
import { tryDigipin } from "./digipin";
import { ApiError } from "./gateway";

// MapPIN: a short 6-character code for a saved place (our answer to Mappls' eLoc).
// No 0/O/1/I, so codes survive being read out over the phone to a rider.
const MAPPIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const MAPPIN_RE = /^[A-HJ-NP-Z2-9]{6}$/i;

function randomMappin() {
  return Array.from(crypto.randomBytes(6), (b) => MAPPIN_ALPHABET[b % 32]).join("");
}

export async function createPlace(orgId, { name, lat, lon, category, address, props }) {
  if (!name || typeof name !== "string") throw new ApiError(400, "invalid_param", "name is required");
  const db = await getDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = {
      id: newId("plc"),
      mappin: randomMappin(),
      name: name.slice(0, 200),
      category: category ? String(category).slice(0, 60) : null,
      address: address ? String(address).slice(0, 500) : null,
      props: JSON.stringify(props && typeof props === "object" ? props : {}),
    };
    try {
      await db.run(
        `INSERT INTO places (id, org_id, mappin, name, category, address, lat, lon, digipin, props, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, orgId, row.mappin, row.name, row.category, row.address, lat, lon, tryDigipin(lat, lon), row.props, now()]
      );
      return getPlace(orgId, row.mappin);
    } catch (err) {
      if (!/unique|duplicate/i.test(err.message)) throw err; // retry only on a MapPIN collision
    }
  }
  throw new ApiError(500, "mappin_exhausted", "Could not allocate a MapPIN");
}

export async function getPlace(orgId, mappin) {
  const db = await getDb();
  const row = await db.get("SELECT * FROM places WHERE org_id = ? AND mappin = ?", [orgId, String(mappin).toUpperCase()]);
  return row ? toPlace(row) : null;
}

export async function listPlaces(orgId, { limit = 100, offset = 0 } = {}) {
  const db = await getDb();
  const rows = await db.all("SELECT * FROM places WHERE org_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?", [
    orgId,
    limit,
    offset,
  ]);
  return rows.map(toPlace);
}

export async function deletePlace(orgId, mappin) {
  const db = await getDb();
  const { changes } = await db.run("DELETE FROM places WHERE org_id = ? AND mappin = ?", [
    orgId,
    String(mappin).toUpperCase(),
  ]);
  return changes > 0;
}

// Text match over the org's own places, shown ahead of OSM results.
export async function searchPlaces(orgId, q, limit = 5) {
  const text = String(q || "").trim().toLowerCase();
  if (!text) return [];
  const db = await getDb();
  const like = `%${text.replace(/[%_]/g, "")}%`;
  const rows = await db.all(
    `SELECT * FROM places WHERE org_id = ?
       AND (LOWER(name) LIKE ? OR LOWER(COALESCE(address, '')) LIKE ? OR LOWER(mappin) = ?)
     ORDER BY created_at DESC LIMIT ?`,
    [orgId, like, like, text, limit]
  );
  return rows.map((r) => toResult(toPlace(r)));
}

export function toPlace(row) {
  return {
    mappin: row.mappin,
    name: row.name,
    category: row.category,
    address: row.address,
    lat: Number(row.lat),
    lon: Number(row.lon),
    digipin: row.digipin,
    props: JSON.parse(row.props || "{}"),
    created_at: row.created_at,
  };
}

// Same shape as a search result from the OSM geocoder.
export function toResult(place) {
  return {
    id: `mappin:${place.mappin}`,
    source: "org",
    name: place.name,
    label: [place.name, place.address].filter(Boolean).join(", "),
    category: place.category ? `place:${place.category}` : "place:saved",
    type: "saved_place",
    address: { full: place.address || null },
    lat: place.lat,
    lon: place.lon,
    digipin: place.digipin,
    mappin: place.mappin,
  };
}
