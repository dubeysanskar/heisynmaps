import { engineReport } from "@/lib/engines/report";
import { preflight, publicRoute } from "@/lib/gateway";

export const OPTIONS = preflight;

// Engine health, and which engines (if any) still rely on a third-party service.
export const GET = publicRoute(async () => {
  const { engines, thirdParty, missing } = await engineReport();
  return {
    ok: missing.length === 0 && engines.routing.ok && engines.search.ok,
    independent: thirdParty.length === 0,
    third_party: thirdParty,
    not_configured: missing,
    engines,
  };
});
