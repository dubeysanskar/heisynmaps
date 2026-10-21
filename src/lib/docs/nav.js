import { ENDPOINTS } from "@/lib/catalog";

// Guide metadata only (content lives in guides.js) so the client sidebar stays small.
export const GUIDE_META = [
  { slug: "quickstart", title: "Quickstart", section: "Getting started", summary: "Get a key and make your first call in five minutes." },
  { slug: "authentication", title: "Authentication & API keys", section: "Guides", summary: "Server vs browser keys, scopes, IP and origin locks, quotas, expiry and rotation." },
  { slug: "errors", title: "Errors", section: "Guides", summary: "The error envelope and every error code the API returns." },
  { slug: "rate-limits", title: "Rate limits & quotas", section: "Guides", summary: "Per-minute limits, daily key quotas, the free-tier cap and how to back off." },
  { slug: "maps-sdk", title: "Maps SDK", section: "Guides", summary: "Show the map on the web, in React, Android and iOS with MapLibre." },
  { slug: "digipin-mappin", title: "DIGIPIN & MapPIN", section: "Guides", summary: "India Post's 4 m address grid and short codes for your own places." },
  { slug: "logistics-recipes", title: "Logistics recipes", section: "Guides", summary: "Dispatch, service areas, hub arrival and trip audits, end to end." },
  { slug: "coverage", title: "Coverage & data", section: "Guides", summary: "Where the map works today, data sources and attribution." },
];

export const API_GROUP_ORDER = [...new Set(ENDPOINTS.map((e) => e.group))];

export function docsNav() {
  return [
    {
      title: "Getting started",
      items: [
        { href: "/docs", label: "Introduction" },
        ...GUIDE_META.filter((g) => g.section === "Getting started").map((g) => ({ href: `/docs/guides/${g.slug}`, label: g.title })),
      ],
    },
    {
      title: "Guides",
      items: GUIDE_META.filter((g) => g.section === "Guides").map((g) => ({ href: `/docs/guides/${g.slug}`, label: g.title })),
    },
    ...API_GROUP_ORDER.map((group) => ({
      title: `API · ${group}`,
      items: ENDPOINTS.filter((e) => e.group === group).map((e) => ({
        href: `/docs/api/${e.slug}`,
        label: e.title,
        method: e.method,
      })),
    })),
  ];
}

// Flat reading order for previous / next links.
export function docsSequence() {
  return docsNav().flatMap((s) => s.items);
}
