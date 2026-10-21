import { getSessionUser } from "@/lib/auth";
import { createApiKey, listApiKeys } from "@/lib/keys";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return unauthorized();
  return Response.json({ keys: await listApiKeys(session.org.id) });
}

export async function POST(request) {
  const session = await getSessionUser();
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const kind = body.kind === "browser" ? "browser" : "server";
  if (kind === "browser" && !String(body.allowedOrigins || "").trim()) {
    return Response.json({ error: { message: "Browser keys need at least one allowed origin" } }, { status: 400 });
  }
  const key = await createApiKey(session.org.id, {
    name: String(body.name || "").slice(0, 80) || "Untitled key",
    kind,
    allowedOrigins: body.allowedOrigins,
  });
  return Response.json({ key }, { status: 201 });
}

const unauthorized = () => Response.json({ error: { message: "Not signed in" } }, { status: 401 });
