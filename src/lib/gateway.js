import { PLANS } from "./catalog";
import { findKey } from "./keys";
import { getDb } from "./db";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Wraps an /api/v1 route handler with key auth, origin checks, rate limiting,
// metering, CORS and a uniform error envelope.
// The handler may change meter.sku / meter.units (e.g. matrix bills per element).
// options.checkOrigin=false is for tile/tilejson fetches, which MapLibre makes from
// web workers that don't reliably send a Referer.
export function apiRoute(sku, handler, { checkOrigin = true } = {}) {
  return async function route(request, context) {
    const cors = corsHeaders(request);
    try {
      const auth = await authenticate(request, { checkOrigin });
      const limit = rateLimit(auth);
      const meter = { sku, units: 1 };
      const params = context?.params ? await context.params : {};
      const result = await handler(request, { auth, params, meter });
      if (meter.sku && meter.units > 0) record(auth, meter.sku, meter.units);
      const response = toResponse(result);
      for (const [k, v] of Object.entries({ ...cors, ...limit.headers })) response.headers.set(k, v);
      return response;
    } catch (err) {
      return errorResponse(err, cors);
    }
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
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

async function authenticate(request, { checkOrigin }) {
  const raw = extractKey(request).trim();
  if (!raw) throw new ApiError(401, "missing_key", "Pass an API key as ?key=, X-Api-Key or Authorization: Bearer");
  const key = await findKey(raw);
  if (!key) throw new ApiError(401, "invalid_key", "API key is invalid or revoked");

  if (key.kind === "browser" && checkOrigin) {
    const origin = requestOrigin(request);
    if (!origin) throw new ApiError(403, "origin_required", "Browser keys only work from an allowed web origin");
    if (!originAllowed(origin, key.allowed_origins, requestHost(request))) {
      throw new ApiError(403, "origin_not_allowed", `Origin ${origin} is not allowed for this key`);
    }
  }
  return { keyId: key.id, orgId: key.org_id, plan: key.plan || "free", kind: key.kind, raw };
}

// The origin clients reach us on (honours a reverse proxy's forwarded headers).
export function publicOrigin(request) {
  const host = request.headers.get("x-forwarded-host");
  if (host) return `${request.headers.get("x-forwarded-proto") || "https"}://${host}`;
  return new URL(request.url).origin;
}

function requestHost(request) {
  return request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
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

// ---------- rate limiting (fixed one-minute window, in memory per instance) ----------

const windows = (globalThis.__nakshaRate ??= new Map());

function rateLimit(auth) {
  const rpm = (PLANS[auth.plan] || PLANS.free).rpm;
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

// ---------- metering (buffered, flushed every 2s) ----------

const pending = (globalThis.__nakshaUsage ??= { counts: new Map(), keys: new Set(), timer: null });

function record(auth, sku, units) {
  const day = new Date().toISOString().slice(0, 10);
  const id = `${auth.keyId}|${auth.orgId}|${day}|${sku}`;
  pending.counts.set(id, (pending.counts.get(id) || 0) + units);
  pending.keys.add(auth.keyId);
  pending.timer ??= setTimeout(() => flushUsage().catch((e) => console.error("usage flush failed", e)), 2000);
}

export async function flushUsage() {
  pending.timer = null;
  if (!pending.counts.size) return;
  const counts = [...pending.counts];
  const keys = [...pending.keys];
  pending.counts.clear();
  pending.keys.clear();
  const db = await getDb();
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
  const status = err instanceof ApiError ? err.status : 500;
  const code = err instanceof ApiError ? err.code : "internal_error";
  const message = err instanceof ApiError ? err.message : "Something went wrong";
  if (!(err instanceof ApiError)) console.error(err);
  return Response.json({ error: { code, message } }, { status, headers: { ...cors, ...(err.headers || {}) } });
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
