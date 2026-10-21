import Link from "next/link";
import AuthForm from "@/components/auth/AuthForm";
import DashShell from "@/components/dash/DashShell";
import { SiteHeader } from "@/components/SiteChrome";
import { getSessionUser } from "@/lib/auth";

export const metadata = { title: "Admin — Naksha Maps" };

const NAV = [
  { href: "/admin", label: "Overview", icon: "home" },
  { href: "/admin/orgs", label: "Organizations", icon: "building" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/keys", label: "API keys", icon: "key" },
  { href: "/admin/apis", label: "APIs", icon: "code" },
  { href: "/admin/logs", label: "Request logs", icon: "list" },
  { href: "/admin/engines", label: "Engines", icon: "server" },
  { href: "/admin/audit", label: "Audit log", icon: "shield" },
];

const LINKS = [
  { href: "/console", label: "Developer console" },
  { href: "/maps", label: "Live map" },
  { href: "/docs", label: "Docs" },
];

export default async function AdminLayout({ children }) {
  const session = await getSessionUser();

  if (!session) {
    return (
      <>
        <SiteHeader />
        <main className="flex-1">
          <AuthForm initialMode="login" title="Admin sign in" />
        </main>
      </>
    );
  }

  if (session.user.role !== "admin") {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-20">
          <p className="text-sm font-semibold text-amber-700">403 · Admins only</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">You don&apos;t have access to the admin area</h1>
          <p className="mt-3 text-slate-600">
            You&apos;re signed in as <b>{session.user.email}</b>, which is a regular account. Platform admins can manage every
            organisation, key and API.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700">
            <p className="font-medium text-slate-900">To get admin access, ask an existing admin, or on the server:</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-teal-100">npm run make-admin -- {session.user.email}</pre>
            <p className="mt-3">
              Or add the email to <code className="rounded bg-white px-1">ADMIN_EMAILS</code> in the app&apos;s environment and
              restart it.
            </p>
          </div>
          <Link href="/console" className="mt-6 inline-block text-sm font-medium text-teal-700 hover:underline">
            Go to your developer console →
          </Link>
        </main>
      </>
    );
  }

  return (
    <DashShell nav={NAV} badge="Admin" user={session.user} links={LINKS}>
      {children}
    </DashShell>
  );
}
