import Link from "next/link";
import { PLANS, SKUS } from "@/lib/catalog";

const inr = (n) => `₹${n.toLocaleString("en-IN")}`;

export default function PricingTable() {
  const tiers = [
    { id: "free", ...PLANS.free, blurb: "Build and launch. No card needed.", cta: "Start free" },
    { id: "growth", ...PLANS.growth, blurb: "For fleets in production.", cta: "Choose Growth", featured: true },
    { id: "enterprise", ...PLANS.enterprise, blurb: "Your VPC or on-prem, India region, SLA.", cta: "Talk to us" },
  ];
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.id}
            className={`flex flex-col rounded-2xl border p-6 ${t.featured ? "border-teal-600 shadow-xl shadow-teal-900/10" : "border-slate-200"}`}
          >
            <p className="text-sm font-semibold text-teal-700">{t.name}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {t.priceInr == null ? "Custom" : t.priceInr === 0 ? "₹0" : inr(t.priceInr)}
              {t.priceInr ? <span className="text-base font-normal text-slate-500"> /month</span> : null}
            </p>
            <p className="mt-2 text-sm text-slate-600">{t.blurb}</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              <li>
                {Number.isFinite(t.includedPerSku)
                  ? `${(t.includedPerSku / 1000).toLocaleString("en-IN")}k calls / API / month included`
                  : "Unlimited calls"}
              </li>
              <li>{t.rpm.toLocaleString("en-IN")} requests / minute</li>
              <li>{t.id === "enterprise" ? "Self-hosted, data stays in your network" : "Hosted in India"}</li>
              <li>{t.id === "free" ? "Community support" : "Priority support"}</li>
            </ul>
            <Link
              href={t.id === "enterprise" ? "mailto:tech@lekyalogistics.com" : "/console"}
              className={`mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-medium ${
                t.featured ? "bg-teal-700 text-white hover:bg-teal-800" : "border border-slate-300 hover:bg-slate-50"
              }`}
            >
              {t.cta}
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">API</th>
              <th className="px-4 py-3 text-right font-medium">Overage per 1,000</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Object.entries(SKUS)
              .filter(([, s]) => s.inrPer1k > 0)
              .map(([id, s]) => (
                <tr key={id}>
                  <td className="px-4 py-2.5">
                    {s.label} <span className="ml-1 font-mono text-xs text-slate-400">{id}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">{inr(s.inrPer1k)}</td>
                </tr>
              ))}
            <tr>
              <td className="px-4 py-2.5">DIGIPIN encode/decode, vector tiles</td>
              <td className="px-4 py-2.5 text-right font-medium text-teal-700">Free</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
