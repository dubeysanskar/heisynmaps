import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { getDb, now } from "@/lib/db";
import { invalidateKeyCache } from "@/lib/keys";

// PATCH { disabled: boolean }
export async function PATCH(request, { params }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  const { disabled } = await request.json().catch(() => ({}));
  if (typeof disabled !== "boolean") return fail(400, "disabled must be true or false");

  const db = await getDb();
  const key = await db.get("SELECT id, name, org_id, revoked_at FROM api_keys WHERE id = ?", [id]);
  if (!key) return fail(404, "Key not found");
  if (key.revoked_at) return fail(400, "Key is revoked");
  await db.run("UPDATE api_keys SET disabled_at = ? WHERE id = ?", [disabled ? now() : null, id]);
  invalidateKeyCache();
  await audit(session.user, disabled ? "admin.key.disable" : "admin.key.enable", id, { name: key.name, org: key.org_id });
  return Response.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  const db = await getDb();
  const key = await db.get("SELECT id, name, org_id FROM api_keys WHERE id = ? AND revoked_at IS NULL", [id]);
  if (!key) return fail(404, "Key not found or already revoked");
  await db.run("UPDATE api_keys SET revoked_at = ? WHERE id = ?", [now(), id]);
  invalidateKeyCache();
  await audit(session.user, "admin.key.revoke", id, { name: key.name, org: key.org_id });
  return Response.json({ revoked: true });
}

const fail = (status, message) => Response.json({ error: { message } }, { status });
