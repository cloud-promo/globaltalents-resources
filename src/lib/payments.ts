import "server-only";
import { one, tx } from "./db";
import { notify, audit } from "./notify";
import { getEwariPayment, type EwariPayment } from "./ewari";

/* Crédite l'entreprise une seule fois : la ligne passe de « pending » à « paid » dans la même transaction
   que l'ajout des crédits. Un webhook rejoué ou une vérification en parallèle ne crédite rien de plus. */
export async function markPaid(paymentId: string, extra: { fee?: number | null; payer?: string } = {}) {
  const done = await tx(async (c) => {
    const row = (await c.query(
      `UPDATE payments SET status='paid',paid_at=now(),fee=$2,payer=$3 WHERE id=$1 AND status='pending' RETURNING company_id,plan_code,user_id`,
      [paymentId, extra.fee ?? null, extra.payer ?? ""],
    )).rows[0];
    if (!row) return null;
    const plan = (await c.query(`SELECT * FROM plans WHERE code=$1`, [row.plan_code])).rows[0];
    const year = new Date().getFullYear();
    const n = (await c.query(
      `INSERT INTO invoice_counter(year,last) VALUES($1,1) ON CONFLICT (year) DO UPDATE SET last=invoice_counter.last+1 RETURNING last`,
      [year],
    )).rows[0].last;
    await c.query(`UPDATE payments SET invoice_number=$2 WHERE id=$1`, [paymentId, `FA-${year}-${String(n).padStart(5, "0")}`]);
    await c.query(
      `UPDATE companies SET job_credits=job_credits+$2, cv_credits=cv_credits+$3,
         cv_unlimited_until = CASE WHEN $4 THEN greatest(coalesce(cv_unlimited_until,now()),now()) + ($5 || ' days')::interval ELSE cv_unlimited_until END,
         plan_code = CASE WHEN $6='month' THEN $7 ELSE plan_code END,
         plan_expires_at = CASE WHEN $6='month' THEN greatest(coalesce(plan_expires_at,now()),now()) + ($5 || ' days')::interval ELSE plan_expires_at END
       WHERE id=$1`,
      [row.company_id, plan.job_credits, plan.cv_credits, plan.cv_unlimited, String(plan.duration_days), plan.period, plan.code],
    );
    return { userId: row.user_id as string | null, plan: plan.name as string };
  });
  if (done) {
    await audit(null, "payment.paid", "payment", paymentId);
    if (done.userId) await notify(done.userId, "Paiement reçu", `${done.plan} : vos crédits ont été ajoutés.`, `/recruteur/paiement/${paymentId}`);
  }
  return !!done;
}

export async function markClosed(paymentId: string, status: "failed" | "cancelled" | "expired", reason = "") {
  const r = await one(`UPDATE payments SET status=$2,failure_reason=$3 WHERE id=$1 AND status='pending' RETURNING id`, [paymentId, status, reason.slice(0, 300)]);
  if (r) await audit(null, `payment.${status}`, "payment", paymentId, { reason });
  return !!r;
}

type Local = { id: string; amount: number; currency: string; reference: string; status: string };

/* Aligne un paiement local sur l'état e-Wari. N'accepte un paiement que si le montant, la devise
   et la référence correspondent exactement à ce que Global Talents a demandé. */
export async function reconcile(local: Local, remote: EwariPayment) {
  if (local.status !== "pending") return local.status;
  if (remote.reference !== local.reference || Number(remote.amount) !== local.amount || remote.currency !== local.currency) {
    await audit(null, "payment.mismatch", "payment", local.id, { remote: { reference: remote.reference, amount: remote.amount, currency: remote.currency } });
    return "pending";
  }
  if (remote.status === "succeeded") {
    const payer = [remote.payer?.method, remote.payer?.phone].filter(Boolean).join(" ");
    await markPaid(local.id, { fee: remote.fee ?? null, payer });
    return "paid";
  }
  if (remote.status === "failed" || remote.status === "cancelled" || remote.status === "expired") {
    await markClosed(local.id, remote.status, remote.failure_reason || "");
    return remote.status;
  }
  return "pending";
}

/* Vérification active, utilisée par la page de paiement et en secours si un webhook se perd. */
export async function refreshFromEwari(paymentId: string) {
  const local = await one<Local & { provider: string; provider_payment_id: string | null }>(
    `SELECT id,amount,currency,reference,status,provider,provider_payment_id FROM payments WHERE id=$1`,
    [paymentId],
  );
  if (!local || local.provider !== "ewari" || !local.provider_payment_id || local.status !== "pending") return local?.status ?? null;
  const remote = await getEwariPayment(local.provider_payment_id);
  return reconcile(local, remote);
}
