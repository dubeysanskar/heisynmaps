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
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`;

// Append-only. Each entry runs once per database, in order.
const MIGRATIONS = [
  {
    id: 1,
    name: "roles, org controls, key restrictions, request log, settings, audit log",
    statements: [
      "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'",
      "ALTER TABLE orgs ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
      "ALTER TABLE orgs ADD COLUMN rpm_override INTEGER",
      "ALTER TABLE orgs ADD COLUMN quota_override INTEGER",
      "ALTER TABLE orgs ADD COLUMN notes TEXT",
      "ALTER TABLE api_keys ADD COLUMN scopes TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE api_keys ADD COLUMN allowed_ips TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE api_keys ADD COLUMN rpm_limit INTEGER",
      "ALTER TABLE api_keys ADD COLUMN daily_quota INTEGER",
      "ALTER TABLE api_keys ADD COLUMN expires_at TEXT",
      "ALTER TABLE api_keys ADD COLUMN disabled_at TEXT",
      `CREATE TABLE IF NOT EXISTS request_log (
        ts TEXT NOT NULL,
        org_id TEXT,
        key_id TEXT,
        sku TEXT,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status INTEGER NOT NULL,
        latency_ms INTEGER NOT NULL,
        ip TEXT,
        error_code TEXT
      )`,
      "CREATE INDEX IF NOT EXISTS request_log_ts ON request_log(ts)",
      "CREATE INDEX IF NOT EXISTS request_log_org ON request_log(org_id, ts)",
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS audit_log (
        ts TEXT NOT NULL,
        actor_id TEXT,
        actor_email TEXT,
        action TEXT NOT NULL,
        target TEXT,
        details TEXT
      )`,
      "CREATE INDEX IF NOT EXISTS audit_log_ts ON audit_log(ts)",
    ],
  },
  {
    id: 2,
    name: "India Post PIN codes: directory, per-PIN summary, boundaries",
    statements: [
      `CREATE TABLE IF NOT EXISTS pincodes (
        pincode TEXT PRIMARY KEY,
        district TEXT,
        state TEXT,
        circle TEXT,
        region TEXT,
        division TEXT,
        lat DOUBLE PRECISION,
        lon DOUBLE PRECISION,
        min_lon DOUBLE PRECISION,
        min_lat DOUBLE PRECISION,
        max_lon DOUBLE PRECISION,
        max_lat DOUBLE PRECISION,
        office_count INTEGER NOT NULL DEFAULT 0,
        delivery_offices INTEGER NOT NULL DEFAULT 0,
        has_boundary INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS pincode_offices (
        pincode TEXT NOT NULL,
        office_name TEXT NOT NULL,
        office_type TEXT,
        delivery INTEGER NOT NULL DEFAULT 0,
        district TEXT,
        state TEXT,
        lat DOUBLE PRECISION,
        lon DOUBLE PRECISION
      )`,
      "CREATE INDEX IF NOT EXISTS pincode_offices_pin ON pincode_offices(pincode)",
      `CREATE TABLE IF NOT EXISTS pincode_boundaries (
        pincode TEXT PRIMARY KEY,
        geometry TEXT NOT NULL,
        min_lon DOUBLE PRECISION NOT NULL,
        min_lat DOUBLE PRECISION NOT NULL,
        max_lon DOUBLE PRECISION NOT NULL,
        max_lat DOUBLE PRECISION NOT NULL,
        source TEXT
      )`,
    ],
  },
];

async function migrate(db) {
  const done = new Set((await db.all("SELECT id FROM schema_migrations")).map((r) => Number(r.id)));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    for (const sql of m.statements) {
      try {
        await db.exec(sql);
      } catch (err) {
        // A column may already exist if a previous run was interrupted.
        if (!/duplicate column|already exists/i.test(err.message)) throw err;
      }
    }
    await db.run("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)", [m.id, now()]);
  }
}

export function getDb() {
  // Cached on globalThis so dev hot-reloads don't open a new connection each time.
  globalThis.__heisynDb ??= open();
  return globalThis.__heisynDb;
}

async function open() {
  const url = process.env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//.test(url)) return openPostgres(url);
  return openSqlite(process.env.SQLITE_PATH || "data/heisyn.db");
}

async function openSqlite(file) {
  const { default: Database } = await import("better-sqlite3");
  fs.mkdirSync(path.dirname(path.resolve(/*turbopackIgnore: true*/ file)), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.exec(SCHEMA);
  const db = {
    kind: "sqlite",
    all: async (sql, params = []) => sqlite.prepare(sql).all(...params),
    get: async (sql, params = []) => sqlite.prepare(sql).get(...params),
    run: async (sql, params = []) => ({ changes: sqlite.prepare(sql).run(...params).changes }),
    exec: async (sql) => sqlite.exec(sql),
  };
  await migrate(db);
  return db;
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
  await migrate(db);
  return db;
}

export const now = () => new Date().toISOString();
export const newId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
