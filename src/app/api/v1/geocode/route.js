import { apiRoute, preflight } from "@/lib/gateway";
import { runSearch, searchParams } from "@/lib/search";

export const OPTIONS = preflight;

export const GET = apiRoute("search.geocode", async (request, { auth }) => {
  const params = searchParams(request);
  return { query: params.q, results: await runSearch(auth.orgId, params) };
});
