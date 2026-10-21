import { getSessionUser } from "@/lib/auth";

// Always 200 so signed-out visitors don't produce console errors; check `session`.
export async function GET() {
  return Response.json({ session: await getSessionUser() });
}
