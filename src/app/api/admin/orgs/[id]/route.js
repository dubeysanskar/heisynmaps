import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { invalidateKeyCache } from "@/lib/keys";

const PLANS = ["free", "growth", "enterprise"];
const STATUSES = ["active", "suspended"];

// PATCH { plan?, status?, rpm_override?, quota_override?, notes? } — blank overrides reset to the plan default.
export async function PATCH(request, { params }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const db = await getDb();
  const org = await db.get("SELECT * FROM orgs WHERE id = ?", [id]);
  if (!org) return fail(404, "Organisation not found");

  const fields = {};
  if (body.plan !== undefined) {
    if (!PLANS.includes(body.plan)) return fail(400, `plan must be one of ${PLANS.join(", ")}`);
    fields.plan = body.plan;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return fail(400, "status must be active or suspended");
    fields.status = body.status;
  }
  for (const key of ["rpm_override", "quota_override"]) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === "") {
      fields[key] = null;
      continue;
    }
    const n = Number(body[key]);
    const min = key === "rpm_override" ? 1 : 0;
    if (!Number.isInteger(n) || n < min) return fail(400, `${key.replace("_", " ")} must be a whole number ≥ ${min}`);
    fields[key] = n;
  }
  if (body.notes !== undefined) fields.notes = String(body.notes || "").slice(0, 2000) || null;

  const cols = Object.keys(fields);
  if (!cols.length) return fail(400, "Nothing to change");
  await db.run(`UPDATE orgs SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, [...cols.map((c) => fields[c]), id]);
  invalidateKeyCache();

  const changed = Object.fromEntries(cols.filter((c) => org[c] !== fields[c]).map((c) => [c, { from: org[c] ?? null, to: fields[c] }]));
  const action = fields.status && fields.status !== org.status ? `org.${fields.status === "suspended" ? "suspend" : "reactivate"}` : "org.update";
  if (Object.keys(changed).length) await audit(session.user, action, id, changed);

  return Response.json({ org: { ...org, ...fields } });
}

const fail = (status, message) => Response.json({ error: { message } }, { status });
