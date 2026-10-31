"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { one, tx } from "@/lib/db";
import { checkPassword, createSession, destroySession, hashPassword, recordAttempt, tooManyAttempts, homeFor, type Role } from "@/lib/auth";
import { audit, notifyPartnerTeam } from "@/lib/notify";
import { slugify } from "@/lib/format";
import type { FormState } from "@/components/Form";

const email = z.string().trim().toLowerCase().email("Adresse e-mail invalide");
const password = z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères").max(200);

function safeNext(next: FormDataEntryValue | null) {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "";
}

export async function login(_: FormState, data: FormData): Promise<FormState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] || "local";
  const parsed = z.object({ email, password: z.string().min(1) }).safeParse({ email: data.get("email"), password: data.get("password") });
  if (!parsed.success) return { error: "Saisissez votre e-mail et votre mot de passe." };
  const key = `${ip}:${parsed.data.email}`;
  if (tooManyAttempts(key)) return { error: "Trop de tentatives. Réessayez dans 15 minutes." };

  const u = await one<{ id: string; password_hash: string; role: string; suspended: boolean }>(
    `SELECT id,password_hash,role,suspended FROM users WHERE email=$1`,
    [parsed.data.email],
  );
  const ok = !!u && (await checkPassword(u.password_hash, parsed.data.password));
  recordAttempt(key, ok);
  if (!u || !ok) return { error: "E-mail ou mot de passe incorrect." };
  if (u.suspended) return { error: "Ce compte est suspendu. Contactez le support." };

  await createSession(u.id);
  const next = safeNext(data.get("next"));
  redirect(next || homeFor(u.role as Role));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

const candidateSchema = z.object({
  first_name: z.string().trim().min(1, "Indiquez votre prénom").max(80),
  last_name: z.string().trim().min(1, "Indiquez votre nom").max(80),
  email,
  phone: z.string().trim().min(6, "Indiquez un numéro de téléphone").max(30),
  country_code: z.enum(["SN", "CI", "ML", "BF", "NE", "GN"], { message: "Choisissez votre pays" }),
  password,
  consent: z.literal("on", { message: "Vous devez accepter les conditions d'utilisation" }),
});

export async function registerCandidate(_: FormState, data: FormData): Promise<FormState> {
  const parsed = candidateSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const exists = await one(`SELECT 1 FROM users WHERE email=$1`, [d.email]);
  if (exists) return { error: "Un compte existe déjà avec cet e-mail. Connectez-vous." };

  const hashStr = await hashPassword(d.password);
  const id = await tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO users(email,password_hash,role,first_name,last_name,phone,country_code) VALUES($1,$2,'candidate',$3,$4,$5,$6) RETURNING id`,
      [d.email, hashStr, d.first_name, d.last_name, d.phone, d.country_code],
    );
    await c.query(`INSERT INTO candidate_profiles(user_id,search_countries) VALUES($1,$2)`, [rows[0].id, [d.country_code]]);
    await c.query(
      `INSERT INTO notifications(user_id,title,body,link) VALUES($1,'Bienvenue sur Global Talents Resources','Complétez votre profil et ajoutez votre CV pour recevoir des offres qui vous correspondent.','/candidat/profil')`,
      [rows[0].id],
    );
    return rows[0].id as string;
  });
  await audit(id, "candidate.register", "user", id);
  await createSession(id);
  redirect("/candidat/profil?bienvenue=1");
}

const recruiterSchema = z.object({
  company_name: z.string().trim().min(2, "Indiquez le nom de l'entreprise").max(120),
  country_code: z.enum(["SN", "CI", "ML", "BF", "NE", "GN"], { message: "Choisissez le pays" }),
  city: z.string().trim().min(1, "Indiquez la ville").max(80),
  sector_id: z.coerce.number().int().positive("Choisissez le secteur"),
  size_band: z.string().min(1, "Choisissez la taille"),
  registration_number: z.string().trim().min(3, "Indiquez le RCCM ou le NINEA").max(60),
  first_name: z.string().trim().min(1, "Indiquez votre prénom").max(80),
  last_name: z.string().trim().min(1, "Indiquez votre nom").max(80),
  job_title: z.string().trim().max(80).optional(),
  email,
  phone: z.string().trim().min(6, "Indiquez un numéro de téléphone").max(30),
  password,
  consent: z.literal("on", { message: "Vous devez accepter les conditions d'utilisation" }),
});

export async function registerRecruiter(_: FormState, data: FormData): Promise<FormState> {
  const parsed = recruiterSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (await one(`SELECT 1 FROM users WHERE email=$1`, [d.email])) return { error: "Un compte existe déjà avec cet e-mail." };

  const hashStr = await hashPassword(d.password);
  let slug = slugify(d.company_name) || "entreprise";
  if (await one(`SELECT 1 FROM companies WHERE slug=$1`, [slug])) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const userId = await tx(async (c) => {
    const u = await c.query(
      `INSERT INTO users(email,password_hash,role,first_name,last_name,phone,country_code) VALUES($1,$2,'recruiter',$3,$4,$5,$6) RETURNING id`,
      [d.email, hashStr, d.first_name, d.last_name, d.phone, d.country_code],
    );
    const co = await c.query(
      `INSERT INTO companies(name,slug,country_code,city,sector_id,size_band,registration_number) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [d.company_name, slug, d.country_code, d.city, d.sector_id, d.size_band, d.registration_number],
    );
    await c.query(`INSERT INTO company_members(company_id,user_id,role) VALUES($1,$2,'admin')`, [co.rows[0].id, u.rows[0].id]);
    return u.rows[0].id as string;
  });
  await audit(userId, "company.register", "company", slug);
  await notifyPartnerTeam(`Nouvelle inscription entreprise : ${d.company_name}`, "À vérifier sous 24 h ouvrées.", "/partenaires/inscriptions");
  await createSession(userId);
  redirect("/recruteur?bienvenue=1");
}
