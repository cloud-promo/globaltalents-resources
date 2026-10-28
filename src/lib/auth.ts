import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import crypto from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { one, query } from "./db";

const COOKIE = "gtr_session";
const SESSION_DAYS = 30;

export type Role = "candidate" | "recruiter" | "admin" | "moderator";
export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  first_name: string;
  last_name: string;
  phone: string;
  country_code: string | null;
};

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function hashPassword(pw: string) {
  return hash(pw);
}

export async function checkPassword(hashStr: string, pw: string) {
  try {
    return await verify(hashStr, pw);
  } catch {
    return false;
  }
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await query(`INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,$3)`, [sha(token), userId, expires]);
  await query(`UPDATE users SET last_login_at=now() WHERE id=$1`, [userId]);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await query(`DELETE FROM sessions WHERE id=$1`, [sha(token)]);
  jar.delete(COOKIE);
}

export const getUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return one<CurrentUser>(
    `SELECT u.id,u.email,u.role,u.first_name,u.last_name,u.phone,u.country_code
       FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.id=$1 AND s.expires_at>now() AND NOT u.suspended`,
    [sha(token)],
  );
});

export async function requireUser(roles?: Role[]) {
  const u = await getUser();
  if (!u) redirect("/connexion");
  if (roles && !roles.includes(u.role)) redirect("/");
  return u;
}

export type Membership = { company_id: string; role: "admin" | "recruiter" | "manager"; name: string; slug: string; status: string };

export const getMembership = cache(async (userId: string) => {
  return one<Membership>(
    `SELECT m.company_id,m.role,c.name,c.slug,c.status FROM company_members m JOIN companies c ON c.id=m.company_id
      WHERE m.user_id=$1 ORDER BY c.created_at LIMIT 1`,
    [userId],
  );
});

export async function requireRecruiter() {
  const u = await requireUser(["recruiter"]);
  const m = await getMembership(u.id);
  if (!m) redirect("/recruteurs/inscription");
  return { user: u, company: m };
}

// Limite simple des tentatives de connexion (mémoire du processus)
const attempts = new Map<string, { n: number; until: number }>();
export function tooManyAttempts(key: string) {
  const a = attempts.get(key);
  return !!a && a.n >= 8 && a.until > Date.now();
}
export function recordAttempt(key: string, ok: boolean) {
  if (ok) {
    attempts.delete(key);
    return;
  }
  const a = attempts.get(key);
  const until = Date.now() + 15 * 60_000;
  attempts.set(key, { n: (a && a.until > Date.now() ? a.n : 0) + 1, until });
}
