import { getSessionUser } from "@/lib/auth";
import { revokeApiKey } from "@/lib/keys";

export async function DELETE(request, { params }) {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: { message: "Not signed in" } }, { status: 401 });
  const { id } = await params;
  if (!(await revokeApiKey(session.org.id, id))) {
    return Response.json({ error: { message: "Key not found" } }, { status: 404 });
  }
  return Response.json({ revoked: true });
}
