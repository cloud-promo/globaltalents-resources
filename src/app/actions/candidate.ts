"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { one, query, tx } from "@/lib/db";
import { requireUser, checkPassword, hashPassword, destroySession, getUser } from "@/lib/auth";
import { getJob, getQuestions, getMatchProfile } from "@/lib/jobs";
import { matchScore } from "@/lib/match";
import { notify, audit } from "@/lib/notify";
import type { FormState } from "@/components/Form";
import { jobPath } from "@/lib/format";

const str = (v: FormDataEntryValue | null, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function candidate() {
  return requireUser(["candidate"]);
}

// ---------- Offres sauvegardées, alertes, entreprises ----------

export async function toggleSaveJob(data: FormData) {
  const u = await getUser();
  const jobId = Number(data.get("job_id"));
  if (!u) redirect(`/connexion?next=${encodeURIComponent("/offres")}`);
  if (u.role !== "candidate" || !jobId) return;
  const del = await query(`DELETE FROM saved_jobs WHERE user_id=$1 AND job_id=$2 RETURNING 1`, [u.id, jobId]);
  if (!del.length) await query(`INSERT INTO saved_jobs(user_id,job_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [u.id, jobId]);
  revalidatePath("/", "layout");
}

export async function saveSearchAsAlert(data: FormData) {
  const u = await candidate();
  let q: Record<string, string> = {};
  try {
    q = JSON.parse(str(data.get("query"), 2000) || "{}");
  } catch {
    q = {};
  }
  const name = str(data.get("name"), 80) || "Ma recherche";
  await query(`INSERT INTO alerts(user_id,name,query) VALUES($1,$2,$3)`, [u.id, name, JSON.stringify(q)]);
  redirect("/candidat/alertes?cree=1");
}

export async function updateAlert(data: FormData) {
  const u = await candidate();
  const id = Number(data.get("id"));
  const op = str(data.get("op"));
  if (op === "delete") await query(`DELETE FROM alerts WHERE id=$1 AND user_id=$2`, [id, u.id]);
  if (op === "toggle_email") await query(`UPDATE alerts SET email=NOT email WHERE id=$1 AND user_id=$2`, [id, u.id]);
  if (op === "toggle_whatsapp") await query(`UPDATE alerts SET whatsapp=NOT whatsapp WHERE id=$1 AND user_id=$2`, [id, u.id]);
  if (op === "rename") await query(`UPDATE alerts SET name=$3 WHERE id=$1 AND user_id=$2`, [id, u.id, str(data.get("name"), 80) || "Ma recherche"]);
  revalidatePath("/candidat/alertes");
}

export async function toggleCompanyRelation(data: FormData) {
  const u = await getUser();
  if (!u) redirect("/connexion");
  if (u.role !== "candidate") return;
  const companyId = str(data.get("company_id"), 60);
  const kind = str(data.get("kind")) === "hide" ? "hidden_companies" : "followed_companies";
  const del = await query(`DELETE FROM ${kind} WHERE user_id=$1 AND company_id=$2 RETURNING 1`, [u.id, companyId]);
  if (!del.length) await query(`INSERT INTO ${kind}(user_id,company_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [u.id, companyId]);
  revalidatePath("/", "layout");
}

export async function markNotificationsRead() {
  const u = await candidate();
  await query(`UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL`, [u.id]);
  revalidatePath("/", "layout");
}

export async function reportJob(_: FormState, data: FormData): Promise<FormState> {
  const u = await getUser();
  const jobId = Number(data.get("job_id"));
  const reason = str(data.get("reason"), 500);
  if (!jobId || reason.length < 5) return { error: "Décrivez le problème en quelques mots." };
  await query(`INSERT INTO job_reports(job_id,user_id,reason) VALUES($1,$2,$3)`, [jobId, u?.id ?? null, reason]);
  return { ok: "Merci. L'équipe de modération va vérifier cette offre." };
}

// ---------- Candidature ----------

export async function applyToJob(_: FormState, data: FormData): Promise<FormState> {
  const u = await candidate();
  const jobId = Number(data.get("job_id"));
  const job = await getJob(jobId);
  if (!job) return { error: "Cette offre n'est plus disponible." };
  if (await one(`SELECT 1 FROM applications WHERE job_id=$1 AND candidate_id=$2`, [jobId, u.id])) {
    return { error: "Vous avez déjà postulé à cette offre." };
  }

  const documentId = str(data.get("document_id"), 60);
  const doc = documentId
    ? await one<{ id: string }>(`SELECT id FROM documents WHERE id=$1 AND user_id=$2`, [documentId, u.id])
    : await one<{ id: string }>(`SELECT id FROM documents WHERE user_id=$1 AND kind='cv' ORDER BY is_primary DESC, created_at DESC LIMIT 1`, [u.id]);
  if (!doc) return { error: "Ajoutez d'abord un CV à votre profil." };

  const questions = await getQuestions(jobId);
  const answers = questions.map((q) => ({ question: q.question, answer: str(data.get(`q_${q.id}`), 10) }));
  if (answers.some((a) => !a.answer)) return { error: "Répondez à toutes les questions de présélection." };
  const failed = questions.some((q, i) => q.eliminatory && answers[i].answer !== q.expected);

  const profile = await getMatchProfile(u.id);
  const m = profile ? matchScore(profile, job) : { score: 0, reasons: [] };

  const appId = await tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO applications(job_id,candidate_id,document_id,cover_letter,answers,score,score_reasons,anonymous,share_test,failed_screening)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        jobId, u.id, doc.id, str(data.get("cover_letter"), 4000), JSON.stringify(answers), m.score, JSON.stringify(m.reasons),
        data.get("anonymous") === "on", data.get("share_test") === "on", failed,
      ],
    );
    await c.query(`INSERT INTO application_events(application_id,kind,label,actor_id) VALUES($1,'sent','Candidature envoyée',$2)`, [rows[0].id, u.id]);
    return rows[0].id as string;
  });

  const members = await query<{ user_id: string }>(`SELECT user_id FROM company_members WHERE company_id=$1`, [job.company_id]);
  for (const mbr of members) {
    await notify(mbr.user_id, `Nouvelle candidature : ${job.title}`, `Score de correspondance : ${m.score} %`, `/recruteur/candidatures/${appId}`);
  }
  await notify(u.id, `Candidature envoyée : ${job.title}`, "Suivez son avancement dans Mes candidatures.", "/candidat/candidatures");
  revalidatePath(jobPath(job.id, job.title, job.city));
  redirect(`/candidat/candidatures?envoyee=${appId}`);
}

export async function withdrawApplication(data: FormData) {
  const u = await candidate();
  await query(`DELETE FROM applications WHERE id=$1 AND candidate_id=$2 AND stage IN ('nouvelle','preselection')`, [str(data.get("id"), 60), u.id]);
  revalidatePath("/candidat/candidatures");
}

// ---------- Profil ----------

const COUNTRY_CODES = ["SN", "CI", "ML", "BF", "NE", "GN"];

export async function updateIdentity(_: FormState, data: FormData): Promise<FormState> {
  const u = await candidate();
  const s = z
    .object({
      first_name: z.string().trim().min(1, "Indiquez votre prénom").max(80),
      last_name: z.string().trim().min(1, "Indiquez votre nom").max(80),
      phone: z.string().trim().min(6, "Indiquez un numéro de téléphone").max(30),
      country_code: z.enum(["SN", "CI", "ML", "BF", "NE", "GN"]),
      city: z.string().trim().max(80),
      nationality: z.string().trim().max(80),
      birth_date: z.string().max(10).optional(),
      title: z.string().trim().max(120),
      linkedin_url: z.string().trim().max(300).refine((v) => !v || /^https?:\/\//.test(v), "Le lien LinkedIn doit commencer par https://"),
    })
    .safeParse(Object.fromEntries(data));
  if (!s.success) return { error: s.error.issues[0].message };
  const d = s.data;
  await query(`UPDATE users SET first_name=$2,last_name=$3,phone=$4,country_code=$5 WHERE id=$1`, [u.id, d.first_name, d.last_name, d.phone, d.country_code]);
  await query(
    `UPDATE candidate_profiles SET city=$2,nationality=$3,birth_date=$4,title=$5,linkedin_url=$6,updated_at=now() WHERE user_id=$1`,
    [u.id, d.city, d.nationality, d.birth_date || null, d.title, d.linkedin_url],
  );
  revalidatePath("/candidat", "layout");
  return { ok: "Informations enregistrées." };
}

export async function updateSummary(_: FormState, data: FormData): Promise<FormState> {
  const u = await candidate();
  await query(`UPDATE candidate_profiles SET summary=$2,updated_at=now() WHERE user_id=$1`, [u.id, str(data.get("summary"), 1500)]);
  revalidatePath("/candidat", "layout");
  return { ok: "Résumé enregistré." };
}

export async function updateWishes(_: FormState, data: FormData): Promise<FormState> {
  const u = await candidate();
  const fns = data.getAll("desired_function_ids").map(Number).filter(Boolean).slice(0, 3);
  const countries = data.getAll("search_countries").map(String).filter((c) => COUNTRY_CODES.includes(c));
  const current = Number(data.get("current_function_id")) || null;
  await query(
    `UPDATE candidate_profiles SET experience_level=$2,study_level=$3,current_function_id=$4,desired_function_ids=$5,search_countries=$6,
       current_salary=$7,desired_salary=$8,availability=$9,updated_at=now() WHERE user_id=$1`,
    [u.id, str(data.get("experience_level"), 30), str(data.get("study_level"), 30), current, fns, countries,
     str(data.get("current_salary"), 60), str(data.get("desired_salary"), 60), str(data.get("availability"), 60)],
  );
  revalidatePath("/candidat", "layout");
  return { ok: "Souhaits enregistrés. Les scores de correspondance sont mis à jour." };
}

export async function addExperience(_: FormState, data: FormData): Promise<FormState> {
  const u = await candidate();
  const title = str(data.get("title"), 120);
  const company = str(data.get("company"), 120);
  const start = str(data.get("start_date"), 10);
  const end = str(data.get("end_date"), 10);
  if (!title || !company || !start) return { error: "Indiquez le poste, l'entreprise et la date de début." };
  if (end && end < start) return { error: "La date de fin doit suivre la date de début." };
  await query(`INSERT INTO experiences(user_id,title,company,city,start_date,end_date,description) VALUES($1,$2,$3,$4,$5,$6,$7)`, [
    u.id, title, company, str(data.get("city"), 80), start + (start.length === 7 ? "-01" : ""), end ? end + (end.length === 7 ? "-01" : "") : null,
    str(data.get("description"), 2000),
  ]);
  revalidatePath("/candidat", "layout");
  return { ok: "Expérience ajoutée." };
}

export async function addEducation(_: FormState, data: FormData): Promise<FormState> {
  const u = await candidate();
  const degree = str(data.get("degree"), 120);
  const school = str(data.get("school"), 160);
  if (!degree || !school) return { error: "Indiquez le diplôme et l'établissement." };
  const year = Number(data.get("year_end")) || null;
  await query(`INSERT INTO educations(user_id,degree,school,field,year_end) VALUES($1,$2,$3,$4,$5)`, [u.id, degree, school, str(data.get("field"), 160), year]);
  revalidatePath("/candidat", "layout");
  return { ok: "Formation ajoutée." };
}

export async function addSkill(_: FormState, data: FormData): Promise<FormState> {
  const u = await candidate();
  const names = str(data.get("name"), 300).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
  if (!names.length) return { error: "Saisissez au moins une compétence." };
  for (const n of names) await query(`INSERT INTO candidate_skills(user_id,name) VALUES($1,$2) ON CONFLICT DO NOTHING`, [u.id, n.slice(0, 60)]);
  revalidatePath("/candidat", "layout");
  return { ok: `${names.length} compétence${names.length > 1 ? "s ajoutées" : " ajoutée"}.` };
}

export async function addLanguage(_: FormState, data: FormData): Promise<FormState> {
  const u = await candidate();
  const name = str(data.get("name"), 40);
  const level = str(data.get("level"), 40);
  if (!name || !level) return { error: "Choisissez la langue et le niveau." };
  await query(`INSERT INTO candidate_languages(user_id,name,level) VALUES($1,$2,$3) ON CONFLICT (user_id,name) DO UPDATE SET level=EXCLUDED.level`, [u.id, name, level]);
  revalidatePath("/candidat", "layout");
  return { ok: "Langue enregistrée." };
}

export async function removeProfileItem(data: FormData) {
  const u = await candidate();
  const kind = str(data.get("kind"));
  const id = str(data.get("id"), 120);
  if (kind === "experience") await query(`DELETE FROM experiences WHERE id=$1 AND user_id=$2`, [id, u.id]);
  if (kind === "education") await query(`DELETE FROM educations WHERE id=$1 AND user_id=$2`, [id, u.id]);
  if (kind === "skill") await query(`DELETE FROM candidate_skills WHERE name=$1 AND user_id=$2`, [id, u.id]);
  if (kind === "language") await query(`DELETE FROM candidate_languages WHERE name=$1 AND user_id=$2`, [id, u.id]);
  if (kind === "document") await query(`DELETE FROM documents WHERE id=$1 AND user_id=$2`, [id, u.id]);
  revalidatePath("/candidat", "layout");
}

const MAX_FILE = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export async function uploadDocument(_: FormState, data: FormData): Promise<FormState> {
  const u = await candidate();
  const file = data.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier." };
  if (file.size > MAX_FILE) return { error: "Le fichier dépasse 5 Mo." };
  if (!ALLOWED[file.type]) return { error: "Formats acceptés : PDF, DOC, DOCX, ou photo JPG / PNG du CV." };
  const kind = str(data.get("kind")) === "other" ? "other" : "cv";
  const buf = Buffer.from(await file.arrayBuffer());
  // Vérification de la signature du fichier (ne pas faire confiance au type annoncé)
  const sig = buf.subarray(0, 4).toString("hex");
  const okSig = ["25504446", "504b0304", "d0cf11e0", "ffd8ffe0", "ffd8ffe1", "ffd8ffdb", "ffd8ffee", "89504e47"].includes(sig);
  if (!okSig) return { error: "Ce fichier ne semble pas être un PDF, un document Word ou une image valide." };
  const count = await one<{ n: number }>(`SELECT count(*)::int n FROM documents WHERE user_id=$1`, [u.id]);
  if ((count?.n ?? 0) >= 10) return { error: "Vous avez atteint la limite de 10 documents. Supprimez-en un d'abord." };
  await tx(async (c) => {
    const hasPrimary = await c.query(`SELECT 1 FROM documents WHERE user_id=$1 AND kind='cv' AND is_primary`, [u.id]);
    const primary = kind === "cv" && (data.get("primary") === "on" || !hasPrimary.rowCount);
    if (primary) await c.query(`UPDATE documents SET is_primary=false WHERE user_id=$1`, [u.id]);
    await c.query(`INSERT INTO documents(user_id,kind,filename,mime,size,data,is_primary) VALUES($1,$2,$3,$4,$5,$6,$7)`, [
      u.id, kind, file.name.replace(/[^\w.\- ()À-ÿ]/g, "_").slice(0, 120), file.type, file.size, buf, primary,
    ]);
  });
  revalidatePath("/candidat", "layout");
  return { ok: kind === "cv" ? "CV ajouté." : "Document ajouté." };
}

export async function setPrimaryDocument(data: FormData) {
  const u = await candidate();
  const id = str(data.get("id"), 60);
  await tx(async (c) => {
    const d = await c.query(`SELECT 1 FROM documents WHERE id=$1 AND user_id=$2`, [id, u.id]);
    if (!d.rowCount) return;
    await c.query(`UPDATE documents SET is_primary=false WHERE user_id=$1`, [u.id]);
    await c.query(`UPDATE documents SET is_primary=true, kind='cv' WHERE id=$1`, [id]);
  });
  revalidatePath("/candidat", "layout");
}

// ---------- Paramètres ----------

export async function updateSettings(_: FormState, data: FormData): Promise<FormState> {
  const u = await candidate();
  const b = (k: string) => data.get(k) === "on";
  await query(
    `UPDATE candidate_profiles SET visible_cvtheque=$2,public_profile=$3,show_photo=$4,share_test=$5,notify_cv_viewed=$6,
       newsletter=$7,newsletter_frequency=$8,partner_offers=$9,whatsapp_alerts=$10,updated_at=now() WHERE user_id=$1`,
    [u.id, b("visible_cvtheque"), b("public_profile"), b("show_photo"), b("share_test"), b("notify_cv_viewed"), b("newsletter"),
     str(data.get("newsletter_frequency")) === "mensuelle" ? "mensuelle" : "hebdomadaire", b("partner_offers"), b("whatsapp_alerts")],
  );
  revalidatePath("/candidat", "layout");
  return { ok: "Paramètres enregistrés." };
}

export async function changePassword(_: FormState, data: FormData): Promise<FormState> {
  const u = await requireUser();
  const row = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id=$1`, [u.id]);
  if (!row || !(await checkPassword(row.password_hash, str(data.get("current"), 200)))) return { error: "Le mot de passe actuel est incorrect." };
  const next = str(data.get("next"), 200);
  if (next.length < 8) return { error: "Le nouveau mot de passe doit contenir au moins 8 caractères." };
  if (next !== str(data.get("confirm"), 200)) return { error: "Les deux nouveaux mots de passe ne sont pas identiques." };
  await query(`UPDATE users SET password_hash=$2 WHERE id=$1`, [u.id, await hashPassword(next)]);
  await audit(u.id, "user.password_change", "user", u.id);
  return { ok: "Mot de passe modifié." };
}

export async function changeEmail(_: FormState, data: FormData): Promise<FormState> {
  const u = await requireUser();
  const e = z.string().trim().toLowerCase().email().safeParse(data.get("email"));
  if (!e.success) return { error: "Adresse e-mail invalide." };
  const row = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id=$1`, [u.id]);
  if (!row || !(await checkPassword(row.password_hash, str(data.get("password"), 200)))) return { error: "Mot de passe incorrect." };
  if (await one(`SELECT 1 FROM users WHERE email=$1 AND id<>$2`, [e.data, u.id])) return { error: "Cette adresse est déjà utilisée." };
  await query(`UPDATE users SET email=$2 WHERE id=$1`, [u.id, e.data]);
  await audit(u.id, "user.email_change", "user", u.id);
  revalidatePath("/candidat/parametres");
  return { ok: "Adresse e-mail modifiée. Elle sert désormais d'identifiant de connexion." };
}

export async function deleteAccount(_: FormState, data: FormData): Promise<FormState> {
  const u = await candidate();
  if (str(data.get("confirm")) !== "SUPPRIMER") return { error: "Tapez SUPPRIMER pour confirmer." };
  await audit(u.id, "user.delete", "user", u.id, { email: u.email });
  await query(`DELETE FROM users WHERE id=$1`, [u.id]);
  await destroySession();
  redirect("/?compte-supprime=1");
}
