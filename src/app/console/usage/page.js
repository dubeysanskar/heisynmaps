import UsageView from "@/components/console/UsageView";
import { PageHeader } from "@/components/dash/DashShell";
import { getSessionUser } from "@/lib/auth";
import { SKUS } from "@/lib/catalog";
import { overview, usage } from "@/lib/console";
import { listApiKeys } from "@/lib/keys";

export default async function UsagePage({ searchParams }) {
  const { key } = await searchParams;
  const session = await getSessionUser();
  if (!session) return null; // the layout renders the sign-in form
  const [summary, detail, keys] = await Promise.all([
    overview(session.org.id),
    usage(session.org.id, { keyId: key || undefined }),
    listApiKeys(session.org.id),
  ]);
  const skuLabels = Object.fromEntries(Object.entries(SKUS).map(([id, s]) => [id, s.label]));
  return (
    <>
      <PageHeader title="Usage" description="Updated every few seconds. Matrix calls count each origin–destination pair; geofence checks count each point." />
      <UsageView
        daily={detail.daily}
        perKey={detail.perKey}
        month={summary.month}
        plan={summary.plan}
        skuLabels={skuLabels}
        keys={keys.map((k) => ({ id: k.id, name: k.name }))}
        keyId={key || ""}
      />
    </>
  );
}
