import { SKUS } from "./catalog";
import { getDb, now } from "./db";

// Admin-editable platform settings stored as JSON in the `settings` table.
// `api_overrides`: { [sku]: { disabled?: boolean, inrPer1k?: number, note?: string } }

const TTL_MS = 15_000;
const cache = (globalThis.__heisynSettings ??= new Map());

export async function getSetting(key, fallback = null) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const db = await getDb();
  const row = await db.get("SELECT value FROM settings WHERE key = ?", [key]);
  const value = row ? JSON.parse(row.value) : fallback;
  cache.set(key, { value, at: Date.now() });
  return value;
}

export async function setSetting(key, value) {
  const db = await getDb();
  await db.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), now()]
  );
  cache.set(key, { value, at: Date.now() });
}

export async function getApiOverrides() {
  return getSetting("api_overrides", {});
}

export async function setApiOverride(sku, patch) {
  const all = { ...(await getApiOverrides()) };
  all[sku] = { ...(all[sku] || {}), ...patch };
  await setSetting("api_overrides", all);
  return all[sku];
}

// The catalogue SKUs with admin overrides applied.
export async function effectiveSkus() {
  const overrides = await getApiOverrides();
  return Object.fromEntries(
    Object.entries(SKUS).map(([id, sku]) => {
      const o = overrides[id] || {};
      return [id, { ...sku, inrPer1k: o.inrPer1k ?? sku.inrPer1k, disabled: Boolean(o.disabled), note: o.note || null }];
    })
  );
}
