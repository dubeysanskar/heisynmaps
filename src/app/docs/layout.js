import DocsSidebar from "@/components/docs/DocsSidebar";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { docsNav } from "@/lib/docs/nav";

export const metadata = {
  title: { default: "Docs — Naksha Maps", template: "%s — Naksha Maps docs" },
  description: "Guides and API reference for Naksha's maps, search, routing, fleet and DIGIPIN APIs.",
};

export default function DocsLayout({ children }) {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto w-full max-w-7xl flex-1 lg:flex lg:gap-10 lg:px-6">
        <DocsSidebar nav={docsNav()} />
        <main className="min-w-0 flex-1 px-4 pb-16 pt-8 sm:px-6 lg:px-0 lg:pt-10">{children}</main>
      </div>
      <SiteFooter />
    </>
  );
}
