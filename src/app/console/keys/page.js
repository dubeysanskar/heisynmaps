import Link from "next/link";
import { fmt, timeAgo } from "@/components/console/format";
import { StatusBadge } from "@/components/console/ui";
import { PageHeader } from "@/components/dash/DashShell";
import { getSessionUser } from "@/lib/auth";
import { API_GROUPS } from "@/lib/catalog";
import { callsTodayByKey } from "@/lib/console";
import { listApiKeys } from "@/lib/keys";

export default async function KeysPage() {
  const session = await getSessionUser();
  if (!session) return null; // the layout renders the sign-in form
  const [keys, today] = await Promise.all([listApiKeys(session.org.id), callsTodayByKey(session.org.id)]);

  return (
    <>
      <PageHeader
        title="API keys"
        description="Each key has its own restrictions, limits and usage. Keep server keys secret; browser keys only work from the websites you list."
        actions={
          <Link href="/console/keys/new" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
            Create key
          </Link>
        }
      />
      <div className="p-6">
        {keys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-semibold">No API keys yet</p>
            <p className="mt-1 text-sm text-slate-600">Create one to start calling the HeisynMaps APIs.</p>
            <Link href="/console/keys/new" className="mt-4 inline-block rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white">
              Create your first key
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Restrictions</th>
                  <th className="px-4 py-3 font-medium">APIs</th>
                  <th className="px-4 py-3 text-right font-medium">Calls today</th>
                  <th className="px-4 py-3 text-right font-medium">Last used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/console/keys/${k.id}`} className="font-medium text-slate-900 hover:text-teal-700 hover:underline">
                        {k.name}
                      </Link>
                      <p className="font-mono text-xs text-slate-500">
                        {k.prefix}… · {k.kind}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={k.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {k.kind === "browser"
                        ? `${k.allowedOrigins.length} website${k.allowedOrigins.length === 1 ? "" : "s"}`
                        : k.allowedIps.length
                          ? `${k.allowedIps.length} IP rule${k.allowedIps.length === 1 ? "" : "s"}`
                          : "Any IP"}
                      {k.dailyQuota ? ` · ${fmt(k.dailyQuota)}/day` : ""}
                      {k.rpmLimit ? ` · ${fmt(k.rpmLimit)}/min` : ""}
                      {k.expiresAt ? ` · expires ${new Date(k.expiresAt).toLocaleDateString("en-IN")}` : ""}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {k.scopes.length ? k.scopes.map((s) => API_GROUPS[s] || s).join(", ") : "All APIs"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(today[k.id] || 0)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{timeAgo(k.lastUsedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
