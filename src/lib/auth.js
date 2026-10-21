import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { getDb, newId, now } from "./db";

export const SESSION_COOKIE = "naksha_session";
const SESSION_DAYS = 30;

export function getSecret() {
  if (process.env.NAKSHA_SECRET) return process.env.NAKSHA_SECRET;
  // Dev convenience: persist a generated secret next to the SQLite file.
  const file = path.resolve(/*turbopackIgnore: true*/ "data/.secret");
  if (!globalThis.__nakshaSecret) {
    if (fs.existsSync(file)) {
      globalThis.__nakshaSecret = fs.readFileSync(file, "utf8").trim();
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      globalThis.__nakshaSecret = crypto.randomBytes(32).toString("hex");
      fs.writeFileSync(file, globalThis.__nakshaSecret);
    }
  }
  return globalThis.__nakshaSecret;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [, salt, hash] = String(stored).split("$");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

export async function createUser({ email, password, name, orgName }) {
  const db = await getDb();
  const normalized = String(email).trim().toLowerCase();
  if (await db.get("SELECT id FROM users WHERE email = ?", [normalized])) {
    throw new Error("An account with this email already exists");
  }
  const orgId = newId("org");
  const userId = newId("usr");
  await db.run("INSERT INTO orgs (id, name, plan, created_at) VALUES (?, ?, 'free', ?)", [
    orgId,
    orgName || `${name || normalized}'s team`,
    now(),
  ]);
  await db.run(
    "INSERT INTO users (id, org_id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, orgId, normalized, name || null, hashPassword(password), now()]
  );
  return { id: userId, orgId };
}

export async function authenticateUser(email, password) {
  const db = await getDb();
  const user = await db.get("SELECT * FROM users WHERE email = ?", [String(email).trim().toLowerCase()]);
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  return user;
}

export async function startSession(userId) {
  const db = await getDb();
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
    sha256(token),
    userId,
    expires.toISOString(),
  ]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.run("DELETE FROM sessions WHERE id = ?", [sha256(token)]);
  }
  jar.delete(SESSION_COOKIE);
}

// Returns { user, org } for the signed-in console user, or null.
export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const row = await db.get(
    `SELECT u.id, u.email, u.name, u.org_id, o.name AS org_name, o.plan, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id JOIN orgs o ON o.id = u.org_id
      WHERE s.id = ?`,
    [sha256(token)]
  );
  if (!row || row.expires_at < now()) return null;
  return {
    user: { id: row.id, email: row.email, name: row.name },
    org: { id: row.org_id, name: row.org_name, plan: row.plan },
  };
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
