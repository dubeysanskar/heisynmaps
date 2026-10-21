import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth";
import { getApiKey, revokeApiKey, updateApiKey } from "@/lib/keys";

export async function GET(request, { params }) {
  const session = await getSessionUser();
  if (!session) return unauthorized();
  const { id } = await params;
  const key = await getApiKey(session.org.id, id);
  return key ? Response.json({ key }) : notFound();
}

// Edit name/restrictions, or { disabled: true|false }.
export async function PATCH(request, { params }) {
  const session = await getSessionUser();
  if (!session) return unauthorized();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const key = await updateApiKey(session.org.id, id, body);
    if (!key) return notFound();
    await audit(session.user, body.disabled !== undefined ? (body.disabled ? "key.disable" : "key.enable") : "key.update", id, body);
    return Response.json({ key });
  } catch (err) {
    return Response.json({ error: { message: err.message } }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const session = await getSessionUser();
  if (!session) return unauthorized();
  const { id } = await params;
  if (!(await revokeApiKey(session.org.id, id))) return notFound();
  await audit(session.user, "key.revoke", id);
  return Response.json({ revoked: true });
}

const unauthorized = () => Response.json({ error: { message: "Not signed in" } }, { status: 401 });
const notFound = () => Response.json({ error: { message: "Key not found" } }, { status: 404 });
