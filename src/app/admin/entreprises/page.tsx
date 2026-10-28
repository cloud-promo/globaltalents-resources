import Link from "next/link";
import { query } from "@/lib/db";
import { COMPANY_STATUS_LABELS } from "@/lib/ref";
import { shortDate } from "@/lib/format";
import { moderateCompany, toggleCompanyFeatured, grantCredits } from "@/app/actions/admin";

export const metadata = { title: "Entreprises" };
export const dynamic = "force-dynamic";

export default async function AdminCompanies({ searchParams }: { searchParams: Promise<{ statut?: string; q?: string }> }) {
  const sp = await searchParams;
  const status = ["pending", "verified", "rejected", "suspended"].includes(sp.statut ?? "") ? sp.statut! : null;
  const rows = await query<{ id: string; name: string; slug: string; city: string; country: string; sector: string | null; registration_number: string; status: string; featured: boolean; job_credits: number; cv_credits: number; created_at: string; jobs: number; owner: string | null; owner_phone: string | null }>(
    `SELECT c.id,c.name,c.slug,c.city,co.name country,s.name sector,c.registration_number,c.status,c.featured,c.job_credits,c.cv_credits,c.created_at,
       (SELECT count(*)::int FROM jobs j WHERE j.company_id=c.id) jobs,
       (SELECT u.email FROM company_members m JOIN users u ON u.id=m.user_id WHERE m.company_id=c.id AND m.role='admin' LIMIT 1) owner,
       (SELECT u.phone FROM company_members m JOIN users u ON u.id=m.user_id WHERE m.company_id=c.id AND m.role='admin' LIMIT 1) owner_phone
     FROM companies c JOIN countries co ON co.code=c.country_code LEFT JOIN sectors s ON s.id=c.sector_id
     WHERE ($1::text IS NULL OR c.status=$1) AND ($2::text IS NULL OR c.name ILIKE '%'||$2||'%')
     ORDER BY (c.status='pending') DESC, c.created_at DESC LIMIT 200`,
    [status, sp.q?.trim() || null],
  );
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Entreprises</h1>
      <nav className="flex flex-wrap items-center gap-2">
        <Link href="/admin/entreprises" className={`chip ${!status ? "bg-indigo text-white" : ""}`}>Toutes</Link>
        {Object.entries(COMPANY_STATUS_LABELS).map(([k, v]) => (
          <Link key={k} href={`/admin/entreprises?statut=${k}`} className={`chip ${status === k ? "bg-indigo text-white" : ""}`}>{v}</Link>
        ))}
        <form className="ml-auto"><input name="q" defaultValue={sp.q} className="input py-1 text-sm" placeholder="Nom" aria-label="Rechercher une entreprise" /></form>
      </nav>
      <ul className="space-y-3">
        {rows.map((c) => (
          <li key={c.id} className="card p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold">{c.name} <span className="chip ml-1">{COMPANY_STATUS_LABELS[c.status]}</span>{c.featured && <span className="chip ml-1 bg-indigo text-white">Mise en avant</span>}</p>
                <p className="text-ink-soft">{c.sector}, {c.city}, {c.country}. RCCM / NINEA : <strong>{c.registration_number || "non renseigné"}</strong></p>
                <p className="text-ink-soft">Contact : {c.owner} {c.owner_phone}</p>
                <p className="text-xs text-muted">Inscrite le {shortDate(c.created_at)}, {c.jobs} offre(s), {c.job_credits} crédit(s) d&apos;annonce, {c.cv_credits} crédit(s) CVthèque</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {c.status !== "verified" && <Op id={c.id} op={c.status === "suspended" ? "restore" : "verify"} label={c.status === "suspended" ? "Réactiver" : "Valider"} primary />}
                {c.status === "pending" && <Op id={c.id} op="reject" label="Refuser" />}
                {c.status === "verified" && <Op id={c.id} op="suspend" label="Suspendre" />}
                {c.status === "verified" && (
                  <form action={toggleCompanyFeatured}><input type="hidden" name="id" value={c.id} /><button className="btn btn-ghost btn-sm">{c.featured ? "Retirer la mise en avant" : "Mettre en avant"}</button></form>
                )}
                {c.status === "verified" && <Link href={`/entreprises/${c.slug}`} className="btn btn-ghost btn-sm">Page publique</Link>}
              </div>
            </div>
            <form action={grantCredits} className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <input type="hidden" name="id" value={c.id} />
              <span className="text-ink-soft">Offrir des crédits :</span>
              <input name="jobs" type="number" min={0} max={100} defaultValue={0} className="input w-20 py-1" aria-label="Crédits d'annonce" /> annonces
              <input name="cvs" type="number" min={0} max={1000} defaultValue={0} className="input w-20 py-1" aria-label="Crédits CVthèque" /> profils
              <button className="btn btn-ghost btn-sm">Ajouter</button>
            </form>
          </li>
        ))}
        {!rows.length && <li className="card p-6 text-center text-ink-soft">Aucune entreprise.</li>}
      </ul>
    </div>
  );
}

function Op({ id, op, label, primary }: { id: string; op: string; label: string; primary?: boolean }) {
  return (
    <form action={moderateCompany}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <button className={`btn btn-sm ${primary ? "btn-primary" : op === "reject" || op === "suspend" ? "btn-danger" : "btn-ghost"}`}>{label}</button>
    </form>
  );
}
