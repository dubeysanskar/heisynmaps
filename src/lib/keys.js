import crypto from "node:crypto";
import { BRAND } from "./brand";
import { API_GROUPS } from "./catalog";
import { getDb, newId, now } from "./db";
import { getSecret, sha256 } from "./auth";

export const SYSTEM_ORG = { id: "org_system", name: "Naksha first-party", plan: "system" };
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomToken(length) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

function rawKey(kind) {
  return `${BRAND.keyPrefix}_${kind === "browser" ? "pub" : "sk"}_${randomToken(32)}`;
}

// Validates and normalises the restriction fields shared by create and update.
export function normalizeKeyInput(input, { partial = false } = {}) {
  const out = {};
  if (!partial || input.name !== undefined) out.name = String(input.name || "").trim().slice(0, 80) || "Untitled key";
  if (input.allowedOrigins !== undefined) out.allowed_origins = list(input.allowedOrigins).map((o) => o.replace(/\/$/, "")).join(",");
  if (input.allowedIps !== undefined) {
    const ips = list(input.allowedIps);
    const bad = ips.find((ip) => !/^[0-9a-fA-F:.]+(\/\d{1,3})?$/.test(ip));
    if (bad) throw new Error(`"${bad}" is not an IP address or CIDR range`);
    out.allowed_ips = ips.join(",");
  }
  if (input.scopes !== undefined) {
    const scopes = list(input.scopes);
    const bad = scopes.find((s) => !API_GROUPS[s]);
    if (bad) throw new Error(`Unknown scope "${bad}"`);
    out.scopes = scopes.length === Object.keys(API_GROUPS).length ? "" : scopes.join(",");
  }
  if (input.rpmLimit !== undefined) out.rpm_limit = positiveOrNull(input.rpmLimit, "Requests per minute");
  if (input.dailyQuota !== undefined) out.daily_quota = positiveOrNull(input.dailyQuota, "Daily quota");
  if (input.expiresAt !== undefined) {
    if (!input.expiresAt) out.expires_at = null;
    else {
      const d = new Date(input.expiresAt);
      if (Number.isNaN(d.getTime())) throw new Error("Expiry date is invalid");
      if (d.getTime() < Date.now()) throw new Error("Expiry date must be in the future");
      out.expires_at = d.toISOString();
    }
  }
  return out;
}

// kind: "server" (secret, any caller) or "browser" (restricted to allowed origins).
export async function createApiKey(orgId, input) {
  const kind = input.kind === "browser" ? "browser" : "server";
  const fields = normalizeKeyInput({ scopes: [], allowedOrigins: "", allowedIps: "", ...input });
  if (kind === "browser" && !fields.allowed_origins) throw new Error("Browser keys need at least one allowed origin");
  if (kind === "browser") fields.allowed_ips = "";
  if (kind === "server") fields.allowed_origins = "";
  const raw = rawKey(kind);
  const row = {
    id: newId("key"),
    org_id: orgId,
    kind,
    prefix: raw.slice(0, 12),
    key_hash: sha256(raw),
    created_at: now(),
    ...fields,
  };
  const db = await getDb();
  await db.run(
    `INSERT INTO api_keys (id, org_id, name, kind, prefix, key_hash, allowed_origins, allowed_ips, scopes,
                           rpm_limit, daily_quota, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.org_id,
      row.name,
      row.kind,
      row.prefix,
      row.key_hash,
      row.allowed_origins || "",
      row.allowed_ips || "",
      row.scopes || "",
      row.rpm_limit ?? null,
      row.daily_quota ?? null,
      row.expires_at ?? null,
      row.created_at,
    ]
  );
  return { ...publicKey(row), key: raw };
}

export async function getApiKey(orgId, id) {
  const db = await getDb();
  const row = await db.get("SELECT * FROM api_keys WHERE id = ? AND org_id = ? AND revoked_at IS NULL", [id, orgId]);
  return row ? publicKey(row) : null;
}

export async function listApiKeys(orgId) {
  const db = await getDb();
  const rows = await db.all(
    "SELECT * FROM api_keys WHERE org_id = ? AND revoked_at IS NULL ORDER BY created_at DESC",
    [orgId]
  );
  return rows.map(publicKey);
}

export async function updateApiKey(orgId, id, input) {
  const db = await getDb();
  const current = await db.get("SELECT * FROM api_keys WHERE id = ? AND org_id = ? AND revoked_at IS NULL", [id, orgId]);
  if (!current) return null;
  const fields = normalizeKeyInput(input, { partial: true });
  if (current.kind === "browser") delete fields.allowed_ips;
  if (current.kind === "server") delete fields.allowed_origins;
  if (current.kind === "browser" && fields.allowed_origins === "") throw new Error("Browser keys need at least one allowed origin");
  if (input.disabled !== undefined) fields.disabled_at = input.disabled ? now() : null;
  const cols = Object.keys(fields);
  if (cols.length) {
    await db.run(`UPDATE api_keys SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ? AND org_id = ?`, [
      ...cols.map((c) => fields[c]),
      id,
      orgId,
    ]);
  }
  invalidateKeyCache();
  return getApiKey(orgId, id);
}

// New secret, same settings. The old secret stops working immediately.
export async function rotateApiKey(orgId, id) {
  const db = await getDb();
  const current = await db.get("SELECT * FROM api_keys WHERE id = ? AND org_id = ? AND revoked_at IS NULL", [id, orgId]);
  if (!current) return null;
  const raw = rawKey(current.kind);
  await db.run("UPDATE api_keys SET key_hash = ?, prefix = ? WHERE id = ?", [sha256(raw), raw.slice(0, 12), id]);
  invalidateKeyCache();
  return { ...(await getApiKey(orgId, id)), key: raw };
}

export async function revokeApiKey(orgId, id) {
  const db = await getDb();
  const { changes } = await db.run(
    "UPDATE api_keys SET revoked_at = ? WHERE id = ? AND org_id = ? AND revoked_at IS NULL",
    [now(), id, orgId]
  );
  invalidateKeyCache();
  return changes > 0;
}

// The key the first-party /maps explorer and docs use. Derived from the server secret,
// so it never needs to be stored in plaintext and is stable across restarts.
export function firstPartyKey() {
  const digest = crypto.createHmac("sha256", getSecret()).update("first-party-browser-key").digest("base64url");
  return `${BRAND.keyPrefix}_pub_fp${digest.replace(/[-_]/g, "").slice(0, 30)}`;
}

// ---------- lookup (cached briefly; every mutation clears the cache) ----------

const keyCache = (globalThis.__nakshaKeyCache ??= new Map());
const KEY_TTL_MS = 30_000;

export function invalidateKeyCache() {
  keyCache.clear();
}

export async function findKey(raw) {
  if (raw === firstPartyKey()) {
    return {
      id: "key_first_party",
      org_id: SYSTEM_ORG.id,
      kind: "browser",
      allowed_origins: "self",
      allowed_ips: "",
      scopes: "",
      plan: "system",
      org_status: "active",
    };
  }
  const hash = sha256(raw);
  const hit = keyCache.get(hash);
  if (hit && Date.now() - hit.at < KEY_TTL_MS) return hit.row;
  const db = await getDb();
  const row = await db.get(
    `SELECT k.*, o.plan, o.status AS org_status, o.rpm_override, o.quota_override
       FROM api_keys k JOIN orgs o ON o.id = k.org_id
      WHERE k.key_hash = ? AND k.revoked_at IS NULL`,
    [hash]
  );
  if (keyCache.size > 10000) keyCache.clear();
  keyCache.set(hash, { row: row || null, at: Date.now() });
  return row || null;
}

// ---------- helpers ----------

function list(value) {
  const items = Array.isArray(value) ? value : String(value || "").split(/[\s,]+/);
  return items.map((v) => String(v).trim()).filter(Boolean);
}

function positiveOrNull(value, label) {
  if (value === null || value === "" || value === undefined) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${label} must be a whole number above 0`);
  return n;
}

export function publicKey(row) {
  const split = (v) => (v ? String(v).split(",").filter(Boolean) : []);
  const expired = row.expires_at && row.expires_at < now();
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    kind: row.kind,
    prefix: row.prefix,
    allowedOrigins: split(row.allowed_origins),
    allowedIps: split(row.allowed_ips),
    scopes: split(row.scopes),
    rpmLimit: row.rpm_limit ?? null,
    dailyQuota: row.daily_quota ?? null,
    expiresAt: row.expires_at || null,
    status: row.disabled_at ? "disabled" : expired ? "expired" : "active",
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at || null,
  };
}
