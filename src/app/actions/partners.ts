"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query, one } from "@/lib/db";
import { requirePartnerStaff, requireRecruiter } from "@/lib/auth";
import { notify, audit, notifyPartnerTeam } from "@/lib/notify";
import { VERIFICATION_CHECKS, TICKET_CATEGORIES, TICKET_PRIORITY, TICKET_STATUS, NOTE_KINDS, FEATURE_DURATIONS } from "@/lib/partners";
import type { FormState } from "@/components/Form";

const str = (v: FormDataEntryValue | null, max = 5000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function notifyMembers(companyId: string, title: string, body: string, link: string) {
  const members = await query<{ user_id: string }>(`SELECT user_id FROM company_members WHERE company_id=$1`, [companyId]);
  for (const m of members) await notify(m.user_id, title, body, link);
}

// ---------- Inscription et vérification ----------

export async function saveVerification(data: FormData) {
  const u = await requirePartnerStaff();
  const id = str(data.get("id"), 60);
  const decision = str(data.get("decision"), 20);
  const checked = data.getAll("checks").map(String);
  const checks = Object.fromEntries(VERIFICATION_CHECKS.map((c) => [c.code, checked.includes(c.code)]));
  const comment = str(data.get("comment"), 1000);
  const company = await one<{ name: string; status: string; account_manager_id: string | null }>(
    `SELECT name,status,account_manager_id FROM companies WHERE id=$1`,
    [id],
  );
  if (!company) return;
  const verification = JSON.stringify({ checks, comment, by: u.id, at: new Date().toISOString() });

  if (decision === "verify" && checked.length < VERIFICATION_CHECKS.length) {
    // Validation impossible tant que tous les contrôles ne sont pas faits : on enregistre l'avancement
    await query(`UPDATE companies SET verification=$2 WHERE id=$1`, [id, verification]);
  } else if (decision === "verify") {
    await query(
      `UPDATE companies SET status='verified', verification=$2, verified_at=now(), reject_reason='', account_manager_id=coalesce(account_manager_id,$3) WHERE id=$1`,
      [id, verification, u.id],
    );
    await notifyMembers(id, "Votre entreprise est vérifiée", "Vos offres validées sont maintenant visibles par les candidats. Votre chargé de compte reste à votre disposition depuis l'onglet Support.", "/recruteur");
  } else if (decision === "reject") {
    const reason = str(data.get("reason"), 300) || "Les informations fournies n'ont pas pu être vérifiées.";
    await query(`UPDATE companies SET status='rejected', verification=$2, reject_reason=$3 WHERE id=$1`, [id, verification, reason]);
    await notifyMembers(id, "Votre entreprise n'a pas été validée", `Motif : ${reason} Répondez depuis l'onglet Support pour compléter votre dossier.`, "/recruteur/support");
  } else if (decision === "suspend") {
    const reason = str(data.get("reason"), 300) || "Suspension par l'équipe partenaires.";
    await query(`UPDATE companies SET status='suspended', reject_reason=$2 WHERE id=$1`, [id, reason]);
    await notifyMembers(id, "Votre compte entreprise est suspendu", `Motif : ${reason}`, "/recruteur/support");
  } else if (decision === "restore") {
    await query(`UPDATE companies SET status='verified', reject_reason='' WHERE id=$1`, [id]);
    await notifyMembers(id, "Votre compte entreprise est réactivé", "Vos offres sont de nouveau visibles.", "/recruteur");
  } else {
    await query(`UPDATE companies SET verification=$2 WHERE id=$1`, [id, verification]);
  }
  await audit(u.id, `partner.company.${decision || "check"}`, "company", id, { checks });
  revalidatePath("/", "layout");
}

export async function assignManager(data: FormData) {
  const u = await requirePartnerStaff();
  const id = str(data.get("id"), 60);
  const manager = str(data.get("manager_id"), 60) || null;
  if (manager && !(await one(`SELECT 1 FROM users WHERE id=$1 AND role IN ('partner_manager','admin')`, [manager]))) return;
  await query(`UPDATE companies SET account_manager_id=$2 WHERE id=$1`, [id, manager]);
  if (manager && manager !== u.id) await notify(manager, "Nouvelle entreprise dans votre portefeuille", "", `/partenaires/entreprises/${id}`);
  await audit(u.id, "partner.company.assign", "company", id, { manager });
  revalidatePath("/partenaires", "layout");
}

// ---------- Suivi de compte ----------

export async function addCompanyNote(_: FormState, data: FormData): Promise<FormState> {
  const u = await requirePartnerStaff();
  const id = str(data.get("id"), 60);
  const kind = Object.keys(NOTE_KINDS).includes(str(data.get("kind"))) ? str(data.get("kind")) : "note";
  const body = str(data.get("body"), 2000);
  if (!body) return { error: "Écrivez le contenu de la note." };
  await query(`INSERT INTO company_notes(company_id,author_id,kind,body) VALUES($1,$2,$3,$4)`, [id, u.id, kind, body]);
  revalidatePath(`/partenaires/entreprises/${id}`);
  return { ok: "Note ajoutée." };
}

export async function grantGesture(_: FormState, data: FormData): Promise<FormState> {
  const u = await requirePartnerStaff();
  const id = str(data.get("id"), 60);
  const jobs = Math.max(0, Math.min(20, Number(data.get("jobs")) || 0));
  const cvs = Math.max(0, Math.min(200, Number(data.get("cvs")) || 0));
  const reason = str(data.get("gesture_reason"), 300);
  if (!jobs && !cvs) return { error: "Indiquez au moins un crédit." };
  if (!reason) return { error: "Indiquez le motif du geste commercial (il est tracé)." };
  await query(`UPDATE companies SET job_credits=job_credits+$2, cv_credits=cv_credits+$3 WHERE id=$1`, [id, jobs, cvs]);
  await query(`INSERT INTO company_notes(company_id,author_id,kind,body) VALUES($1,$2,'geste',$3)`, [
    id, u.id, `${jobs} crédit(s) d'annonce et ${cvs} profil(s) CVthèque offerts. Motif : ${reason}`,
  ]);
  await notifyMembers(id, "Crédits offerts par Global Talents", `${jobs ? `${jobs} crédit(s) d'annonce ` : ""}${cvs ? `${cvs} profil(s) CVthèque ` : ""}ajoutés à votre compte.`, "/recruteur/abonnement");
  await audit(u.id, "partner.company.gesture", "company", id, { jobs, cvs, reason });
  revalidatePath(`/partenaires/entreprises/${id}`);
  return { ok: "Crédits ajoutés et entreprise prévenue." };
}

// ---------- Mises en avant ----------

export async function setFeatured(data: FormData) {
  const u = await requirePartnerStaff();
  const target = str(data.get("target")) === "job" ? "job" : "company";
  const id = str(data.get("id"), 60);
  const days = Number(data.get("days")) || 0;
  if (days && !(FEATURE_DURATIONS as readonly number[]).includes(days)) return;
  const table = target === "job" ? "jobs" : "companies";
  const row = await one<{ company_id: string; name: string }>(
    target === "job"
      ? `UPDATE jobs SET featured=$2, featured_until=CASE WHEN $2 THEN greatest(coalesce(featured_until,now()),now()) + make_interval(days => $3) END WHERE id=$1::int RETURNING company_id, title AS name`
      : `UPDATE companies SET featured=$2, featured_until=CASE WHEN $2 THEN greatest(coalesce(featured_until,now()),now()) + make_interval(days => $3) END WHERE id=$1::uuid RETURNING id AS company_id, name`,
    [id, days > 0, days],
  );
  if (!row) return;
  if (days > 0) {
    await notifyMembers(row.company_id, target === "job" ? `Offre à la une : ${row.name}` : "Votre entreprise est mise en avant", `Pour ${days} jours, en tête des résultats et sur la page d'accueil.`, target === "job" ? "/recruteur/offres" : "/recruteur/entreprise");
  }
  await audit(u.id, `partner.feature.${table}`, target, id, { days });
  revalidatePath("/", "layout");
}

// ---------- Support et service après-vente : côté équipe ----------

export async function staffReply(_: FormState, data: FormData): Promise<FormState> {
  const u = await requirePartnerStaff();
  const id = Number(data.get("ticket_id"));
  const body = str(data.get("body"), 4000);
  const internal = data.get("internal") === "on";
  if (!body) return { error: "Écrivez votre réponse." };
  const t = await one<{ opened_by: string | null; subject: string; status: string }>(`SELECT opened_by,subject,status FROM support_tickets WHERE id=$1`, [id]);
  if (!t) return { error: "Demande introuvable." };
  await query(`INSERT INTO ticket_messages(ticket_id,author_id,body,internal) VALUES($1,$2,$3,$4)`, [id, u.id, body, internal]);
  const next = internal ? t.status : Object.keys(TICKET_STATUS).includes(str(data.get("status"))) ? str(data.get("status")) : "attente_client";
  await query(
    `UPDATE support_tickets SET status=$2, updated_at=now(), assigned_to=coalesce(assigned_to,$3),
       resolved_at=CASE WHEN $2 IN ('resolu','ferme') THEN coalesce(resolved_at,now()) ELSE NULL END WHERE id=$1`,
    [id, next, u.id],
  );
  if (!internal && t.opened_by) {
    await notify(t.opened_by, `Réponse du support : ${t.subject}`, body.slice(0, 140), `/recruteur/support/${id}`);
  }
  revalidatePath(`/partenaires/support/${id}`);
  return { ok: internal ? "Note interne ajoutée." : "Réponse envoyée au client." };
}

export async function updateTicket(data: FormData) {
  const u = await requirePartnerStaff();
  const id = Number(data.get("ticket_id"));
  const status = str(data.get("status"));
  const priority = str(data.get("priority"));
  const assigned = str(data.get("assigned_to"), 60) || null;
  if (!Object.keys(TICKET_STATUS).includes(status) || !Object.keys(TICKET_PRIORITY).includes(priority)) return;
  await query(
    `UPDATE support_tickets SET status=$2, priority=$3, assigned_to=$4, updated_at=now(),
       resolved_at=CASE WHEN $2 IN ('resolu','ferme') THEN coalesce(resolved_at,now()) ELSE NULL END WHERE id=$1`,
    [id, status, priority, assigned],
  );
  if (assigned && assigned !== u.id) await notify(assigned, "Une demande de support vous est attribuée", "", `/partenaires/support/${id}`);
  await audit(u.id, "partner.ticket.update", "ticket", String(id), { status, priority, assigned });
  revalidatePath(`/partenaires/support/${id}`);
}

// ---------- Support : côté recruteur ----------

export async function openTicket(_: FormState, data: FormData): Promise<FormState> {
  const { user, company } = await requireRecruiter();
  const category = TICKET_CATEGORIES.some((c) => c.code === str(data.get("category"))) ? str(data.get("category")) : "autre";
  const subject = str(data.get("subject"), 140);
  const body = str(data.get("body"), 4000);
  const jobId = Number(data.get("job_id")) || null;
  if (subject.length < 4 || body.length < 10) return { error: "Précisez l'objet et décrivez votre demande." };
  if (jobId && !(await one(`SELECT 1 FROM jobs WHERE id=$1 AND company_id=$2`, [jobId, company.company_id]))) return { error: "Offre introuvable." };
  const priority = category === "paiement" || category === "technique" ? "haute" : "normale";
  const manager = (await one<{ account_manager_id: string | null }>(`SELECT account_manager_id FROM companies WHERE id=$1`, [company.company_id]))?.account_manager_id ?? null;
  const t = await one<{ id: number }>(
    `INSERT INTO support_tickets(company_id,opened_by,category,subject,priority,assigned_to,job_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [company.company_id, user.id, category, subject, priority, manager, jobId],
  );
  await query(`INSERT INTO ticket_messages(ticket_id,author_id,body) VALUES($1,$2,$3)`, [t!.id, user.id, body]);
  if (manager) await notify(manager, `Nouvelle demande de ${company.name}`, subject, `/partenaires/support/${t!.id}`);
  else await notifyPartnerTeam(`Nouvelle demande de ${company.name}`, subject, `/partenaires/support/${t!.id}`);
  redirect(`/recruteur/support/${t!.id}?envoye=1`);
}

async function ownTicket(id: number) {
  const { user, company } = await requireRecruiter();
  const t = await one<{ id: number; subject: string; assigned_to: string | null; status: string }>(
    `SELECT id,subject,assigned_to,status FROM support_tickets WHERE id=$1 AND company_id=$2`,
    [id, company.company_id],
  );
  return { user, company, t };
}

export async function recruiterReply(_: FormState, data: FormData): Promise<FormState> {
  const id = Number(data.get("ticket_id"));
  const { user, company, t } = await ownTicket(id);
  if (!t) return { error: "Demande introuvable." };
  const body = str(data.get("body"), 4000);
  if (!body) return { error: "Écrivez votre message." };
  await query(`INSERT INTO ticket_messages(ticket_id,author_id,body) VALUES($1,$2,$3)`, [id, user.id, body]);
  await query(`UPDATE support_tickets SET status='en_cours', resolved_at=NULL, updated_at=now() WHERE id=$1`, [id]);
  if (t.assigned_to) await notify(t.assigned_to, `Réponse de ${company.name}`, t.subject, `/partenaires/support/${id}`);
  else await notifyPartnerTeam(`Réponse de ${company.name}`, t.subject, `/partenaires/support/${id}`);
  revalidatePath(`/recruteur/support/${id}`);
  return { ok: "Message envoyé." };
}

export async function rateTicket(data: FormData) {
  const id = Number(data.get("ticket_id"));
  const { user, t } = await ownTicket(id);
  const score = Math.max(1, Math.min(5, Number(data.get("score")) || 0));
  if (!t || !["resolu", "ferme"].includes(t.status)) return;
  await query(`UPDATE support_tickets SET satisfaction=$2, status='ferme' WHERE id=$1`, [id, score]);
  await audit(user.id, "ticket.rate", "ticket", String(id), { score });
  revalidatePath(`/recruteur/support/${id}`);
}

// Un bouton = une action (la valeur du bouton cliqué n'est pas toujours transmise par le formulaire)
const withDecision = (decision: string) => async (data: FormData) => {
  data.set("decision", decision);
  return saveVerification(data);
};
export async function decideSave(data: FormData) { return withDecision("save")(data); }
export async function decideVerify(data: FormData) { return withDecision("verify")(data); }
export async function decideReject(data: FormData) { return withDecision("reject")(data); }
export async function decideSuspend(data: FormData) { return withDecision("suspend")(data); }
export async function decideRestore(data: FormData) { return withDecision("restore")(data); }
