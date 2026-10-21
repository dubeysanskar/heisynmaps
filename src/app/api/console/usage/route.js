import { getSessionUser } from "@/lib/auth";
import { PLANS, SKUS } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { flushUsage } from "@/lib/gateway";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: { message: "Not signed in" } }, { status: 401 });
  await flushUsage();

  const db = await getDb();
  const since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const monthStart = new Date().toISOString().slice(0, 8) + "01";
  const daily = await db.all(
    `SELECT day, sku, SUM(count) AS count FROM usage_daily
      WHERE org_id = ? AND day >= ? GROUP BY day, sku ORDER BY day`,
    [session.org.id, since]
  );
  const month = await db.all(
    "SELECT sku, SUM(count) AS count FROM usage_daily WHERE org_id = ? AND day >= ? GROUP BY sku",
    [session.org.id, monthStart]
  );

  const plan = PLANS[session.org.plan] || PLANS.free;
  const monthToDate = month.map((r) => {
    const count = Number(r.count);
    const billable = Math.max(0, count - plan.includedPerSku);
    const sku = SKUS[r.sku] || { label: r.sku, inrPer1k: 0 };
    return { sku: r.sku, label: sku.label, count, included: plan.includedPerSku, overageInr: (billable / 1000) * sku.inrPer1k };
  });

  return Response.json({
    plan: { id: session.org.plan, ...plan, includedPerSku: Number.isFinite(plan.includedPerSku) ? plan.includedPerSku : null },
    daily: daily.map((r) => ({ day: r.day, sku: r.sku, count: Number(r.count) })),
    monthToDate,
  });
}
