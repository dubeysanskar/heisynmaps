import Link from "next/link";
import { Logo } from "@/components/Icon";
import { BRAND } from "@/lib/brand";

const NAV = [
  ["/maps", "Maps"],
  ["/docs", "API docs"],
  ["/pricing", "Pricing"],
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-slate-600 sm:flex">
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
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-slate-600 sm:grid-cols-4 sm:px-6">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="font-semibold text-slate-900">{BRAND.product}</span>
          </div>
          <p className="mt-3 max-w-sm leading-relaxed">{BRAND.description}</p>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-slate-900">Product</p>
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="block hover:text-slate-900">
              {label}
            </Link>
          ))}
          <Link href="/console" className="block hover:text-slate-900">
            Console
          </Link>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-slate-900">Data</p>
          <a href="https://www.openstreetmap.org/copyright" className="block hover:text-slate-900">
            © OpenStreetMap contributors
          </a>
          <a href="https://www.indiapost.gov.in/digipin" className="block hover:text-slate-900">
            DIGIPIN by India Post
          </a>
          <a href={`mailto:${BRAND.supportEmail}`} className="block hover:text-slate-900">
            {BRAND.supportEmail}
          </a>
        </div>
      </div>
    </footer>
  );
}
