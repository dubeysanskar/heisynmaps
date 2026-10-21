import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PATCH(request) {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: { message: "Not signed in" } }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 120);
  if (!name) return Response.json({ error: { message: "Organisation name is required" } }, { status: 400 });
  const db = await getDb();
  await db.run("UPDATE orgs SET name = ? WHERE id = ?", [name, session.org.id]);
  await audit(session.user, "org.rename", session.org.id, { name });
  return Response.json({ ok: true, name });
}
