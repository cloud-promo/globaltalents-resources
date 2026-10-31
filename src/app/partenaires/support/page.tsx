import Link from "next/link";
import { requirePartnerStaff } from "@/lib/auth";
import { query } from "@/lib/db";
import { since } from "@/lib/format";
import { TICKET_STATUS, TICKET_PRIORITY, SLA_HOURS, TICKET_CATEGORIES, staffStatus, categoryLabel } from "@/lib/partners";

export const metadata = { title: "Support et service après-vente" };
export const dynamic = "force-dynamic";

export default async function SupportList({ searchParams }: { searchParams: Promise<{ statut?: string; vue?: string; cat?: string }> }) {
  const u = await requirePartnerStaff();
  const sp = await searchParams;
  const open = sp.statut !== "clos";
  const mine = sp.vue === "mes";
  const cat = TICKET_CATEGORIES.some((c) => c.code === sp.cat) ? sp.cat! : null;
  const rows = await query<{ id: number; subject: string; category: string; status: string; priority: string; company: string; company_id: string; created_at: string; updated_at: string; assignee: string | null; messages: number; satisfaction: number | null }>(
    `SELECT t.id,t.subject,t.category,t.status,t.priority,c.name company,c.id company_id,t.created_at,t.updated_at,t.satisfaction,
       a.first_name assignee,(SELECT count(*)::int FROM ticket_messages m WHERE m.ticket_id=t.id) messages
     FROM support_tickets t JOIN companies c ON c.id=t.company_id LEFT JOIN users a ON a.id=t.assigned_to
     WHERE (t.status IN ('ouvert','en_cours','attente_client')) = $1 AND ($2::boolean IS FALSE OR t.assigned_to=$3) AND ($4::text IS NULL OR t.category=$4)
     ORDER BY CASE t.priority WHEN 'urgente' THEN 0 WHEN 'haute' THEN 1 WHEN 'normale' THEN 2 ELSE 3 END, t.updated_at DESC LIMIT 200`,
    [open, mine, u.id, cat],
  );
  const qs = (o: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ statut: sp.statut, vue: sp.vue, cat: sp.cat, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Support et service après-vente</h1>
        <p className="mt-1 text-ink-soft">Délais de première réponse : urgente 4 h, haute 8 h, normale 24 h, basse 48 h.</p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Filtres">
        <Link href={qs({ statut: undefined })} className={`chip px-3 py-1.5 text-sm ${open ? "bg-indigo text-white" : "hover:bg-wash"}`}>En cours</Link>
        <Link href={qs({ statut: "clos" })} className={`chip px-3 py-1.5 text-sm ${!open ? "bg-indigo text-white" : "hover:bg-wash"}`}>Résolues et fermées</Link>
        <span className="mx-1 w-px bg-line" aria-hidden="true" />
        <Link href={qs({ vue: mine ? undefined : "mes" })} className={`chip px-3 py-1.5 text-sm ${mine ? "bg-indigo text-white" : "hover:bg-wash"}`}>Attribuées à moi</Link>
        <form className="contents">
          {sp.statut && <input type="hidden" name="statut" value={sp.statut} />}
          {sp.vue && <input type="hidden" name="vue" value={sp.vue} />}
          <select name="cat" defaultValue={cat ?? ""} className="input w-auto py-1 text-sm" aria-label="Catégorie">
            <option value="">Toutes catégories</option>
            {TICKET_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm">Filtrer</button>
        </form>
      </nav>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line text-left text-ink-soft">
            <tr><th className="p-3">Demande</th><th className="p-3">Entreprise</th><th className="p-3">Priorité</th><th className="p-3">Statut</th><th className="p-3">Attribuée à</th><th className="p-3">Mise à jour</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((t) => {
              const late = t.status === "ouvert" && Date.now() - new Date(t.created_at).getTime() > SLA_HOURS[t.priority] * 3600_000;
              return (
                <tr key={t.id}>
                  <td className="p-3"><Link href={`/partenaires/support/${t.id}`} className="font-semibold hover:text-indigo">#{t.id} {t.subject}</Link><span className="block text-xs text-ink-soft">{categoryLabel(t.category)} · {t.messages} message(s)</span></td>
                  <td className="p-3"><Link href={`/partenaires/entreprises/${t.company_id}`} className="hover:text-indigo">{t.company}</Link></td>
                  <td className="p-3">{TICKET_PRIORITY[t.priority]}{late && <span className="chip ml-1 bg-clay-soft text-clay">Hors délai</span>}</td>
                  <td className="p-3"><span className={`chip ${staffStatus(t.status).tone}`}>{staffStatus(t.status).label}</span>{t.satisfaction && <span className="block text-xs text-ink-soft">Note : {t.satisfaction}/5</span>}</td>
                  <td className="p-3">{t.assignee ?? <span className="text-clay">Personne</span>}</td>
                  <td className="p-3">{since(t.updated_at)}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={6} className="p-6 text-ink-soft">Aucune demande.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Statuts : {Object.values(TICKET_STATUS).map((s) => s.staff ?? s.label).join(", ")}.</p>
    </div>
  );
}
