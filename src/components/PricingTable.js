import Link from "next/link";
import { PLANS } from "@/lib/catalog";
import { BRAND } from "@/lib/brand";
import { effectiveSkus } from "@/lib/settings";

const inr = (n) => `₹${n.toLocaleString("en-IN")}`;

// Plans plus per-API overage prices (with any admin overrides applied).
// showSkus=false renders the plan cards only (landing page teaser).
export default async function PricingTable({ showSkus = true }) {
  const skus = showSkus ? await effectiveSkus() : {};
  const tiers = [
    { id: "free", ...PLANS.free, blurb: "Build and launch. No card needed.", cta: "Start free" },
    { id: "growth", ...PLANS.growth, blurb: "For fleets in production.", cta: "Choose Growth", featured: true },
    { id: "enterprise", ...PLANS.enterprise, blurb: "Your VPC or on-prem, data stays in your network, SLA.", cta: "Talk to us" },
  ];
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.id}
            className={`flex flex-col rounded-2xl border bg-white p-6 ${t.featured ? "border-teal-600 shadow-xl shadow-teal-900/10" : "border-slate-200"}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-teal-700">{t.name}</p>
              {t.featured && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">For production</span>}
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {t.priceInr == null ? "Custom" : t.priceInr === 0 ? "₹0" : inr(t.priceInr)}
              {t.priceInr ? <span className="text-base font-normal text-slate-500"> /month</span> : null}
            </p>
            <p className="mt-2 text-sm text-slate-600">{t.blurb}</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              <li>
                {Number.isFinite(t.includedPerSku)
                  ? `${(t.includedPerSku / 1000).toLocaleString("en-IN")}k calls per API every month`
                  : "Unlimited calls"}
              </li>
              <li>{t.rpm.toLocaleString("en-IN")} requests / minute</li>
              <li>{t.hardCap ? "Stops at the free allowance, never billed" : t.id === "growth" ? "Pay per 1,000 calls beyond that" : "Self-hosted option"}</li>
              <li>{t.id === "free" ? "Community support" : "Priority support"}</li>
            </ul>
            <Link
              href={t.id === "enterprise" ? `mailto:${BRAND.supportEmail}` : "/console"}
              className={`mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-medium ${
                t.featured ? "bg-teal-700 text-white hover:bg-teal-800" : "border border-slate-300 hover:bg-slate-50"
              }`}
            >
              {t.cta}
            </Link>
          </div>
        ))}
      </div>

      {showSkus && (
        <div className="mt-10 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">API</th>
                <th className="px-4 py-3 text-right font-medium">Per 1,000 beyond the allowance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(skus)
                .filter(([, s]) => s.inrPer1k > 0)
                .map(([id, s]) => (
                  <tr key={id}>
                    <td className="px-4 py-2.5">
                      {s.label} <span className="ml-1 font-mono text-xs text-slate-400">{id}</span>
                      {s.disabled && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                          Temporarily unavailable
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">{inr(s.inrPer1k)}</td>
                  </tr>
                ))}
              <tr>
                <td className="px-4 py-2.5">
                  {Object.entries(skus)
                    .filter(([, s]) => !s.inrPer1k)
                    .map(([, s]) => s.label)
                    .join(", ")}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-teal-700">Free</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
