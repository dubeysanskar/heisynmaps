import { audit } from "@/lib/audit";
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
  try {
    const key = await createApiKey(session.org.id, {
      name: body.name,
      kind: body.kind,
      allowedOrigins: body.allowedOrigins,
      allowedIps: body.allowedIps,
      scopes: body.scopes,
      rpmLimit: body.rpmLimit,
      dailyQuota: body.dailyQuota,
      expiresAt: body.expiresAt,
    });
    await audit(session.user, "key.create", key.id, { name: key.name, kind: key.kind });
    return Response.json({ key }, { status: 201 });
  } catch (err) {
    return Response.json({ error: { message: err.message } }, { status: 400 });
  }
}

const unauthorized = () => Response.json({ error: { message: "Not signed in" } }, { status: 401 });
