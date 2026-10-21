import { callsPerDay, engineHealth, overviewStats, topOrgs, topSkus } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";

// JSON version of the admin overview, for scripts and monitoring.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const [stats, daily, orgs, skus, engines] = await Promise.all([
    overviewStats(),
    callsPerDay(30),
    topOrgs(10),
    topSkus(10),
    engineHealth(),
  ]);
  return Response.json({ stats, daily, topOrgs: orgs, topApis: skus, engines });
}
