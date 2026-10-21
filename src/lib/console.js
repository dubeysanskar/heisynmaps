import { PLANS } from "./catalog";
import { getDb } from "./db";
import { flushUsage } from "./gateway";
import { listApiKeys } from "./keys";
import { effectiveSkus } from "./settings";

// Read models for the customer console. All queries are scoped to one org.

const day = (offset = 0) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);
const monthStart = () => day().slice(0, 8) + "01";

export async function getOrg(orgId) {
  const db = await getDb();
  return db.get("SELECT * FROM orgs WHERE id = ?", [orgId]);
}

export function keyLabel(keyId, keysById) {
  if (!keyId) return "—";
  if (keyId.startsWith("console_")) return "Playground";
  return keysById.get(keyId)?.name || "Deleted key";
}

export async function planFor(org) {
  const plan = PLANS[org.plan] || PLANS.free;
  const included = org.quota_override ?? plan.includedPerSku;
  return { id: org.plan, ...plan, includedPerSku: Number.isFinite(included) ? included : null, rpm: org.rpm_override ?? plan.rpm };
}

export async function overview(orgId) {
  await flushUsage();
  const db = await getDb();
  const org = await getOrg(orgId);
  const plan = await planFor(org);
  const skus = await effectiveSkus();
  const [todayRow, monthRows, dailyRows, keys, errRow, recent] = await Promise.all([
    db.get("SELECT SUM(count) AS n FROM usage_daily WHERE org_id = ? AND day = ?", [orgId, day()]),
    db.all("SELECT sku, SUM(count) AS n FROM usage_daily WHERE org_id = ? AND day >= ? GROUP BY sku", [orgId, monthStart()]),
    db.all("SELECT day, SUM(count) AS n FROM usage_daily WHERE org_id = ? AND day >= ? GROUP BY day", [orgId, day(29)]),
    listApiKeys(orgId),
    db.get(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors FROM request_log WHERE org_id = ? AND ts >= ?",
      [orgId, new Date(Date.now() - 7 * 864e5).toISOString()]
    ),
    db.all("SELECT * FROM request_log WHERE org_id = ? ORDER BY ts DESC LIMIT 6", [orgId]),
  ]);
  const keysById = new Map(keys.map((k) => [k.id, k]));
  const month = monthRows
    .map((r) => {
      const count = Number(r.n);
      const sku = skus[r.sku] || { label: r.sku, inrPer1k: 0 };
      const billable = plan.includedPerSku == null ? 0 : Math.max(0, count - plan.includedPerSku);
      return { sku: r.sku, label: sku.label, count, overageInr: (billable / 1000) * sku.inrPer1k };
    })
    .sort((a, b) => b.count - a.count);
  const totals = new Map(dailyRows.map((r) => [r.day, Number(r.n)]));
  const total = Number(errRow?.total || 0);
  return {
    org: { id: org.id, name: org.name, plan: org.plan, status: org.status },
    plan,
    callsToday: Number(todayRow?.n || 0),
    callsMonth: month.reduce((n, r) => n + r.count, 0),
    overageInr: month.reduce((n, r) => n + r.overageInr, 0),
    month,
    daily: Array.from({ length: 30 }, (_, i) => ({ day: day(29 - i), count: totals.get(day(29 - i)) || 0 })),
    activeKeys: keys.filter((k) => k.status === "active").length,
    errorRate7d: total ? Number(errRow.errors || 0) / total : 0,
    requests7d: total,
    recent: recent.map((r) => ({ ...r, keyName: keyLabel(r.key_id, keysById) })),
  };
}

export async function usage(orgId, { keyId } = {}) {
  await flushUsage();
  const db = await getDb();
  const keyFilter = keyId ? " AND key_id = ?" : "";
  const args = keyId ? [keyId] : [];
  const [daily, perKey, keys] = await Promise.all([
    db.all(
      `SELECT day, sku, SUM(count) AS n FROM usage_daily WHERE org_id = ? AND day >= ?${keyFilter} GROUP BY day, sku ORDER BY day`,
      [orgId, day(29), ...args]
    ),
    db.all("SELECT key_id, SUM(count) AS n FROM usage_daily WHERE org_id = ? AND day >= ? GROUP BY key_id", [orgId, monthStart()]),
    listApiKeys(orgId),
  ]);
  const keysById = new Map(keys.map((k) => [k.id, k]));
  return {
    daily: daily.map((r) => ({ day: r.day, sku: r.sku, count: Number(r.n) })),
    perKey: perKey
      .map((r) => ({ keyId: r.key_id, name: keyLabel(r.key_id, keysById), count: Number(r.n) }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function callsTodayByKey(orgId) {
  await flushUsage();
  const db = await getDb();
  const rows = await db.all("SELECT key_id, SUM(count) AS n FROM usage_daily WHERE org_id = ? AND day = ? GROUP BY key_id", [orgId, day()]);
  return Object.fromEntries(rows.map((r) => [r.key_id, Number(r.n)]));
}

export async function requestLogs(orgId, { status, keyId, sku, q, limit = 50, offset = 0 } = {}) {
  await flushUsage();
  const db = await getDb();
  const where = ["org_id = ?"];
  const args = [orgId];
  if (status === "2xx") where.push("status < 300");
  if (status === "4xx") where.push("status >= 400 AND status < 500");
  if (status === "5xx") where.push("status >= 500");
  if (keyId) {
    where.push("key_id = ?");
    args.push(keyId);
  }
  if (sku) {
    where.push("sku = ?");
    args.push(sku);
  }
  if (q) {
    where.push("path LIKE ?");
    args.push(`%${q.replace(/[%_]/g, "")}%`);
  }
  const rows = await db.all(`SELECT * FROM request_log WHERE ${where.join(" AND ")} ORDER BY ts DESC LIMIT ? OFFSET ?`, [
    ...args,
    limit + 1,
    offset,
  ]);
  const keys = await listApiKeys(orgId);
  const keysById = new Map(keys.map((k) => [k.id, k]));
  return {
    rows: rows.slice(0, limit).map((r) => ({ ...r, keyName: keyLabel(r.key_id, keysById) })),
    hasMore: rows.length > limit,
  };
}
