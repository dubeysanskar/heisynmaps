import { PLANS, skuGroup } from "./catalog";
import { getSessionUser } from "./auth";
import { findKey } from "./keys";
import { getDb } from "./db";
import { getApiOverrides } from "./settings";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Wraps an /api/v1 route handler with: key (or console session) auth, org/key status,
// scopes, origin and IP restrictions, admin API switches, rate limits, quotas, metering,
// request logging, CORS and a uniform error envelope.
// The handler may change meter.sku / meter.units (e.g. matrix bills per element).
// options.checkOrigin=false is for tile/tilejson fetches, which MapLibre makes from
// web workers that don't reliably send a Referer.
export function apiRoute(sku, handler, { checkOrigin = true } = {}) {
  return async function route(request, context) {
    const started = Date.now();
    const cors = corsHeaders(request);
    const meter = { sku, units: 1 };
    const seen = {}; // key/org identified so far, so rejected calls still log to the right account
    let auth = null;
    let response;
    try {
      auth = await authenticate(request, { checkOrigin }, seen);
      await checkAccess(auth, sku);
      const limit = rateLimit(auth);
      await checkQuotas(auth, sku);
      const params = context?.params ? await context.params : {};
      const result = await handler(request, { auth, params, meter });
      if (meter.sku && meter.units > 0) record(auth, meter.sku, meter.units);
      response = toResponse(result);
      for (const [k, v] of Object.entries({ ...cors, ...limit.headers })) response.headers.set(k, v);
    } catch (err) {
      response = errorResponse(err, cors);
    }
    logRequest(request, auth || seen, meter.sku || sku, response, started);
    return response;
  };
}

// For routes that don't need a key (e.g. /status).
export function publicRoute(handler) {
  return async function route(request, context) {
    const cors = corsHeaders(request);
    try {
      const response = toResponse(await handler(request, context));
      for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
      return response;
    } catch (err) {
      return errorResponse(err, cors);
    }
  };
}

export function preflight(request) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// ---------- auth ----------

function extractKey(request) {
  const url = new URL(request.url);
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return url.searchParams.get("key") || request.headers.get("x-api-key") || bearer || "";
}

async function authenticate(request, { checkOrigin }, seen = {}) {
  const raw = extractKey(request).trim();

  // The console playground and docs "Try it" call the API with the signed-in session.
  // The custom header can't be sent cross-site without a CORS preflight we don't allow.
  if (!raw && request.headers.get("x-heisyn-console") === "1") {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "not_signed_in", "Sign in to use the playground, or pass an API key");
    seen.keyId = `console_${session.org.id}`;
    seen.orgId = session.org.id;
    return {
      keyId: `console_${session.org.id}`,
      orgId: session.org.id,
      plan: session.org.plan,
      orgStatus: session.org.status,
      kind: "session",
      scopes: [],
      raw: "",
    };
  }

  if (!raw) throw new ApiError(401, "missing_key", "Pass an API key as ?key=, X-Api-Key or Authorization: Bearer");
  const key = await findKey(raw);
  if (!key) throw new ApiError(401, "invalid_key", "API key is invalid or revoked");
  seen.keyId = key.id;
  seen.orgId = key.org_id;
  if (key.disabled_at) throw new ApiError(403, "key_disabled", "This API key is disabled");
  if (key.expires_at && key.expires_at < new Date().toISOString()) throw new ApiError(401, "key_expired", "This API key has expired");

  if (key.kind === "browser" && checkOrigin) {
    const origin = requestOrigin(request);
    if (!origin) throw new ApiError(403, "origin_required", "Browser keys only work from an allowed web origin");
    if (!originAllowed(origin, key.allowed_origins, requestHost(request))) {
      throw new ApiError(403, "origin_not_allowed", `Origin ${origin} is not allowed for this key`);
    }
  }
  if (key.kind === "server" && key.allowed_ips) {
    const ip = clientIp(request);
    if (!ip || !ipAllowed(ip, key.allowed_ips)) {
      throw new ApiError(403, "ip_not_allowed", `Requests from ${ip || "an unknown IP"} are not allowed for this key`);
    }
  }
  return {
    keyId: key.id,
    orgId: key.org_id,
    plan: key.plan || "free",
    orgStatus: key.org_status || "active",
    kind: key.kind,
    scopes: key.scopes ? key.scopes.split(",") : [],
    rpmLimit: key.rpm_limit ?? null,
    dailyQuota: key.daily_quota ?? null,
    rpmOverride: key.rpm_override ?? null,
    quotaOverride: key.quota_override ?? null,
    raw,
  };
}

async function checkAccess(auth, sku) {
  if (auth.orgStatus === "suspended") {
    throw new ApiError(403, "account_suspended", "This account is suspended. Contact support.");
  }
  if (sku && auth.scopes.length && !auth.scopes.includes(skuGroup(sku))) {
    throw new ApiError(403, "scope_denied", `This key is not allowed to call ${skuGroup(sku)} APIs`);
  }
  if (sku) {
    const overrides = await getApiOverrides();
    if (overrides[sku]?.disabled) {
      throw new ApiError(503, "api_disabled", overrides[sku].note || "This API is temporarily unavailable");
    }
  }
}

export function publicOrigin(request) {
  const host = request.headers.get("x-forwarded-host");
  if (host) return `${request.headers.get("x-forwarded-proto") || "https"}://${host}`;
  return new URL(request.url).origin;
}

function requestHost(request) {
  return request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
}

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || "";
  return ip.replace(/^::ffff:/, "");
}

// Same-origin GETs don't send Origin, so fall back to the Referer's origin.
function requestOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== "null") return origin;
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function originAllowed(origin, allowed, selfHost) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return String(allowed || "")
    .split(",")
    .filter(Boolean)
    .some((entry) => {
      if (entry === "*") return true;
      if (entry === "self") return url.host === selfHost;
      const withScheme = entry.includes("://");
      const target = withScheme ? origin : url.host;
      if (!entry.includes("*")) return target === entry || (!withScheme && url.hostname === entry);
      const pattern = new RegExp(
        "^" + entry.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]+") + "$"
      );
      return pattern.test(target) || (!withScheme && pattern.test(url.hostname));
    });
}

// Exact IPs (v4/v6) and IPv4 CIDR ranges.
export function ipAllowed(ip, allowed) {
  const toInt = (v4) => v4.split(".").reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;
  return String(allowed || "")
    .split(",")
    .filter(Boolean)
    .some((entry) => {
      if (!entry.includes("/")) return entry === ip;
      const [base, bits] = entry.split("/");
      if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip) || !/^\d+\.\d+\.\d+\.\d+$/.test(base)) return false;
      const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
      return (toInt(ip) & mask) === (toInt(base) & mask);
    });
}

// ---------- rate limiting (fixed one-minute window, in memory per instance) ----------

const windows = (globalThis.__heisynRate ??= new Map());

function rateLimit(auth) {
  const planRpm = auth.rpmOverride ?? (PLANS[auth.plan] || PLANS.free).rpm;
  const rpm = auth.rpmLimit ? Math.min(auth.rpmLimit, planRpm) : planRpm;
  const minute = Math.floor(Date.now() / 60000);
  const slot = windows.get(auth.keyId);
  const entry = slot && slot.minute === minute ? slot : { minute, count: 0 };
  entry.count += 1;
  windows.set(auth.keyId, entry);
  if (windows.size > 50000) windows.clear();
  const headers = {
    "X-RateLimit-Limit": String(rpm),
    "X-RateLimit-Remaining": String(Math.max(0, rpm - entry.count)),
  };
  if (entry.count > rpm) {
    const err = new ApiError(429, "rate_limited", `Rate limit of ${rpm} requests/minute exceeded`);
    err.headers = { ...headers, "Retry-After": String(60 - Math.floor((Date.now() / 1000) % 60)) };
    throw err;
  }
  return { headers };
}

// ---------- quotas (in-memory counters seeded from usage_daily) ----------

const counters = (globalThis.__heisynCounters ??= new Map());

async function counter(id, seed) {
  if (!counters.has(id)) {
    if (counters.size > 100000) counters.clear();
    counters.set(id, Number(await seed()) || 0);
  }
  return counters.get(id);
}

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";

async function checkQuotas(auth, sku) {
  const db = await getDb();
  if (auth.dailyQuota) {
    const used = await counter(`d|${auth.keyId}|${today()}`, async () => {
      const r = await db.get("SELECT SUM(count) AS n FROM usage_daily WHERE key_id = ? AND day = ?", [auth.keyId, today()]);
      return r?.n;
    });
    if (used >= auth.dailyQuota) {
      throw new ApiError(429, "daily_quota_exceeded", `This key's daily quota of ${auth.dailyQuota} calls is used up`);
    }
  }
  const plan = PLANS[auth.plan] || PLANS.free;
  const included = auth.quotaOverride ?? plan.includedPerSku;
  if (sku && plan.hardCap && Number.isFinite(included)) {
    const used = await counter(`m|${auth.orgId}|${monthStart()}|${sku}`, async () => {
      const r = await db.get("SELECT SUM(count) AS n FROM usage_daily WHERE org_id = ? AND sku = ? AND day >= ?", [
        auth.orgId,
        sku,
        monthStart(),
      ]);
      return r?.n;
    });
    if (used >= included) {
      const err = new ApiError(
        402,
        "quota_exceeded",
        `Free plan limit of ${included.toLocaleString("en-IN")} calls this month reached for ${sku}. Upgrade to keep going.`
      );
      throw err;
    }
  }
}

// ---------- metering + request log (buffered, flushed every 2s) ----------

const pending = (globalThis.__heisynUsage ??= { counts: new Map(), keys: new Set(), logs: [], timer: null, pruned: 0 });
pending.logs ??= [];

function schedule() {
  pending.timer ??= setTimeout(() => flushUsage().catch((e) => console.error("usage flush failed", e)), 2000);
}

function record(auth, sku, units) {
  const day = today();
  const id = `${auth.keyId}|${auth.orgId}|${day}|${sku}`;
  pending.counts.set(id, (pending.counts.get(id) || 0) + units);
  if (auth.kind !== "session") pending.keys.add(auth.keyId);
  for (const c of [`d|${auth.keyId}|${day}`, `m|${auth.orgId}|${monthStart()}|${sku}`]) {
    if (counters.has(c)) counters.set(c, counters.get(c) + units);
  }
  schedule();
}

function logRequest(request, auth, sku, response, started) {
  if (pending.logs.length > 5000) return; // shed load rather than grow without bound
  const url = new URL(request.url);
  let code = null;
  if (response.status >= 400) code = response.headers.get("x-heisyn-error") || null;
  pending.logs.push([
    new Date().toISOString(),
    auth?.orgId || null,
    auth?.keyId || null,
    sku || null,
    request.method,
    url.pathname,
    response.status,
    Date.now() - started,
    clientIp(request) || null,
    code,
  ]);
  schedule();
}

export async function flushUsage() {
  pending.timer = null;
  const db = await getDb();
  const counts = [...pending.counts];
  const keys = [...pending.keys];
  const logs = pending.logs.splice(0);
  pending.counts.clear();
  pending.keys.clear();
  for (const [id, count] of counts) {
    const [keyId, orgId, day, sku] = id.split("|");
    await db.run(
      `INSERT INTO usage_daily (key_id, org_id, day, sku, count) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (key_id, day, sku) DO UPDATE SET count = usage_daily.count + excluded.count`,
      [keyId, orgId, day, sku, count]
    );
  }
  const stamp = new Date().toISOString();
  for (const keyId of keys) {
    await db.run("UPDATE api_keys SET last_used_at = ? WHERE id = ?", [stamp, keyId]);
  }
  for (const row of logs) {
    await db.run(
      `INSERT INTO request_log (ts, org_id, key_id, sku, method, path, status, latency_ms, ip, error_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row
    );
  }
  // Keep 14 days of request logs; prune at most once an hour.
  if (Date.now() - pending.pruned > 3600_000) {
    pending.pruned = Date.now();
    await db.run("DELETE FROM request_log WHERE ts < ?", [new Date(Date.now() - 14 * 864e5).toISOString()]);
  }
}

// ---------- responses ----------

function corsHeaders(request) {
  return {
    "Access-Control-Allow-Origin": request.headers.get("origin") || "*",
    "Access-Control-Expose-Headers": "X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After",
    Vary: "Origin",
  };
}

function toResponse(result) {
  if (result instanceof Response) return new Response(result.body, result); // make headers mutable
  return Response.json(result);
}

function errorResponse(err, cors) {
  if (err?.notConfigured) err = new ApiError(503, "engine_not_configured", err.message);
  const status = err instanceof ApiError ? err.status : 500;
  const code = err instanceof ApiError ? err.code : "internal_error";
  const message = err instanceof ApiError ? err.message : "Something went wrong";
  if (!(err instanceof ApiError)) console.error(err);
  return Response.json(
    { error: { code, message } },
    { status, headers: { ...cors, ...(err.headers || {}), "X-Heisyn-Error": code } }
  );
}

// ---------- input helpers ----------

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be JSON");
  }
}

export function number(value, name, { min = -Infinity, max = Infinity, fallback } = {}) {
  if ((value === undefined || value === null || value === "") && fallback !== undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new ApiError(400, "invalid_param", `${name} must be a number between ${min} and ${max}`);
  }
  return n;
}

export function point(value, name = "location") {
  if (!value || typeof value !== "object") throw new ApiError(400, "invalid_param", `${name} must be {lat, lon}`);
  return {
    lat: number(value.lat, `${name}.lat`, { min: -90, max: 90 }),
    lon: number(value.lon ?? value.lng, `${name}.lon`, { min: -180, max: 180 }),
  };
}

export function points(value, name, { min = 1, max = 25 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new ApiError(400, "invalid_param", `${name} must be an array of ${min}–${max} {lat, lon} points`);
  }
  return value.map((p, i) => ({ ...p, ...point(p, `${name}[${i}]`) }));
}
