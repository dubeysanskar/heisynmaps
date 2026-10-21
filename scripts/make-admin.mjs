// Promote an existing account to platform admin:
//   npm run make-admin -- you@company.com
// Uses DATABASE_URL (Postgres) when set, otherwise the local SQLite file.
import { getDb } from "../src/lib/db.js";

const email = String(process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run make-admin -- <email>");
  process.exit(1);
}
const db = await getDb();
const { changes } = await db.run("UPDATE users SET role = 'admin' WHERE email = ?", [email]);
console.log(changes ? `${email} is now an admin. Open /admin.` : `No account with email ${email}. Sign up first at /console.`);
process.exit(changes ? 0 : 1);
