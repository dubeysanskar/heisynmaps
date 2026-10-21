import KeyForm from "@/components/console/KeyForm";
import { PageHeader } from "@/components/dash/DashShell";
import { getSessionUser } from "@/lib/auth";
import { getOrg, planFor } from "@/lib/console";

export default async function NewKeyPage() {
  const session = await getSessionUser();
  if (!session) return null; // the layout renders the sign-in form
  const plan = await planFor(await getOrg(session.org.id));
  return (
    <>
      <PageHeader title="Create an API key" description="Pick the key type, then restrict it to exactly what it needs." />
      <div className="max-w-3xl p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <KeyForm planRpm={plan.rpm} />
        </div>
      </div>
    </>
  );
}
