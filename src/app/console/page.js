import ConsoleApp from "@/components/console/ConsoleApp";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata = { title: "Console — Naksha Maps" };

export default function ConsolePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <ConsoleApp />
      </main>
      <SiteFooter />
    </>
  );
}
