import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Portable data layer: SQLite locally (better-sqlite3), Postgres when DATABASE_URL is set.
// SQL is written once with `?` placeholders; they are rewritten to $1..$n for Postgres.

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'server',
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  allowed_origins TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS api_keys_org ON api_keys(org_id);
CREATE TABLE IF NOT EXISTS usage_daily (
  key_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  day TEXT NOT NULL,
  sku TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key_id, day, sku)
);
CREATE INDEX IF NOT EXISTS usage_daily_org ON usage_daily(org_id, day);
CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  mappin TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  digipin TEXT,
  props TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS places_org ON places(org_id);
CREATE TABLE IF NOT EXISTS geofences (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  geometry TEXT NOT NULL,
  props TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS geofences_org ON geofences(org_id);
`;

export function getDb() {
  // Cached on globalThis so dev hot-reloads don't open a new connection each time.
  globalThis.__nakshaDb ??= open();
  return globalThis.__nakshaDb;
}

async function open() {
  const url = process.env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//.test(url)) return openPostgres(url);
  return openSqlite(process.env.SQLITE_PATH || "data/naksha.db");
}

async function openSqlite(file) {
  const { default: Database } = await import("better-sqlite3");
  fs.mkdirSync(path.dirname(path.resolve(/*turbopackIgnore: true*/ file)), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.exec(SCHEMA);
  return {
    kind: "sqlite",
    all: async (sql, params = []) => sqlite.prepare(sql).all(...params),
    get: async (sql, params = []) => sqlite.prepare(sql).get(...params),
    run: async (sql, params = []) => ({ changes: sqlite.prepare(sql).run(...params).changes }),
    exec: async (sql) => sqlite.exec(sql),
  };
}

async function openPostgres(url) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX || 10) });
  const toPg = (sql) => {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  };
  const db = {
    kind: "postgres",
    all: async (sql, params = []) => (await pool.query(toPg(sql), params)).rows,
    get: async (sql, params = []) => (await pool.query(toPg(sql), params)).rows[0],
    run: async (sql, params = []) => ({ changes: (await pool.query(toPg(sql), params)).rowCount }),
    exec: async (sql) => {
      await pool.query(sql);
    },
  };
  await db.exec(SCHEMA);
  return db;
}

export const now = () => new Date().toISOString();
export const newId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
