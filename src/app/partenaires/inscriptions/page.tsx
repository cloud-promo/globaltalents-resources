import Link from "next/link";
import { query } from "@/lib/db";
import { since } from "@/lib/format";
import { COMPANY_STATUS_LABELS } from "@/lib/ref";

export const metadata = { title: "Inscriptions à vérifier" };
export const dynamic = "force-dynamic";

export default async function Registrations({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const sp = await searchParams;
  const status = sp.statut === "rejected" ? "rejected" : "pending";
  const rows = await query<{ id: string; name: string; city: string; country: string; sector: string | null; registration_number: string; website: string; created_at: string; owner: string | null; owner_email: string | null; owner_phone: string | null; jobs: number; done: number; reject_reason: string }>(
    `SELECT c.id,c.name,c.city,co.name country,s.name sector,c.registration_number,c.website,c.created_at,c.reject_reason,
       u.first_name||' '||u.last_name owner,u.email owner_email,u.phone owner_phone,
       (SELECT count(*)::int FROM jobs j WHERE j.company_id=c.id) jobs,
       (SELECT count(*)::int FROM jsonb_each(coalesce(c.verification->'checks','{}'::jsonb)) e WHERE e.value='true'::jsonb) done
     FROM companies c JOIN countries co ON co.code=c.country_code LEFT JOIN sectors s ON s.id=c.sector_id
     LEFT JOIN LATERAL (SELECT us.* FROM company_members m JOIN users us ON us.id=m.user_id WHERE m.company_id=c.id ORDER BY (m.role='admin') DESC LIMIT 1) u ON true
     WHERE c.status=$1 ORDER BY c.created_at`,
    [status],
  );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Inscriptions des entreprises</h1>
        <p className="mt-1 text-ink-soft">Chaque entreprise est vérifiée avant que ses offres ne soient visibles. Objectif : réponse sous 24 h ouvrées.</p>
      </div>
      <nav className="flex gap-2" aria-label="Statut">
        {[["pending", "À vérifier"], ["rejected", "Refusées"]].map(([code, label]) => (
          <Link key={code} href={`/partenaires/inscriptions?statut=${code}`} aria-current={status === code ? "page" : undefined}
            className={`chip px-3 py-1.5 text-sm ${status === code ? "bg-indigo text-white" : "hover:bg-wash"}`}>{label}</Link>
        ))}
      </nav>
      <ul className="space-y-3">
        {rows.map((c) => {
          const hours = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 3600_000);
          return (
            <li key={c.id} className="card flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.name} <span className="chip ml-1">{COMPANY_STATUS_LABELS[status]}</span>
                  {status === "pending" && hours >= 24 && <span className="chip ml-1 bg-clay-soft text-clay">En attente depuis {Math.floor(hours / 24) || 1} j</span>}</p>
                <p className="mt-1 text-sm text-ink-soft">{c.sector ?? "Secteur non renseigné"} · {c.city}, {c.country} · RCCM : {c.registration_number || "non renseigné"}{c.website && ` · ${c.website}`}</p>
                <p className="text-sm text-ink-soft">Contact : {c.owner} · {c.owner_email}{c.owner_phone && ` · ${c.owner_phone}`} · inscrite {since(c.created_at)} · {c.jobs} offre(s) préparée(s)</p>
                {status === "rejected" && c.reject_reason && <p className="mt-1 text-sm text-clay">Motif : {c.reject_reason}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">{c.done} / 6 contrôles</p>
                <Link href={`/partenaires/entreprises/${c.id}`} className="btn btn-primary btn-sm mt-1">Ouvrir le dossier</Link>
              </div>
            </li>
          );
        })}
        {!rows.length && <li className="card p-6 text-ink-soft">Aucune entreprise dans cette liste.</li>}
      </ul>
    </div>
  );
}
