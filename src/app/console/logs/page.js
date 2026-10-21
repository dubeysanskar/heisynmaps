import LogsView from "@/components/console/LogsView";
import { PageHeader } from "@/components/dash/DashShell";
import { getSessionUser } from "@/lib/auth";
import { SKUS } from "@/lib/catalog";
import { listApiKeys } from "@/lib/keys";

export default async function LogsPage({ searchParams }) {
  const { key } = await searchParams;
  const session = await getSessionUser();
  if (!session) return null; // the layout renders the sign-in form
  const keys = await listApiKeys(session.org.id);
  return (
    <>
      <PageHeader title="Request logs" description="Every API call made with your keys, newest first. Use them to debug 4xx errors and slow requests." />
      <LogsView
        keys={[...keys.map((k) => ({ id: k.id, name: k.name })), { id: `console_${session.org.id}`, name: "Playground" }]}
        skus={Object.entries(SKUS).map(([id, s]) => [id, s.label])}
        initialKey={key || ""}
      />
    </>
  );
}
