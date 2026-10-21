import crypto from "node:crypto";
import { BRAND } from "./brand";
import { getDb, newId, now } from "./db";
import { getSecret, sha256 } from "./auth";

export const SYSTEM_ORG = { id: "org_system", name: "Naksha first-party", plan: "system" };
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomToken(length) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// kind: "server" (secret, any caller) or "browser" (restricted to allowed origins).
export async function createApiKey(orgId, { name, kind = "server", allowedOrigins = "" }) {
  const db = await getDb();
  const raw = `${BRAND.keyPrefix}_${kind === "browser" ? "pub" : "sk"}_${randomToken(32)}`;
  const row = {
    id: newId("key"),
    org_id: orgId,
    name: name || "Untitled key",
    kind,
    prefix: raw.slice(0, 12),
    key_hash: sha256(raw),
    allowed_origins: kind === "browser" ? normalizeOrigins(allowedOrigins) : "",
    created_at: now(),
  };
  await db.run(
    `INSERT INTO api_keys (id, org_id, name, kind, prefix, key_hash, allowed_origins, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.org_id, row.name, row.kind, row.prefix, row.key_hash, row.allowed_origins, row.created_at]
  );
  return { ...publicKey(row), key: raw };
}

export async function listApiKeys(orgId) {
  const db = await getDb();
  const rows = await db.all(
    "SELECT * FROM api_keys WHERE org_id = ? AND revoked_at IS NULL ORDER BY created_at DESC",
    [orgId]
  );
  return rows.map(publicKey);
}

export async function revokeApiKey(orgId, id) {
  const db = await getDb();
  const { changes } = await db.run(
    "UPDATE api_keys SET revoked_at = ? WHERE id = ? AND org_id = ? AND revoked_at IS NULL",
    [now(), id, orgId]
  );
  return changes > 0;
}

// The key the first-party /maps explorer uses. Derived from the server secret,
// so it never needs to be stored in plaintext and is stable across restarts.
export function firstPartyKey() {
  const digest = crypto.createHmac("sha256", getSecret()).update("first-party-browser-key").digest("base64url");
  return `${BRAND.keyPrefix}_pub_fp${digest.replace(/[-_]/g, "").slice(0, 30)}`;
}

export async function findKey(raw) {
  if (raw === firstPartyKey()) {
    return { id: "key_first_party", org_id: SYSTEM_ORG.id, kind: "browser", allowed_origins: "self", plan: "system" };
  }
  const db = await getDb();
  return db.get(
    `SELECT k.*, o.plan FROM api_keys k JOIN orgs o ON o.id = k.org_id
      WHERE k.key_hash = ? AND k.revoked_at IS NULL`,
    [sha256(raw)]
  );
}

function normalizeOrigins(value) {
  return String(value || "")
    .split(/[\s,]+/)
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean)
    .join(",");
}

function publicKey(row) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    prefix: row.prefix,
    allowedOrigins: row.allowed_origins ? row.allowed_origins.split(",") : [],
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at || null,
  };
}
