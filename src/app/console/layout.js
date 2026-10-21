import AuthForm from "@/components/auth/AuthForm";
import DashShell from "@/components/dash/DashShell";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getSessionUser } from "@/lib/auth";

export const metadata = { title: "Console — Naksha Maps" };

const NAV = [
  { href: "/console", label: "Overview", icon: "home" },
  { href: "/console/keys", label: "API keys", icon: "key" },
  { href: "/console/usage", label: "Usage", icon: "chart" },
  { href: "/console/logs", label: "Request logs", icon: "list" },
  { href: "/console/playground", label: "Playground", icon: "play" },
  { href: "/console/settings", label: "Settings", icon: "settings" },
];

export default async function ConsoleLayout({ children }) {
  const session = await getSessionUser();
  if (!session) {
    return (
      <>
        <SiteHeader />
        <main className="flex-1">
          <AuthForm />
        </main>
        <SiteFooter />
      </>
    );
  }
  const links = [
    { href: "/docs", label: "API docs" },
    { href: "/maps", label: "Live map" },
    ...(session.user.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <DashShell nav={NAV} badge="Console" user={session.user} links={links}>
      {session.org.status === "suspended" && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-800">
          This account is suspended, so API calls are being refused. Contact support to restore access.
        </div>
      )}
      {children}
    </DashShell>
  );
}
