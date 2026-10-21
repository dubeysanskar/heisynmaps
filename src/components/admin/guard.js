import { getSessionUser } from "@/lib/auth";

// Pages render in parallel with the layout, so each admin page re-checks the role
// before touching data. The layout shows the sign-in / 403 screen.
export async function adminSession() {
  const session = await getSessionUser();
  return session?.user.role === "admin" ? session : null;
}
