import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth";
import { rotateApiKey } from "@/lib/keys";

// Issues a new secret for the key; the old one stops working immediately.
export async function POST(request, { params }) {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: { message: "Not signed in" } }, { status: 401 });
  const { id } = await params;
  const key = await rotateApiKey(session.org.id, id);
  if (!key) return Response.json({ error: { message: "Key not found" } }, { status: 404 });
  await audit(session.user, "key.rotate", id);
  return Response.json({ key });
}
