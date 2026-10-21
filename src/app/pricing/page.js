import Link from "next/link";
import { connection } from "next/server";
import PricingTable from "@/components/PricingTable";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata = { title: "Pricing — Naksha Maps" };

const NOTES = [
  ["Billed per API", "Each API has its own monthly allowance, so heavy routing doesn't eat into your search calls."],
  ["Some APIs bill per unit", "Distance matrix counts each source × target element; geofence checks count each point."],
  ["Free never surprises you", "The Free plan stops at its allowance (HTTP 402) instead of billing you."],
  ["Prices in rupees", "No currency risk and no international card needed."],
];

export default async function PricingPage() {
  await connection(); // prices can be changed by admins at runtime
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
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NOTES.map(([title, body]) => (
            <div key={title} className="rounded-2xl bg-slate-50 p-5">
              <p className="font-semibold text-slate-900">{title}</p>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-slate-600">
          Limits and quotas are explained in the{" "}
          <Link href="/docs/guides/rate-limits" className="font-medium text-teal-700 hover:underline">
            rate limits guide
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
