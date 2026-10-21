import Link from "next/link";
import Icon, { Logo } from "@/components/Icon";
import { BRAND } from "@/lib/brand";

const NAV = [
  ["/maps", "Maps"],
  ["/docs", "Docs"],
  ["/pricing", "Pricing"],
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-slate-600 sm:flex" aria-label="Main">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="hover:text-slate-900">
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/console" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:block">
            Console
          </Link>
          <Link href="/console" className="rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800">
            Get API key
          </Link>
          {/* Mobile menu: a native disclosure, works without JavaScript */}
          <details className="group relative sm:hidden">
            <summary
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 text-slate-700 [&::-webkit-details-marker]:hidden"
              aria-label="Menu"
            >
              <Icon name="list" size={18} />
            </summary>
            <nav
              className="absolute right-0 top-11 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
              aria-label="Main"
            >
              {[...NAV, ["/console", "Console"]].map(([href, label]) => (
                <Link key={href} href={href} className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                  {label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-slate-600 sm:grid-cols-2 sm:px-6 lg:grid-cols-5">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="font-semibold text-slate-900">{BRAND.product}</span>
          </div>
          <p className="mt-3 max-w-sm leading-relaxed">{BRAND.description}</p>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-slate-900">Product</p>
          <Link href="/maps" className="block hover:text-slate-900">
            Maps
          </Link>
          <Link href="/pricing" className="block hover:text-slate-900">
            Pricing
          </Link>
          <Link href="/console" className="block hover:text-slate-900">
            Console
          </Link>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-slate-900">Developers</p>
          <Link href="/docs" className="block hover:text-slate-900">
            Documentation
          </Link>
          <Link href="/docs/guides/quickstart" className="block hover:text-slate-900">
            Quickstart
          </Link>
          <Link href="/docs/api/route" className="block hover:text-slate-900">
            API reference
          </Link>
          <a href="/api/v1/status" className="block hover:text-slate-900">
            API status
          </a>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-slate-900">Data</p>
          <a href="https://www.openstreetmap.org/copyright" className="block hover:text-slate-900">
            © OpenStreetMap contributors
          </a>
          <a href="https://openmaptiles.org/" className="block hover:text-slate-900">
            © OpenMapTiles (tile schema)
          </a>
          <a href="https://www.indiapost.gov.in/digipin" className="block hover:text-slate-900">
            DIGIPIN by India Post
          </a>
          <a href="https://data.gov.in" className="block hover:text-slate-900">
            PIN codes: Department of Posts (GODL-India)
          </a>
          <a href={`mailto:${BRAND.supportEmail}`} className="block break-all hover:text-slate-900">
            {BRAND.supportEmail}
          </a>
        </div>
      </div>
    </footer>
  );
}
