import Playground from "@/components/console/Playground";
import { PageHeader } from "@/components/dash/DashShell";
import { ENDPOINTS } from "@/lib/catalog";
import { firstPartyKey } from "@/lib/keys";

export default function PlaygroundPage() {
  return (
    <>
      <PageHeader
        title="Playground"
        description="Call any endpoint live. Requests run as your account and show up in usage and logs, so there's no key to paste."
      />
      <Playground endpoints={ENDPOINTS} demoKey={firstPartyKey()} />
    </>
  );
}
