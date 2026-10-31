import { query } from "@/lib/db";
import { money, shortDate } from "@/lib/format";
import { PAYMENT_PROVIDERS } from "@/lib/ref";

export const metadata = { title: "Paiements" };
export const dynamic = "force-dynamic";

export default async function AdminPayments() {
  const [rows, byProvider] = await Promise.all([
    query<{ id: string; created_at: string; company: string | null; plan: string; amount: number; provider: string; phone: string; status: string; reference: string; invoice_number: string | null }>(
      `SELECT p.id,p.created_at,c.name company,pl.name plan,p.amount,p.provider,p.phone,p.status,p.reference,p.invoice_number
       FROM payments p LEFT JOIN companies c ON c.id=p.company_id JOIN plans pl ON pl.code=p.plan_code ORDER BY p.created_at DESC LIMIT 300`,
    ),
    query<{ provider: string; n: number; total: number }>(
      `SELECT provider,count(*)::int n,coalesce(sum(amount),0)::int total FROM payments WHERE status='paid' GROUP BY provider ORDER BY total DESC`,
    ),
  ]);
  const STATUS: Record<string, string> = { pending: "En attente", paid: "Payé", failed: "Échoué", cancelled: "Annulé", expired: "Expiré" };
  const label = (c: string) => PAYMENT_PROVIDERS.find((p) => p.code === c)?.label ?? c;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Paiements</h1>
      <p className="text-sm text-ink-soft">
        Mode actuel : {process.env.PAYMENTS_MODE === "ewari" ? `e-Wari (${(process.env.EWARI_SECRET_KEY || "").startsWith("sk_live_") ? "production" : "bac à sable"})` : "démonstration (aucun encaissement réel)"}.
      </p>
      <ul className="flex flex-wrap gap-2">
        {byProvider.map((p) => <li key={p.provider} className="card px-4 py-3 text-sm"><strong>{label(p.provider)}</strong> : {p.n} paiement(s), {money(p.total)}</li>)}
      </ul>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line text-left text-ink-soft">
            <tr><th className="p-3">Date</th><th className="p-3">Entreprise</th><th className="p-3">Formule</th><th className="p-3">Montant</th><th className="p-3">Moyen</th><th className="p-3">Statut</th><th className="p-3">Référence</th><th className="p-3">Facture</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3">{shortDate(r.created_at)}</td><td className="p-3">{r.company}</td><td className="p-3">{r.plan}</td>
                <td className="p-3">{money(r.amount)}</td><td className="p-3">{label(r.provider)}{r.phone && <span className="block text-xs text-ink-soft">{r.phone}</span>}</td>
                <td className="p-3">{STATUS[r.status]}</td><td className="p-3 font-mono text-xs">{r.reference}</td><td className="p-3">{r.invoice_number}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="p-4 text-ink-soft">Aucun paiement.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
