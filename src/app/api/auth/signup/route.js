import { createUser, startSession } from "@/lib/auth";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Enter a valid email address");
  if (password.length < 8) return error("Password must be at least 8 characters");
  try {
    const user = await createUser({ email, password, name: body.name, orgName: body.company });
    await startSession(user.id);
    return Response.json({ ok: true });
  } catch (err) {
    return error(err.message);
  }
}

const error = (message) => Response.json({ error: { message } }, { status: 400 });
