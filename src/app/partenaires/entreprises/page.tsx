import Link from "next/link";
import { requirePartnerStaff } from "@/lib/auth";
import { query } from "@/lib/db";
import { money, shortDate } from "@/lib/format";
import { COMPANY_STATUS_LABELS } from "@/lib/ref";

export const metadata = { title: "Portefeuille entreprises" };
export const dynamic = "force-dynamic";

export default async function Portfolio({ searchParams }: { searchParams: Promise<{ q?: string; vue?: string; statut?: string }> }) {
  const u = await requirePartnerStaff();
  const sp = await searchParams;
  const mine = sp.vue !== "toutes";
  const status = Object.keys(COMPANY_STATUS_LABELS).includes(sp.statut ?? "") ? sp.statut! : null;
  const rows = await query<{ id: string; name: string; city: string; country: string; status: string; plan: string | null; plan_expires_at: string | null; job_credits: number; manager: string | null; active_jobs: number; apps30: number; revenue: number; open_tickets: number; featured: boolean }>(
    `SELECT c.id,c.name,c.city,co.name country,c.status,p.name plan,c.plan_expires_at,c.job_credits,
       m.first_name||' '||m.last_name manager,
       (c.featured AND (c.featured_until IS NULL OR c.featured_until>now())) featured,
       (SELECT count(*)::int FROM jobs j WHERE j.company_id=c.id AND j.status='published' AND j.expires_at>now()) active_jobs,
       (SELECT count(*)::int FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=c.id AND a.created_at>now()-interval '30 days') apps30,
       (SELECT coalesce(sum(amount),0)::int FROM payments pa WHERE pa.company_id=c.id AND pa.status='paid') revenue,
       (SELECT count(*)::int FROM support_tickets t WHERE t.company_id=c.id AND t.status IN ('ouvert','en_cours','attente_client')) open_tickets
     FROM companies c JOIN countries co ON co.code=c.country_code LEFT JOIN plans p ON p.code=c.plan_code LEFT JOIN users m ON m.id=c.account_manager_id
     WHERE ($1::boolean IS FALSE OR c.account_manager_id=$2) AND ($3::text IS NULL OR c.status=$3)
       AND ($4::text IS NULL OR c.name ILIKE '%'||$4||'%' OR c.city ILIKE '%'||$4||'%')
     ORDER BY c.name LIMIT 300`,
    [mine, u.id, status, sp.q?.trim() || null],
  );
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Portefeuille entreprises</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} className="input w-64" placeholder="Nom ou ville" aria-label="Rechercher" />
        <select name="vue" defaultValue={mine ? "mes" : "toutes"} className="input w-auto" aria-label="Portefeuille">
          <option value="mes">Mon portefeuille</option>
          <option value="toutes">Toutes les entreprises</option>
        </select>
        <select name="statut" defaultValue={status ?? ""} className="input w-auto" aria-label="Statut">
          <option value="">Tous les statuts</option>
          {Object.entries(COMPANY_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn btn-ghost">Filtrer</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line text-left text-ink-soft">
            <tr><th className="p-3">Entreprise</th><th className="p-3">Formule</th><th className="p-3">Activité</th><th className="p-3">Encaissé</th><th className="p-3">Chargé de compte</th><th className="p-3">Support</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="p-3">
                  <Link href={`/partenaires/entreprises/${c.id}`} className="font-semibold hover:text-indigo">{c.name}</Link>
                  <span className="block text-ink-soft">{c.city}, {c.country} · {COMPANY_STATUS_LABELS[c.status]}{c.featured && " · mise en avant"}</span>
                </td>
                <td className="p-3">{c.plan ?? "Sans formule"}{c.plan_expires_at && <span className="block text-xs text-ink-soft">jusqu&apos;au {shortDate(c.plan_expires_at)}</span>}<span className="block text-xs text-ink-soft">{c.job_credits} crédit(s)</span></td>
                <td className="p-3">{c.active_jobs} offre(s) en ligne<span className="block text-xs text-ink-soft">{c.apps30} candidatures sur 30 j</span></td>
                <td className="p-3">{money(c.revenue)}</td>
                <td className="p-3">{c.manager ?? <span className="text-clay">Non attribué</span>}</td>
                <td className="p-3">{c.open_tickets ? <span className="chip bg-saffron-soft text-ochre">{c.open_tickets} en cours</span> : "–"}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className="p-6 text-ink-soft">{mine ? "Aucune entreprise ne vous est encore attribuée. Choisissez « Toutes les entreprises »." : "Aucune entreprise."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
