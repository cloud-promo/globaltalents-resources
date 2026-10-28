"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { z } from "zod";
import { one, query, tx } from "@/lib/db";
import { requireRecruiter, hashPassword } from "@/lib/auth";
import { notify, audit } from "@/lib/notify";
import { STAGES, CONTRACT_TYPES, stageOf, PAYMENT_PROVIDERS } from "@/lib/ref";
import type { FormState } from "@/components/Form";

const str = (v: FormDataEntryValue | null, max = 5000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const STAGE_CODES = STAGES.map((s) => s.code) as [string, ...string[]];

async function ownJob(companyId: string, jobId: number) {
  return one<{ id: number; title: string; status: string; company_id: string }>(
    `SELECT id,title,status,company_id FROM jobs WHERE id=$1 AND company_id=$2`,
    [jobId, companyId],
  );
}

async function ownApplication(companyId: string, appId: string) {
  if (!/^[0-9a-f-]{36}$/.test(appId)) return null;
  return one<{ id: string; stage: string; candidate_id: string; job_id: number; title: string; viewed_at: string | null }>(
    `SELECT a.id,a.stage,a.candidate_id,a.job_id,j.title,a.viewed_at FROM applications a JOIN jobs j ON j.id=a.job_id
     WHERE a.id=$1 AND j.company_id=$2`,
    [appId, companyId],
  );
}

// ---------- Offres ----------

const jobSchema = z.object({
  title: z.string().trim().min(3, "Indiquez l'intitulé du poste").max(140),
  function_id: z.coerce.number().int().positive("Choisissez la fonction"),
  sector_id: z.coerce.number().int().positive("Choisissez le secteur"),
  country_code: z.enum(["SN", "CI", "ML", "BF", "NE", "GN"], { message: "Choisissez le pays" }),
  city: z.string().trim().min(1, "Indiquez la ville").max(80),
  contract_type: z.enum(CONTRACT_TYPES, { message: "Choisissez le type de contrat" }),
  experience_level: z.string().min(1, "Choisissez le niveau d'expérience"),
  study_level: z.string().min(1, "Choisissez le niveau d'études"),
  remote: z.enum(["non", "hybride", "total"]),
  positions: z.coerce.number().int().min(1).max(500),
  salary_min: z.coerce.number().int().min(0).max(1_000_000_000).optional().or(z.literal("").transform(() => undefined)),
  salary_max: z.coerce.number().int().min(0).max(1_000_000_000).optional().or(z.literal("").transform(() => undefined)),
  description: z.string().trim().min(80, "La description du poste doit faire au moins 80 caractères").max(8000),
  profile: z.string().trim().max(5000),
  benefits: z.string().trim().max(3000),
  duration: z.coerce.number().int().refine((v) => [15, 30, 45, 56].includes(v), "Durée invalide"),
});

function parseJob(data: FormData) {
  const parsed = jobSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const d = parsed.data;
  if (d.salary_min && d.salary_max && d.salary_min > d.salary_max) return { error: "Le salaire minimum dépasse le salaire maximum." } as const;
  const skills = str(data.get("skills"), 600).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 15);
  const languages = data.getAll("languages").map(String).slice(0, 6);
  const questions: { q: string; elim: boolean; exp: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const q = str(data.get(`question_${i}`), 200);
    if (q) questions.push({ q, elim: data.get(`elim_${i}`) === "on", exp: str(data.get(`expected_${i}`)) === "non" ? "non" : "oui" });
  }
  return {
    d,
    skills,
    languages,
    questions,
    show_salary: data.get("show_salary") === "on",
    management: data.get("management") === "on",
    confidential: data.get("confidential") === "on",
  } as const;
}

export async function saveJob(_: FormState, data: FormData): Promise<FormState> {
  const { user, company } = await requireRecruiter();
  const parsed = parseJob(data);
  if ("error" in parsed) return { error: parsed.error };
  const { d, skills, languages, questions, show_salary, management, confidential } = parsed;
  const jobId = Number(data.get("job_id")) || null;
  const asDraft = data.get("intent") === "draft";

  if (jobId) {
    const job = await ownJob(company.company_id, jobId);
    if (!job) return { error: "Offre introuvable." };
    // Une offre publiée modifiée repasse en modération
    const nextStatus = asDraft ? "draft" : job.status === "draft" || job.status === "rejected" ? "pending" : job.status === "published" ? "pending" : job.status;
    if (job.status === "draft" && !asDraft) {
      const ok = await consumeJobCredit(company.company_id);
      if (!ok) return { error: "Vous n'avez plus de crédit d'annonce. Achetez un pack pour soumettre cette offre." };
    }
    await tx(async (c) => {
      await c.query(
        `UPDATE jobs SET title=$2,function_id=$3,sector_id=$4,country_code=$5,city=$6,contract_type=$7,experience_level=$8,study_level=$9,
           remote=$10,positions=$11,salary_min=$12,salary_max=$13,show_salary=$14,description=$15,profile=$16,benefits=$17,skills=$18,
           languages=$19,management=$20,confidential=$21,status=$22,reject_reason='',updated_at=now() WHERE id=$1`,
        [jobId, d.title, d.function_id, d.sector_id, d.country_code, d.city, d.contract_type, d.experience_level, d.study_level, d.remote,
         d.positions, d.salary_min ?? null, d.salary_max ?? null, show_salary, d.description, d.profile, d.benefits, skills, languages,
         management, confidential, nextStatus],
      );
      await c.query(`DELETE FROM job_questions WHERE job_id=$1`, [jobId]);
      for (const [i, q] of questions.entries()) {
        await c.query(`INSERT INTO job_questions(job_id,question,eliminatory,expected,sort) VALUES($1,$2,$3,$4,$5)`, [jobId, q.q, q.elim, q.exp, i]);
      }
    });
    await audit(user.id, "job.update", "job", String(jobId));
    revalidatePath("/recruteur", "layout");
    redirect(`/recruteur/offres?maj=${jobId}`);
  }

  if (!asDraft) {
    const ok = await consumeJobCredit(company.company_id);
    if (!ok) return { error: "Vous n'avez plus de crédit d'annonce. Enregistrez-la en brouillon, puis achetez un pack." };
  }
  const id = await tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO jobs(company_id,created_by,title,function_id,sector_id,country_code,city,contract_type,experience_level,study_level,remote,
         positions,salary_min,salary_max,show_salary,description,profile,benefits,skills,languages,management,confidential,status,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23, now() + ($24 || ' days')::interval) RETURNING id`,
      [company.company_id, user.id, d.title, d.function_id, d.sector_id, d.country_code, d.city, d.contract_type, d.experience_level,
       d.study_level, d.remote, d.positions, d.salary_min ?? null, d.salary_max ?? null, show_salary, d.description, d.profile, d.benefits,
       skills, languages, management, confidential, asDraft ? "draft" : "pending", String(d.duration)],
    );
    for (const [i, q] of questions.entries()) {
      await c.query(`INSERT INTO job_questions(job_id,question,eliminatory,expected,sort) VALUES($1,$2,$3,$4,$5)`, [rows[0].id, q.q, q.elim, q.exp, i]);
    }
    return rows[0].id as number;
  });
  await audit(user.id, asDraft ? "job.draft" : "job.submit", "job", String(id));
  revalidatePath("/recruteur", "layout");
  redirect(`/recruteur/offres?${asDraft ? "brouillon" : "soumise"}=${id}`);
}

async function consumeJobCredit(companyId: string) {
  const r = await query(`UPDATE companies SET job_credits=job_credits-1 WHERE id=$1 AND job_credits>0 RETURNING job_credits`, [companyId]);
  return r.length > 0;
}

export async function jobAction(data: FormData) {
  const { user, company } = await requireRecruiter();
  const jobId = Number(data.get("job_id"));
  const op = str(data.get("op"));
  const job = await ownJob(company.company_id, jobId);
  if (!job) return;
  if (op === "close") await query(`UPDATE jobs SET status='archived',updated_at=now() WHERE id=$1`, [jobId]);
  if (op === "extend" && job.status === "published") await query(`UPDATE jobs SET expires_at=greatest(expires_at,now()) + interval '28 days' WHERE id=$1`, [jobId]);
  if (op === "duplicate") {
    await query(
      `INSERT INTO jobs(company_id,created_by,title,function_id,sector_id,country_code,city,contract_type,experience_level,study_level,remote,positions,
         salary_min,salary_max,show_salary,description,profile,benefits,skills,languages,management,confidential,status,expires_at)
       SELECT company_id,$2,title||' (copie)',function_id,sector_id,country_code,city,contract_type,experience_level,study_level,remote,positions,
         salary_min,salary_max,show_salary,description,profile,benefits,skills,languages,management,confidential,'draft',now()+interval '56 days'
       FROM jobs WHERE id=$1`,
      [jobId, user.id],
    );
  }
  await audit(user.id, `job.${op}`, "job", String(jobId));
  revalidatePath("/recruteur", "layout");
}

// ---------- Pipeline ----------

export async function moveApplication(data: FormData) {
  const { user, company } = await requireRecruiter();
  const app = await ownApplication(company.company_id, str(data.get("id"), 60));
  const stage = z.enum(STAGE_CODES).safeParse(data.get("stage"));
  if (!app || !stage.success || app.stage === stage.data) return;
  const s = stageOf(stage.data);
  await tx(async (c) => {
    await c.query(`UPDATE applications SET stage=$2,updated_at=now(),viewed_at=coalesce(viewed_at,now()) WHERE id=$1`, [app.id, s.code]);
    await c.query(`INSERT INTO application_events(application_id,kind,label,actor_id) VALUES($1,'stage',$2,$3)`, [
      app.id, `Étape : ${s.candidate}`, user.id,
    ]);
  });
  await notify(app.candidate_id, `Votre candidature avance : ${app.title}`, `Nouveau statut : ${s.candidate}.`, "/candidat/candidatures");
  revalidatePath("/recruteur", "layout");
}

export async function bulkMove(data: FormData) {
  const { user, company } = await requireRecruiter();
  const ids = data.getAll("ids").map(String).slice(0, 200);
  const stage = z.enum(STAGE_CODES).safeParse(data.get("stage"));
  if (!stage.success) return;
  const s = stageOf(stage.data);
  for (const id of ids) {
    const app = await ownApplication(company.company_id, id);
    if (!app || app.stage === s.code) continue;
    await query(`UPDATE applications SET stage=$2,updated_at=now(),viewed_at=coalesce(viewed_at,now()) WHERE id=$1`, [app.id, s.code]);
    await query(`INSERT INTO application_events(application_id,kind,label,actor_id) VALUES($1,'stage',$2,$3)`, [app.id, `Étape : ${s.candidate}`, user.id]);
    await notify(app.candidate_id, `Votre candidature avance : ${app.title}`, `Nouveau statut : ${s.candidate}.`, "/candidat/candidatures");
  }
  revalidatePath("/recruteur", "layout");
}

export async function addNote(_: FormState, data: FormData): Promise<FormState> {
  const { user, company } = await requireRecruiter();
  const app = await ownApplication(company.company_id, str(data.get("id"), 60));
  if (!app) return { error: "Candidature introuvable." };
  const body = str(data.get("body"), 3000);
  const rating = Number(data.get("rating")) || null;
  if (!body && !rating) return { error: "Écrivez une note ou donnez une évaluation." };
  await query(`INSERT INTO application_notes(application_id,author_id,body,rating) VALUES($1,$2,$3,$4)`, [app.id, user.id, body, rating && rating >= 1 && rating <= 5 ? rating : null]);
  revalidatePath(`/recruteur/candidatures/${app.id}`);
  return { ok: "Note ajoutée. Elle n'est visible que par votre équipe." };
}

export async function messageCandidate(_: FormState, data: FormData): Promise<FormState> {
  const { user, company } = await requireRecruiter();
  const app = await ownApplication(company.company_id, str(data.get("id"), 60));
  if (!app) return { error: "Candidature introuvable." };
  const body = str(data.get("body"), 2000);
  if (body.length < 5) return { error: "Le message est trop court." };
  await query(`INSERT INTO application_events(application_id,kind,label,actor_id) VALUES($1,'message',$2,$3)`, [app.id, `Message du recruteur : ${body}`, user.id]);
  await notify(app.candidate_id, `Message de ${company.name}`, body.slice(0, 300), "/candidat/candidatures");
  revalidatePath(`/recruteur/candidatures/${app.id}`);
  return { ok: "Message envoyé au candidat." };
}

// ---------- CVthèque ----------

export async function unlockCandidate(data: FormData) {
  const { user, company } = await requireRecruiter();
  const candidateId = str(data.get("candidate_id"), 60);
  const visible = await one(`SELECT 1 FROM candidate_profiles WHERE user_id=$1 AND visible_cvtheque`, [candidateId]);
  if (!visible) return;
  const already = await one(`SELECT 1 FROM cv_unlocks WHERE company_id=$1 AND candidate_id=$2`, [company.company_id, candidateId]);
  if (!already) {
    const unlimited = await one(`SELECT 1 FROM companies WHERE id=$1 AND cv_unlimited_until>now()`, [company.company_id]);
    if (!unlimited) {
      const r = await query(`UPDATE companies SET cv_credits=cv_credits-1 WHERE id=$1 AND cv_credits>0 RETURNING 1`, [company.company_id]);
      if (!r.length) redirect("/recruteur/abonnement?credits=cv");
    }
    await query(`INSERT INTO cv_unlocks(company_id,candidate_id,unlocked_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [company.company_id, candidateId, user.id]);
    await audit(user.id, "cvtheque.unlock", "user", candidateId);
  }
  revalidatePath("/recruteur/cvtheque");
}

// ---------- Entreprise et équipe ----------

export async function updateCompany(_: FormState, data: FormData): Promise<FormState> {
  const { user, company } = await requireRecruiter();
  if (company.role !== "admin") return { error: "Seul un administrateur de l'entreprise peut modifier cette page." };
  const website = str(data.get("website"), 200);
  if (website && !/^https?:\/\//.test(website)) return { error: "Le site web doit commencer par https://" };
  const color = str(data.get("brand_color"), 7);
  await query(
    `UPDATE companies SET description=$2,culture=$3,benefits=$4,website=$5,city=$6,brand_color=$7 WHERE id=$1`,
    [company.company_id, str(data.get("description"), 3000), str(data.get("culture"), 2000), str(data.get("benefits"), 2000), website,
     str(data.get("city"), 80), /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#2B3A8C"],
  );
  await audit(user.id, "company.update", "company", company.company_id);
  revalidatePath("/", "layout");
  return { ok: "Page entreprise enregistrée." };
}

export async function addMember(_: FormState, data: FormData): Promise<FormState> {
  const { user, company } = await requireRecruiter();
  if (company.role !== "admin") return { error: "Seul un administrateur de l'entreprise peut gérer l'équipe." };
  const email = str(data.get("email"), 200).toLowerCase();
  const role = ["admin", "recruiter", "manager"].includes(str(data.get("role"))) ? str(data.get("role")) : "recruiter";
  if (!z.string().email().safeParse(email).success) return { error: "Adresse e-mail invalide." };
  let target = await one<{ id: string; role: string }>(`SELECT id,role FROM users WHERE email=$1`, [email]);
  let tempPassword = "";
  if (!target) {
    // Création du compte du collègue avec un mot de passe temporaire à lui transmettre
    tempPassword = crypto.randomBytes(9).toString("base64url");
    const first = str(data.get("first_name"), 80);
    const last = str(data.get("last_name"), 80);
    target = await one<{ id: string; role: string }>(
      `INSERT INTO users(email,password_hash,role,first_name,last_name) VALUES($1,$2,'recruiter',$3,$4) RETURNING id,role`,
      [email, await hashPassword(tempPassword), first, last],
    );
  }
  if (!target) return { error: "Impossible de créer ce compte." };
  if (target.role !== "recruiter") return { error: "Cette adresse correspond à un compte candidat. Votre collègue doit utiliser une adresse professionnelle distincte." };
  if (await one(`SELECT 1 FROM company_members WHERE user_id=$1`, [target.id])) return { error: "Ce compte est déjà rattaché à une entreprise." };
  await query(`INSERT INTO company_members(company_id,user_id,role) VALUES($1,$2,$3)`, [company.company_id, target.id, role]);
  await notify(target.id, `Vous avez rejoint ${company.name}`, "Vous pouvez maintenant gérer ses offres et ses candidatures.", "/recruteur");
  await audit(user.id, "company.member_add", "user", target.id, { role });
  revalidatePath("/recruteur/equipe");
  return {
    ok: tempPassword
      ? `Compte créé pour ${email}. Mot de passe temporaire à lui transmettre : ${tempPassword} (à changer dès la première connexion).`
      : "Membre ajouté.",
  };
}

export async function removeMember(data: FormData) {
  const { user, company } = await requireRecruiter();
  const target = str(data.get("user_id"), 60);
  if (company.role !== "admin" || target === user.id) return;
  await query(`DELETE FROM company_members WHERE company_id=$1 AND user_id=$2`, [company.company_id, target]);
  await audit(user.id, "company.member_remove", "user", target);
  revalidatePath("/recruteur/equipe");
}

// ---------- Paiement (mode démonstration tant que l'agrégateur n'est pas branché) ----------

export async function startPayment(_: FormState, data: FormData): Promise<FormState> {
  const { user, company } = await requireRecruiter();
  const plan = await one<{ code: string; price_xof: number }>(`SELECT code,price_xof FROM plans WHERE code=$1`, [str(data.get("plan"), 40)]);
  if (!plan) return { error: "Choisissez une formule." };
  const provider = str(data.get("provider"), 30);
  if (!PAYMENT_PROVIDERS.some((p) => p.code === provider)) return { error: "Choisissez un moyen de paiement." };
  const phone = str(data.get("phone"), 30);
  if (provider !== "card" && phone.replace(/\D/g, "").length < 8) return { error: "Indiquez le numéro Mobile Money qui va payer." };
  const reference = "GTR-" + crypto.randomBytes(5).toString("hex").toUpperCase();
  const p = await one<{ id: string }>(
    `INSERT INTO payments(company_id,user_id,plan_code,amount,currency,provider,phone,reference) VALUES($1,$2,$3,$4,'XOF',$5,$6,$7) RETURNING id`,
    [company.company_id, user.id, plan.code, plan.price_xof, provider, phone, reference],
  );
  await audit(user.id, "payment.start", "payment", p!.id, { plan: plan.code, provider });
  redirect(`/recruteur/paiement/${p!.id}`);
}

export async function confirmDemoPayment(data: FormData) {
  const { user, company } = await requireRecruiter();
  if (process.env.PAYMENTS_MODE === "live") return; // en production, seul le webhook de l'agrégateur valide un paiement
  const id = str(data.get("id"), 60);
  const outcome = str(data.get("outcome"));
  const pay = await one<{ id: string; plan_code: string; status: string }>(
    `SELECT id,plan_code,status FROM payments WHERE id=$1 AND company_id=$2`,
    [id, company.company_id],
  );
  if (!pay || pay.status !== "pending") return;
  if (outcome !== "paid") {
    await query(`UPDATE payments SET status='failed' WHERE id=$1`, [id]);
    revalidatePath(`/recruteur/paiement/${id}`);
    return;
  }
  await applyPayment(pay.id, company.company_id, pay.plan_code);
  await audit(user.id, "payment.paid", "payment", id);
  revalidatePath("/recruteur", "layout");
}

async function applyPayment(paymentId: string, companyId: string, planCode: string) {
  await tx(async (c) => {
    const plan = (await c.query(`SELECT * FROM plans WHERE code=$1`, [planCode])).rows[0];
    const year = new Date().getFullYear();
    const n = (await c.query(
      `INSERT INTO invoice_counter(year,last) VALUES($1,1) ON CONFLICT (year) DO UPDATE SET last=invoice_counter.last+1 RETURNING last`,
      [year],
    )).rows[0].last;
    await c.query(`UPDATE payments SET status='paid',paid_at=now(),invoice_number=$2 WHERE id=$1`, [paymentId, `FA-${year}-${String(n).padStart(5, "0")}`]);
    await c.query(
      `UPDATE companies SET job_credits=job_credits+$2, cv_credits=cv_credits+$3,
         cv_unlimited_until = CASE WHEN $4 THEN greatest(coalesce(cv_unlimited_until,now()),now()) + ($5 || ' days')::interval ELSE cv_unlimited_until END,
         plan_code = CASE WHEN $6='month' THEN $7 ELSE plan_code END,
         plan_expires_at = CASE WHEN $6='month' THEN greatest(coalesce(plan_expires_at,now()),now()) + ($5 || ' days')::interval ELSE plan_expires_at END
       WHERE id=$1`,
      [companyId, plan.job_credits, plan.cv_credits, plan.cv_unlimited, String(plan.duration_days), plan.period, plan.code],
    );
  });
}
