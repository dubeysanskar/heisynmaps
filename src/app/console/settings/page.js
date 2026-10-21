import Link from "next/link";
import { fmt } from "@/components/console/format";
import OrgSettings from "@/components/console/OrgSettings";
import { Card, PageHeader } from "@/components/dash/DashShell";
import { getSessionUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { PLANS } from "@/lib/catalog";
import { getOrg, planFor } from "@/lib/console";

export default async function SettingsPage() {
  const session = await getSessionUser();
  if (!session) return null; // the layout renders the sign-in form
  const org = await getOrg(session.org.id);
  const plan = await planFor(org);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-4xl space-y-6 p-6">
        <Card title="Organisation">
          <OrgSettings name={org.name} />
          <p className="mt-3 font-mono text-xs text-slate-500">ID {org.id}</p>
        </Card>

        <Card title="Plan">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">{plan.name}</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                <li>{plan.includedPerSku == null ? "Unlimited calls" : `${fmt(plan.includedPerSku)} calls per API each month included`}</li>
                <li>{fmt(plan.rpm)} requests per minute per key</li>
                <li>{plan.hardCap ? "Calls stop at the monthly limit (no surprise bills)" : "Overage billed per 1,000 calls"}</li>
              </ul>
            </div>
            <div className="flex flex-col items-end gap-2">
              {org.plan === "free" && (
                <a
                  href={`mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(`Upgrade ${org.name} to Growth`)}&body=${encodeURIComponent(`Organisation ID: ${org.id}`)}`}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                >
                  Upgrade to Growth (₹{fmt(PLANS.growth.priceInr)}/mo)
                </a>
              )}
              <Link href="/pricing" className="text-sm text-teal-700 hover:underline">
                Compare plans
              </Link>
            </div>
          </div>
        </Card>

        <Card title="Account">
          <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
            <dt className="text-slate-500">Email</dt>
            <dd>{session.user.email}</dd>
            <dt className="text-slate-500">Name</dt>
            <dd>{session.user.name || "—"}</dd>
            <dt className="text-slate-500">Role</dt>
            <dd className="capitalize">{session.user.role}</dd>
          </dl>
        </Card>
      </div>
    </>
  );
}
