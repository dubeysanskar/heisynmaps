import { engineReport } from "@/lib/engines/report";
import { preflight, publicRoute } from "@/lib/gateway";

export const OPTIONS = preflight;

// Engine health, and which engines (if any) still rely on a third-party service.
export const GET = publicRoute(async () => {
  const { engines, thirdParty } = await engineReport();
  return {
    ok: engines.routing.ok && engines.search.ok,
    independent: thirdParty.length === 0,
    third_party: thirdParty,
    engines,
  };
});
