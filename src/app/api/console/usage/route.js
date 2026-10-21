import { getSessionUser } from "@/lib/auth";
import { overview, usage } from "@/lib/console";

export async function GET(request) {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: { message: "Not signed in" } }, { status: 401 });
  const keyId = new URL(request.url).searchParams.get("key") || undefined;
  const [summary, detail] = await Promise.all([overview(session.org.id), usage(session.org.id, { keyId })]);
  return Response.json({
    plan: summary.plan,
    callsToday: summary.callsToday,
    callsMonth: summary.callsMonth,
    overageInr: summary.overageInr,
    monthToDate: summary.month,
    daily: detail.daily,
    perKey: detail.perKey,
  });
}
