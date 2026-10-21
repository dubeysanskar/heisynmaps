import { PLANS, SKUS } from "./catalog";
import { config, engineMode, engineUrl } from "./config";
import { getDb } from "./db";
import { hasLocalTiles } from "./engines/tiles";
import { effectiveSkus } from "./settings";

// Read models for /admin. SQL is portable (SQLite + Postgres): `?` placeholders,
// ISO-string date comparisons, and Number() on aggregates (pg returns bigint strings).

const DAY_MS = 864e5;
export const today = () => new Date().toISOString().slice(0, 10);
export const monthStart = () => today().slice(0, 8) + "01";
const daysAgo = (n) => new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);
const hoursAgoIso = (h) => new Date(Date.now() - h * 3600_000).toISOString();
const n = (v) => Number(v) || 0;

export const SYSTEM_ORG_ID = "org_system";

export function orgLabel(id, name) {
  if (id === SYSTEM_ORG_ID) return "First-party (map & docs)";
  return name || id || "—";
}

export function keyLabel(keyId, name) {
  if (keyId === "key_first_party") return "First-party browser key";
  if (keyId?.startsWith("console_")) return "Console playground";
  return name || keyId || "—";
}

export function keyStatus(k) {
  if (k.revoked_at) return "revoked";
  if (k.disabled_at) return "disabled";
  if (k.expires_at && k.expires_at < new Date().toISOString()) return "expired";
  return "active";
}

function includedFor(org) {
  if (org.quota_override != null) return n(org.quota_override);
  return (PLANS[org.plan] || PLANS.free).includedPerSku;
}

// ---------- overview ----------

export async function overviewStats() {
  const db = await getDb();
  const [orgs, users, keys, todayRow, monthRow, since30Row, reqRow] = await Promise.all([
    db.get("SELECT COUNT(*) AS n, SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended FROM orgs"),
    db.get("SELECT COUNT(*) AS n, SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins FROM users"),
    db.get("SELECT COUNT(*) AS n FROM api_keys WHERE revoked_at IS NULL AND disabled_at IS NULL"),
    db.get("SELECT COALESCE(SUM(count), 0) AS n FROM usage_daily WHERE day = ?", [today()]),
    db.get("SELECT COALESCE(SUM(count), 0) AS n FROM usage_daily WHERE day >= ?", [monthStart()]),
    db.get("SELECT COALESCE(SUM(count), 0) AS n FROM usage_daily WHERE day >= ?", [daysAgo(29)]),
    db.get(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS server_errors,
              SUM(CASE WHEN status >= 400 AND status < 500 THEN 1 ELSE 0 END) AS client_errors
         FROM request_log WHERE ts >= ?`,
      [hoursAgoIso(24)]
    ),
  ]);
  const total = n(reqRow?.total);
  return {
    orgs: n(orgs?.n),
    suspendedOrgs: n(orgs?.suspended),
    users: n(users?.n),
    admins: n(users?.admins),
    activeKeys: n(keys?.n),
    callsToday: n(todayRow?.n),
    callsMonth: n(monthRow?.n),
    calls30: n(since30Row?.n),
    requests24h: total,
    serverErrors24h: n(reqRow?.server_errors),
    clientErrors24h: n(reqRow?.client_errors),
    errorRate24h: total ? n(reqRow?.server_errors) / total : 0,
    revenue: await overageRevenue(),
  };
}

// Estimated month-to-date overage, per org: (calls − included) × effective SKU price.
// Free plans are hard-capped, so they never bill overage.
export async function overageRevenue() {
  const db = await getDb();
  const [rows, skus] = await Promise.all([
    db.all(
      `SELECT d.org_id, d.sku, SUM(d.count) AS calls, o.plan, o.quota_override
         FROM usage_daily d JOIN orgs o ON o.id = d.org_id
        WHERE d.day >= ?
        GROUP BY d.org_id, d.sku, o.plan, o.quota_override`,
      [monthStart()]
    ),
    effectiveSkus(),
  ]);
  let totalInr = 0;
  const byOrg = {};
  for (const r of rows) {
    const plan = PLANS[r.plan] || PLANS.free;
    if (plan.hardCap) continue;
    const billable = Math.max(0, n(r.calls) - includedFor(r));
    if (!Number.isFinite(billable) || !billable) continue;
    const inr = (billable / 1000) * (skus[r.sku]?.inrPer1k || 0);
    totalInr += inr;
    byOrg[r.org_id] = (byOrg[r.org_id] || 0) + inr;
  }
  return { totalInr, byOrg };
}

export async function callsPerDay(days = 30, { orgId } = {}) {
  const db = await getDb();
  const since = daysAgo(days - 1);
  const rows = await db.all(
    `SELECT day, SUM(count) AS n FROM usage_daily WHERE day >= ?${orgId ? " AND org_id = ?" : ""} GROUP BY day`,
    orgId ? [since, orgId] : [since]
  );
  const map = new Map(rows.map((r) => [r.day, n(r.n)]));
  return Array.from({ length: days }, (_, i) => {
    const day = daysAgo(days - 1 - i);
    return { day, count: map.get(day) || 0 };
  });
}

export async function topOrgs(limit = 8) {
  const db = await getDb();
  const rows = await db.all(
    `SELECT d.org_id, o.name, o.plan, SUM(d.count) AS calls
       FROM usage_daily d LEFT JOIN orgs o ON o.id = d.org_id
      WHERE d.day >= ?
      GROUP BY d.org_id, o.name, o.plan
      ORDER BY calls DESC LIMIT ?`,
    [monthStart(), limit]
  );
  return rows.map((r) => ({ id: r.org_id, name: orgLabel(r.org_id, r.name), plan: r.plan || "system", calls: n(r.calls) }));
}

export async function topSkus(limit = 8) {
  const db = await getDb();
  const rows = await db.all(
    "SELECT sku, SUM(count) AS calls FROM usage_daily WHERE day >= ? GROUP BY sku ORDER BY calls DESC LIMIT ?",
    [monthStart(), limit]
  );
  return rows.map((r) => ({ sku: r.sku, label: SKUS[r.sku]?.label || r.sku, calls: n(r.calls) }));
}

// ---------- organisations ----------

export async function listOrgs({ q = "", limit = 50, offset = 0 } = {}) {
  const db = await getDb();
  const like = `%${String(q).trim().toLowerCase()}%`;
  const rows = await db.all(
    `SELECT o.*,
            (SELECT COUNT(*) FROM users u WHERE u.org_id = o.id) AS users,
            (SELECT COUNT(*) FROM api_keys k WHERE k.org_id = o.id AND k.revoked_at IS NULL) AS keys,
            (SELECT COALESCE(SUM(d.count), 0) FROM usage_daily d WHERE d.org_id = o.id AND d.day >= ?) AS calls
       FROM orgs o
      WHERE LOWER(o.name) LIKE ? OR LOWER(o.id) LIKE ?
         OR EXISTS (SELECT 1 FROM users u2 WHERE u2.org_id = o.id AND LOWER(u2.email) LIKE ?)
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?`,
    [monthStart(), like, like, like, limit + 1, offset]
  );
  return {
    orgs: rows.slice(0, limit).map((r) => ({ ...r, users: n(r.users), keys: n(r.keys), calls: n(r.calls) })),
    hasMore: rows.length > limit,
  };
}

export async function getOrg(id) {
  const db = await getDb();
  const org = await db.get("SELECT * FROM orgs WHERE id = ?", [id]);
  if (!org) return null;
  const [members, keys, usage, recent] = await Promise.all([
    db.all("SELECT id, email, name, role, created_at FROM users WHERE org_id = ? ORDER BY created_at", [id]),
    db.all(
      `SELECT k.*, (SELECT COALESCE(SUM(d.count), 0) FROM usage_daily d WHERE d.key_id = k.id AND d.day >= ?) AS calls_month
         FROM api_keys k WHERE k.org_id = ? ORDER BY k.created_at DESC`,
      [monthStart(), id]
    ),
    db.all("SELECT sku, SUM(count) AS calls FROM usage_daily WHERE org_id = ? AND day >= ? GROUP BY sku ORDER BY calls DESC", [
      id,
      monthStart(),
    ]),
    db.all("SELECT * FROM request_log WHERE org_id = ? ORDER BY ts DESC LIMIT 25", [id]),
  ]);
  const skus = await effectiveSkus();
  const included = includedFor(org);
  const plan = PLANS[org.plan] || PLANS.free;
  return {
    org: { ...org, included, planInfo: plan },
    members,
    keys: keys.map((k) => ({ ...k, status: keyStatus(k), calls_month: n(k.calls_month) })),
    usage: usage.map((u) => {
      const calls = n(u.calls);
      const billable = plan.hardCap ? 0 : Math.max(0, calls - included);
      return {
        sku: u.sku,
        label: SKUS[u.sku]?.label || u.sku,
        calls,
        included,
        overageInr: Number.isFinite(billable) ? (billable / 1000) * (skus[u.sku]?.inrPer1k || 0) : 0,
      };
    }),
    recent,
  };
}

// ---------- users ----------

export async function listUsers({ q = "", limit = 100, offset = 0 } = {}) {
  const db = await getDb();
  const like = `%${String(q).trim().toLowerCase()}%`;
  const rows = await db.all(
    `SELECT u.id, u.email, u.name, u.role, u.created_at, u.org_id, o.name AS org_name, o.plan, o.status AS org_status
       FROM users u LEFT JOIN orgs o ON o.id = u.org_id
      WHERE LOWER(u.email) LIKE ? OR LOWER(COALESCE(u.name, '')) LIKE ? OR LOWER(COALESCE(o.name, '')) LIKE ?
      ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [like, like, like, limit + 1, offset]
  );
  return { users: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function adminCount() {
  const db = await getDb();
  return n((await db.get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'"))?.n);
}

// ---------- keys ----------

export async function listAllKeys({ q = "", status = "", limit = 100, offset = 0 } = {}) {
  const db = await getDb();
  const like = `%${String(q).trim().toLowerCase()}%`;
  const statusSql = {
    active: " AND k.revoked_at IS NULL AND k.disabled_at IS NULL AND (k.expires_at IS NULL OR k.expires_at >= ?)",
    disabled: " AND k.revoked_at IS NULL AND k.disabled_at IS NOT NULL",
    expired: " AND k.revoked_at IS NULL AND k.disabled_at IS NULL AND k.expires_at < ?",
    revoked: " AND k.revoked_at IS NOT NULL",
  }[status];
  const params = [today(), like, like, like];
  if (status === "active" || status === "expired") params.push(new Date().toISOString());
  params.push(limit + 1, offset);
  const rows = await db.all(
    `SELECT k.*, o.name AS org_name,
            (SELECT COALESCE(SUM(d.count), 0) FROM usage_daily d WHERE d.key_id = k.id AND d.day = ?) AS calls_today
       FROM api_keys k LEFT JOIN orgs o ON o.id = k.org_id
      WHERE (LOWER(k.name) LIKE ? OR LOWER(k.prefix) LIKE ? OR LOWER(COALESCE(o.name, '')) LIKE ?)${statusSql || ""}
      ORDER BY k.created_at DESC LIMIT ? OFFSET ?`,
    params
  );
  return {
    keys: rows.slice(0, limit).map((k) => ({ ...k, status: keyStatus(k), calls_today: n(k.calls_today) })),
    hasMore: rows.length > limit,
  };
}

// ---------- APIs ----------

function percentile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

export async function apiStats() {
  const db = await getDb();
  const since7 = hoursAgoIso(24 * 7);
  const [usage, reqs, skus] = await Promise.all([
    db.all("SELECT sku, SUM(count) AS calls FROM usage_daily WHERE day >= ? GROUP BY sku", [daysAgo(29)]),
    db.all(
      `SELECT sku, COUNT(*) AS total,
              SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS server_errors,
              SUM(CASE WHEN status >= 400 AND status < 500 THEN 1 ELSE 0 END) AS client_errors
         FROM request_log WHERE ts >= ? AND sku IS NOT NULL GROUP BY sku`,
      [since7]
    ),
    effectiveSkus(),
  ]);
  const calls = new Map(usage.map((u) => [u.sku, n(u.calls)]));
  const req = new Map(reqs.map((r) => [r.sku, r]));
  const out = {};
  for (const sku of Object.keys(skus)) {
    // Latency percentiles from the most recent 2,000 requests per SKU (last 7 days).
    const lat = await db.all(
      "SELECT latency_ms FROM request_log WHERE sku = ? AND ts >= ? AND status < 400 ORDER BY ts DESC LIMIT 2000",
      [sku, since7]
    );
    const sorted = lat.map((r) => n(r.latency_ms)).sort((a, b) => a - b);
    const r = req.get(sku);
    const total = n(r?.total);
    out[sku] = {
      calls30: calls.get(sku) || 0,
      requests7d: total,
      serverErrorRate: total ? n(r.server_errors) / total : 0,
      clientErrorRate: total ? n(r.client_errors) / total : 0,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
    };
  }
  return { stats: out, skus };
}

// ---------- request logs ----------

export async function listLogs({ status = "", org = "", sku = "", q = "", limit = 50, offset = 0 } = {}) {
  const db = await getDb();
  const where = [];
  const params = [];
  if (status === "2xx") where.push("r.status < 300");
  if (status === "4xx") where.push("r.status >= 400 AND r.status < 500");
  if (status === "5xx") where.push("r.status >= 500");
  if (status === "errors") where.push("r.status >= 400");
  if (org) {
    where.push("r.org_id = ?");
    params.push(org);
  }
  if (sku) {
    where.push("r.sku = ?");
    params.push(sku);
  }
  if (q) {
    where.push("(LOWER(r.path) LIKE ? OR LOWER(COALESCE(r.error_code, '')) LIKE ? OR LOWER(COALESCE(r.ip, '')) LIKE ?)");
    const like = `%${q.toLowerCase()}%`;
    params.push(like, like, like);
  }
  const rows = await db.all(
    `SELECT r.*, o.name AS org_name, k.name AS key_name
       FROM request_log r
       LEFT JOIN orgs o ON o.id = r.org_id
       LEFT JOIN api_keys k ON k.id = r.key_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY r.ts DESC LIMIT ? OFFSET ?`,
    [...params, limit + 1, offset]
  );
  return { logs: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function recentErrors(limit = 8) {
  return (await listLogs({ status: "errors", limit })).logs;
}

export async function orgOptions() {
  const db = await getDb();
  const rows = await db.all("SELECT id, name FROM orgs ORDER BY name LIMIT 500");
  return [{ id: SYSTEM_ORG_ID, name: orgLabel(SYSTEM_ORG_ID) }, ...rows];
}

// ---------- engines ----------

async function probe(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": config.userAgent }, signal: AbortSignal.timeout(4000) });
    return { ok: res.ok, status: res.status, latency_ms: Date.now() - started };
  } catch (err) {
    return { ok: false, error: err.message, latency_ms: Date.now() - started };
  }
}

const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export async function engineHealth() {
  const [routing, search] = await Promise.all([
    probe(`${engineUrl("valhalla")}/status`),
    probe(`${engineUrl("photon")}/api?q=delhi&limit=1`),
  ]);
  const db = await getDb();
  let vroom = { mode: engineMode("vroom") };
  if (config.vroomUrl) vroom = { ...vroom, ...(await probe(config.vroomUrl.replace(/\/$/, "") + "/health")) };
  return {
    routing: { engine: "Valhalla", mode: engineMode("valhalla"), host: hostOf(engineUrl("valhalla")), ...routing },
    search: { engine: "Photon", mode: engineMode("photon"), host: hostOf(engineUrl("photon")), ...search },
    tiles: { engine: "PMTiles", mode: hasLocalTiles() ? "self-hosted" : "public-fallback", ok: true },
    optimizer: { engine: "VROOM", host: config.vroomUrl ? hostOf(config.vroomUrl) : null, ...vroom },
    database: { engine: db.kind === "postgres" ? "Postgres" : "SQLite", mode: db.kind, ok: true },
  };
}

// Which settings are configured; never returns secret values.
export function envSummary() {
  const vars = [
    ["VALHALLA_URL", "url"],
    ["PHOTON_URL", "url"],
    ["VROOM_URL", "url"],
    ["PMTILES_PATH", "path"],
    ["GLYPHS_URL", "url"],
    ["INDIA_BOUNDARY_GEOJSON", "path"],
    ["REQUIRE_SELF_HOSTED", "flag"],
    ["DATABASE_URL", "secret"],
    ["SQLITE_PATH", "path"],
    ["NAKSHA_SECRET", "secret"],
    ["ADMIN_EMAILS", "secret"],
  ];
  return vars.map(([name, kind]) => {
    const value = process.env[name];
    let shown = null;
    if (value && kind === "url") shown = hostOf(value);
    if (value && (kind === "path" || kind === "flag")) shown = value;
    return { name, set: Boolean(value), shown };
  });
}

export function runtimeCaches() {
  const lru = globalThis.__nakshaLru || {};
  return [
    ...Object.entries(lru).map(([name, map]) => ({ name: `${name} response cache`, size: map.size })),
    { name: "API key cache", size: globalThis.__nakshaKeyCache?.size || 0 },
    { name: "Quota counters", size: globalThis.__nakshaCounters?.size || 0 },
    { name: "Rate-limit windows", size: globalThis.__nakshaRate?.size || 0 },
    { name: "Unflushed request logs", size: globalThis.__nakshaUsage?.logs?.length || 0 },
  ];
}
