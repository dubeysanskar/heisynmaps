import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import circle from "@turf/circle";
import { getDb, newId, now } from "./db";
import { ApiError, point } from "./gateway";

export async function createGeofence(orgId, body) {
  const name = String(body.name || "").trim();
  if (!name) throw new ApiError(400, "invalid_param", "name is required");

  let geometry;
  if (body.center) {
    const c = point(body.center, "center");
    const radius = Number(body.radius_m);
    if (!Number.isFinite(radius) || radius <= 0 || radius > 100000) {
      throw new ApiError(400, "invalid_param", "radius_m must be between 0 and 100000");
    }
    geometry = circle([c.lon, c.lat], radius / 1000, { steps: 64, units: "kilometers" }).geometry;
  } else if (body.geometry && ["Polygon", "MultiPolygon"].includes(body.geometry.type)) {
    geometry = { type: body.geometry.type, coordinates: body.geometry.coordinates };
    if (JSON.stringify(geometry).length > 500_000) throw new ApiError(400, "too_large", "geometry is too large");
  } else {
    throw new ApiError(400, "invalid_param", "Provide a GeoJSON Polygon/MultiPolygon geometry, or center + radius_m");
  }

  const db = await getDb();
  const row = {
    id: newId("gf"),
    name: name.slice(0, 200),
    geometry: JSON.stringify(geometry),
    props: JSON.stringify(body.props && typeof body.props === "object" ? body.props : {}),
  };
  await db.run("INSERT INTO geofences (id, org_id, name, geometry, props, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    row.id,
    orgId,
    row.name,
    row.geometry,
    row.props,
    now(),
  ]);
  return toFence({ ...row, created_at: now() });
}

export async function listGeofences(orgId) {
  const db = await getDb();
  const rows = await db.all("SELECT * FROM geofences WHERE org_id = ? ORDER BY created_at DESC LIMIT 5000", [orgId]);
  return rows.map(toFence);
}

export async function deleteGeofence(orgId, id) {
  const db = await getDb();
  const { changes } = await db.run("DELETE FROM geofences WHERE org_id = ? AND id = ?", [orgId, id]);
  return changes > 0;
}

export async function checkPoints(orgId, pts) {
  const fences = (await listGeofences(orgId)).map((f) => ({ ...f, bbox: bboxOf(f.geometry) }));
  return pts.map((p, i) => {
    const inside = fences
      .filter((f) => p.lon >= f.bbox[0] && p.lat >= f.bbox[1] && p.lon <= f.bbox[2] && p.lat <= f.bbox[3])
      .filter((f) => booleanPointInPolygon([p.lon, p.lat], f.geometry))
      .map((f) => ({ id: f.id, name: f.name }));
    return { id: p.id ?? i, lat: p.lat, lon: p.lon, inside };
  });
}

function bboxOf(geometry) {
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      box[0] = Math.min(box[0], lon);
      box[1] = Math.min(box[1], lat);
      box[2] = Math.max(box[2], lon);
      box[3] = Math.max(box[3], lat);
    }
  }
  return box;
}

function toFence(row) {
  return {
    id: row.id,
    name: row.name,
    geometry: typeof row.geometry === "string" ? JSON.parse(row.geometry) : row.geometry,
    props: typeof row.props === "string" ? JSON.parse(row.props || "{}") : row.props,
    created_at: row.created_at,
  };
}
