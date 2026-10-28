import { requireRecruiter } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { money, shortDate } from "@/lib/format";
import { PAYMENT_PROVIDERS } from "@/lib/ref";
import { ActionForm, Submit } from "@/components/Form";
import { startPayment } from "@/app/actions/recruiter";

export const metadata = { title: "Abonnement et factures" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ credits?: string }> }) {
  const { credits } = await searchParams;
  const { company } = await requireRecruiter();
  const [c, plans, payments] = await Promise.all([
    one<{ job_credits: number; cv_credits: number; cv_unlimited_until: string | null; plan_code: string | null; plan_expires_at: string | null }>(
      `SELECT job_credits,cv_credits,cv_unlimited_until,plan_code,plan_expires_at FROM companies WHERE id=$1`,
      [company.company_id],
    ),
    query<{ code: string; name: string; description: string; price_xof: number; period: string }>(`SELECT code,name,description,price_xof,period FROM plans ORDER BY sort`),
    query<{ id: string; plan: string; amount: number; provider: string; status: string; reference: string; invoice_number: string | null; created_at: string }>(
      `SELECT p.id,pl.name plan,p.amount,p.provider,p.status,p.reference,p.invoice_number,p.created_at FROM payments p JOIN plans pl ON pl.code=p.plan_code
       WHERE p.company_id=$1 ORDER BY p.created_at DESC LIMIT 30`,
      [company.company_id],
    ),
  ]);
  const unlimited = c?.cv_unlimited_until && new Date(c.cv_unlimited_until) > new Date();
  const STATUS: Record<string, string> = { pending: "En attente", paid: "Payé", failed: "Échoué", cancelled: "Annulé" };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Abonnement et factures</h1>
      {credits === "cv" && <p className="rounded-lg bg-saffron-soft p-3 text-sm">Vous n&apos;avez plus de crédit CVthèque. Choisissez une formule pour continuer à débloquer des profils.</p>}

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><dt className="text-sm text-ink-soft">Crédits d&apos;annonce</dt><dd className="font-display text-2xl font-bold">{c?.job_credits ?? 0}</dd></div>
        <div className="card p-4"><dt className="text-sm text-ink-soft">CVthèque</dt><dd className="font-display text-2xl font-bold">{unlimited ? "Illimitée" : `${c?.cv_credits ?? 0} profils`}</dd>{unlimited && <dd className="text-xs text-muted">jusqu&apos;au {shortDate(c!.cv_unlimited_until)}</dd>}</div>
        <div className="card p-4"><dt className="text-sm text-ink-soft">Abonnement</dt><dd className="font-display text-2xl font-bold">{c?.plan_code && c.plan_expires_at && new Date(c.plan_expires_at) > new Date() ? plans.find((p) => p.code === c.plan_code)?.name : "Aucun"}</dd>{c?.plan_expires_at && new Date(c.plan_expires_at) > new Date() && <dd className="text-xs text-muted">jusqu&apos;au {shortDate(c.plan_expires_at)}</dd>}</div>
      </dl>

      <ActionForm action={startPayment} className="card space-y-5 p-5">
        <fieldset>
          <legend className="text-lg font-bold">Choisir une formule</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {plans.map((p, i) => (
              <label key={p.code} className="flex cursor-pointer gap-3 rounded-lg border border-line p-4 has-[:checked]:border-indigo has-[:checked]:bg-wash">
                <input type="radio" name="plan" value={p.code} defaultChecked={i === 0} className="mt-1" />
                <span>
                  <span className="block font-semibold">{p.name}</span>
                  <span className="block text-sm text-ink-soft">{p.description}</span>
                  <span className="mt-1 block font-semibold">{money(p.price_xof)} HT{p.period === "month" ? " par mois" : ""}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-lg font-bold">Moyen de paiement</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {PAYMENT_PROVIDERS.map((p, i) => (
              <label key={p.code} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-indigo has-[:checked]:bg-wash">
                <input type="radio" name="provider" value={p.code} defaultChecked={i === 0} /> {p.label}
              </label>
            ))}
          </div>
          <label className="mt-3 block max-w-sm">
            <span className="label">Numéro Mobile Money qui va payer</span>
            <input name="phone" type="tel" className="input" placeholder="+221 77 123 45 67" />
            <span className="hint">Inutile pour un paiement par carte.</span>
          </label>
        </fieldset>
        <Submit pendingLabel="Préparation du paiement…">Continuer vers le paiement</Submit>
        <p className="text-xs text-muted">Grands comptes : paiement par virement sur facture, écrivez à entreprises@globaltalents-resources.com.</p>
      </ActionForm>

      <section className="card overflow-x-auto">
        <h2 className="p-4 pb-0 text-lg font-bold">Historique des paiements</h2>
        <table className="mt-2 w-full min-w-[620px] text-sm">
          <thead className="border-b border-line text-left text-ink-soft">
            <tr><th className="p-3">Date</th><th className="p-3">Formule</th><th className="p-3">Montant</th><th className="p-3">Moyen</th><th className="p-3">Statut</th><th className="p-3">Facture</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="p-3">{shortDate(p.created_at)}</td>
                <td className="p-3">{p.plan}</td>
                <td className="p-3">{money(p.amount)}</td>
                <td className="p-3">{PAYMENT_PROVIDERS.find((x) => x.code === p.provider)?.label}</td>
                <td className="p-3">{STATUS[p.status]}</td>
                <td className="p-3">{p.invoice_number ? <a href={`/recruteur/factures/${p.id}`} className="text-indigo hover:underline">{p.invoice_number}</a> : p.status === "pending" ? <a href={`/recruteur/paiement/${p.id}`} className="text-indigo hover:underline">Finaliser</a> : ""}</td>
              </tr>
            ))}
            {!payments.length && <tr><td colSpan={6} className="p-4 text-ink-soft">Aucun paiement.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
