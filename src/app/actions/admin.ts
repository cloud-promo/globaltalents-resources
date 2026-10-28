"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify, audit } from "@/lib/notify";
import { slugify } from "@/lib/format";
import { ARTICLE_CATEGORIES } from "@/lib/ref";
import type { FormState } from "@/components/Form";

const str = (v: FormDataEntryValue | null, max = 5000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const staff = () => requireUser(["admin", "moderator"]);

export async function moderateCompany(data: FormData) {
  const u = await staff();
  const id = str(data.get("id"), 60);
  const op = str(data.get("op"));
  const status = { verify: "verified", reject: "rejected", suspend: "suspended", restore: "verified" }[op];
  if (!status) return;
  const c = await one<{ name: string }>(`UPDATE companies SET status=$2 WHERE id=$1 RETURNING name`, [id, status]);
  if (c) {
    const members = await query<{ user_id: string }>(`SELECT user_id FROM company_members WHERE company_id=$1`, [id]);
    for (const m of members) {
      await notify(m.user_id, status === "verified" ? "Votre entreprise est vérifiée" : "Votre entreprise n'a pas été validée",
        status === "verified" ? "Vos offres en attente vont être examinées et publiées." : "Contactez entreprises@globaltalents-resources.com pour plus d'informations.", "/recruteur");
    }
  }
  await audit(u.id, `company.${op}`, "company", id);
  revalidatePath("/", "layout");
}

export async function toggleCompanyFeatured(data: FormData) {
  const u = await staff();
  const id = str(data.get("id"), 60);
  await query(`UPDATE companies SET featured=NOT featured WHERE id=$1`, [id]);
  await audit(u.id, "company.feature", "company", id);
  revalidatePath("/", "layout");
}

export async function moderateJob(data: FormData) {
  const u = await staff();
  const id = Number(data.get("id"));
  const op = str(data.get("op"));
  const job = await one<{ title: string; company_id: string; created_by: string | null; company_status: string }>(
    `SELECT j.title,j.company_id,j.created_by,c.status company_status FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.id=$1`,
    [id],
  );
  if (!job) return;
  if (op === "publish") {
    await query(
      `UPDATE jobs SET status='published',reject_reason='',published_at=coalesce(published_at,now()),
         expires_at=CASE WHEN expires_at < now() + interval '7 days' THEN now() + interval '56 days' ELSE expires_at END WHERE id=$1`,
      [id],
    );
    if (job.created_by) await notify(job.created_by, `Offre publiée : ${job.title}`, job.company_status === "verified" ? "Elle est visible par les candidats." : "Elle sera visible dès la vérification de votre entreprise.", "/recruteur/offres");
  }
  if (op === "reject") {
    const reason = str(data.get("reason"), 300) || "Offre non conforme à la charte de publication.";
    await query(`UPDATE jobs SET status='rejected',reject_reason=$2 WHERE id=$1`, [id, reason]);
    // Le crédit consommé est rendu à l'entreprise
    await query(`UPDATE companies SET job_credits=job_credits+1 WHERE id=$1`, [job.company_id]);
    if (job.created_by) await notify(job.created_by, `Offre refusée : ${job.title}`, `Motif : ${reason}. Votre crédit vous a été rendu.`, "/recruteur/offres");
  }
  if (op === "unpublish") await query(`UPDATE jobs SET status='archived' WHERE id=$1`, [id]);
  if (op === "feature") await query(`UPDATE jobs SET featured=NOT featured WHERE id=$1`, [id]);
  await audit(u.id, `job.${op}`, "job", String(id));
  revalidatePath("/", "layout");
}

export async function resolveReport(data: FormData) {
  const u = await staff();
  const id = Number(data.get("id"));
  await query(`UPDATE job_reports SET resolved=true WHERE id=$1`, [id]);
  await audit(u.id, "report.resolve", "report", String(id));
  revalidatePath("/admin/offres");
}

export async function toggleUserSuspended(data: FormData) {
  const u = await requireUser(["admin"]);
  const id = str(data.get("id"), 60);
  if (id === u.id) return;
  await query(`UPDATE users SET suspended=NOT suspended WHERE id=$1`, [id]);
  await query(`DELETE FROM sessions WHERE user_id=$1`, [id]);
  await audit(u.id, "user.suspend_toggle", "user", id);
  revalidatePath("/admin/utilisateurs");
}

export async function grantCredits(data: FormData) {
  const u = await requireUser(["admin"]);
  const id = str(data.get("id"), 60);
  const jobs = Math.max(0, Math.min(100, Number(data.get("jobs")) || 0));
  const cvs = Math.max(0, Math.min(1000, Number(data.get("cvs")) || 0));
  await query(`UPDATE companies SET job_credits=job_credits+$2, cv_credits=cv_credits+$3 WHERE id=$1`, [id, jobs, cvs]);
  await audit(u.id, "company.grant_credits", "company", id, { jobs, cvs });
  revalidatePath("/admin/entreprises");
}

export async function saveArticle(_: FormState, data: FormData): Promise<FormState> {
  const u = await staff();
  const title = str(data.get("title"), 160);
  const body = str(data.get("body"), 20000);
  const excerpt = str(data.get("excerpt"), 300);
  const category = str(data.get("category"), 60);
  if (title.length < 5 || body.length < 100 || !excerpt) return { error: "Titre, chapeau et texte (100 caractères minimum) sont obligatoires." };
  if (!ARTICLE_CATEGORIES.includes(category as never)) return { error: "Choisissez une catégorie." };
  const id = Number(data.get("id")) || null;
  const published = data.get("published") === "on";
  if (id) {
    await query(`UPDATE articles SET title=$2,excerpt=$3,body=$4,category=$5,published=$6 WHERE id=$1`, [id, title, excerpt, body, category, published]);
  } else {
    let slug = slugify(title);
    if (await one(`SELECT 1 FROM articles WHERE slug=$1`, [slug])) slug += "-" + Date.now().toString(36);
    await query(`INSERT INTO articles(slug,title,excerpt,body,category,published) VALUES($1,$2,$3,$4,$5,$6)`, [slug, title, excerpt, body, category, published]);
  }
  await audit(u.id, id ? "article.update" : "article.create", "article", String(id ?? title));
  revalidatePath("/", "layout");
  return { ok: id ? "Article mis à jour." : "Article créé." };
}
