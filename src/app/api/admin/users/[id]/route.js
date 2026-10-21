import { adminCount } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

// PATCH { role: "admin" | "member" }
export async function PATCH(request, { params }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  const { role } = await request.json().catch(() => ({}));
  if (!["admin", "member"].includes(role)) return fail(400, "role must be admin or member");

  const db = await getDb();
  const user = await db.get("SELECT id, email, role FROM users WHERE id = ?", [id]);
  if (!user) return fail(404, "User not found");
  if (user.role === role) return Response.json({ user });
  if (role === "member") {
    if (id === session.user.id) return fail(400, "You can't remove your own admin access");
    if ((await adminCount()) <= 1) return fail(400, "There must be at least one admin");
  }

  await db.run("UPDATE users SET role = ? WHERE id = ?", [role, id]);
  await audit(session.user, role === "admin" ? "user.promote" : "user.demote", user.email);
  return Response.json({ user: { ...user, role } });
}

const fail = (status, message) => Response.json({ error: { message } }, { status });
