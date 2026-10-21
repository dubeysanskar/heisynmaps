import { authenticateUser, startSession } from "@/lib/auth";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const user = await authenticateUser(body.email || "", String(body.password || ""));
  if (!user) return Response.json({ error: { message: "Wrong email or password" } }, { status: 401 });
  await startSession(user.id);
  return Response.json({ ok: true });
}
