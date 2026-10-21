import { getDb, now } from "./db";

// Record an admin or account action. `actor` is the session's user ({ id, email }).
export async function audit(actor, action, target, details = null) {
  const db = await getDb();
  await db.run("INSERT INTO audit_log (ts, actor_id, actor_email, action, target, details) VALUES (?, ?, ?, ?, ?, ?)", [
    now(),
    actor?.id || null,
    actor?.email || null,
    action,
    target || null,
    details ? JSON.stringify(details) : null,
  ]);
}

export async function listAudit({ limit = 100 } = {}) {
  const db = await getDb();
  const rows = await db.all("SELECT * FROM audit_log ORDER BY ts DESC LIMIT ?", [limit]);
  return rows.map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null }));
}
