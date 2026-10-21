import { getSessionUser } from "@/lib/auth";
import { requestLogs } from "@/lib/console";

export async function GET(request) {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: { message: "Not signed in" } }, { status: 401 });
  const p = new URL(request.url).searchParams;
  const data = await requestLogs(session.org.id, {
    status: p.get("status") || undefined,
    keyId: p.get("key") || undefined,
    sku: p.get("sku") || undefined,
    q: p.get("q") || undefined,
    limit: Math.min(200, Math.max(1, Number(p.get("limit")) || 50)),
    offset: Math.max(0, Number(p.get("offset")) || 0),
  });
  return Response.json(data);
}
