import "server-only";
import { query } from "./db";

// Notification dans l'application. L'envoi e-mail / WhatsApp / SMS se branchera ici (lot V1).
export async function notify(userId: string, title: string, body = "", link = "") {
  await query(`INSERT INTO notifications(user_id,title,body,link) VALUES($1,$2,$3,$4)`, [userId, title, body, link]);
  if (process.env.NODE_ENV !== "production") console.log(`[notification] ${userId} · ${title}`);
}

export async function audit(actorId: string | null, action: string, targetType = "", targetId = "", meta: object = {}) {
  await query(`INSERT INTO audit_log(actor_id,action,target_type,target_id,meta) VALUES($1,$2,$3,$4,$5)`, [
    actorId,
    action,
    targetType,
    targetId,
    JSON.stringify(meta),
  ]);
}

// Prévient toute l'équipe « gestion des partenaires » (gestionnaires et administrateurs)
export async function notifyPartnerTeam(title: string, body = "", link = "") {
  const team = await query<{ id: string }>(`SELECT id FROM users WHERE role IN ('partner_manager','admin') AND NOT suspended`);
  for (const t of team) await notify(t.id, title, body, link);
}
