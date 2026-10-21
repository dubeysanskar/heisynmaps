import PricingTable from "@/components/PricingTable";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata = { title: "Pricing — Naksha Maps" };

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight">Simple, per-call pricing</h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-600">
          100,000 free calls per API every month. After that you pay per 1,000 calls, in rupees, with no minimums.
        </p>
        <div className="mt-10">
          <PricingTable />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
