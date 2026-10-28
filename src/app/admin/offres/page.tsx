import Link from "next/link";
import { query } from "@/lib/db";
import { JOB_STATUS_LABELS, CONTRACT_TYPES } from "@/lib/ref";
import { shortDate, since, jobPath, salaryRange } from "@/lib/format";
import { moderateJob, resolveReport } from "@/app/actions/admin";

export const metadata = { title: "Modération des offres" };
export const dynamic = "force-dynamic";

const STATUSES = ["pending", "published", "rejected", "draft", "archived"];

export default async function AdminJobs({ searchParams }: { searchParams: Promise<{ statut?: string; q?: string }> }) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.statut ?? "") ? sp.statut! : "pending";
  const [jobs, reports] = await Promise.all([
    query<{ id: number; title: string; city: string; country: string; currency: string; contract_type: string; company: string; company_status: string; description: string; profile: string; salary_min: number | null; salary_max: number | null; created_at: string; featured: boolean; reports: number }>(
      `SELECT j.id,j.title,j.city,co.name country,co.currency,j.contract_type,c.name company,c.status company_status,j.description,j.profile,
         j.salary_min,j.salary_max,j.created_at,j.featured,(SELECT count(*)::int FROM job_reports r WHERE r.job_id=j.id AND NOT r.resolved) reports
       FROM jobs j JOIN companies c ON c.id=j.company_id JOIN countries co ON co.code=j.country_code
       WHERE j.status=$1 AND ($2::text IS NULL OR j.title ILIKE '%'||$2||'%' OR c.name ILIKE '%'||$2||'%')
       ORDER BY j.created_at ${status === "pending" ? "ASC" : "DESC"} LIMIT 100`,
      [status, sp.q?.trim() || null],
    ),
    query<{ id: number; job_id: number; title: string; city: string; reason: string; created_at: string }>(
      `SELECT r.id,r.job_id,j.title,j.city,r.reason,r.created_at FROM job_reports r JOIN jobs j ON j.id=r.job_id WHERE NOT r.resolved ORDER BY r.created_at`,
    ),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Modération des offres</h1>
      <nav className="flex flex-wrap gap-2" aria-label="Statut">
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/offres?statut=${s}`} className={`chip ${s === status ? "bg-indigo text-white" : ""}`}>{JOB_STATUS_LABELS[s]}</Link>
        ))}
        <form className="ml-auto flex gap-2">
          <input type="hidden" name="statut" value={status} />
          <input name="q" defaultValue={sp.q} className="input py-1 text-sm" placeholder="Titre ou entreprise" aria-label="Rechercher" />
        </form>
      </nav>

      {status === "pending" && (
        <p className="text-sm text-ink-soft">
          Vérifiez : offre réelle et précise, pas de frais demandés au candidat, pas de critère discriminatoire, coordonnées absentes du texte, salaire cohérent.
        </p>
      )}

      <ul className="space-y-3">
        {jobs.map((j) => {
          const suspicious = /(frais|payer|paiement|whatsapp|\+?\d{8,}|@)/i.test(j.description + " " + j.profile);
          return (
            <li key={j.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{j.title}</p>
                  <p className="text-sm text-ink-soft">
                    {j.company} ({j.company_status === "verified" ? "vérifiée" : "entreprise non vérifiée"}), {j.city}, {j.country}, {CONTRACT_TYPES.includes(j.contract_type as never) ? j.contract_type : ""}
                  </p>
                  <p className="text-xs text-muted">Soumise {since(j.created_at)}{j.salary_min ? `, ${salaryRange(j.salary_min, j.salary_max, j.currency)}` : ""}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {suspicious && <span className="chip bg-clay-soft text-clay">À vérifier : coordonnées ou mention de paiement dans le texte</span>}
                    {j.reports > 0 && <span className="chip bg-clay-soft text-clay">{j.reports} signalement(s)</span>}
                    {j.featured && <span className="chip bg-indigo text-white">À la une</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {status === "published" && <Link href={jobPath(j.id, j.title, j.city)} className="btn btn-ghost btn-sm">Voir</Link>}
                  {status !== "published" && <Op id={j.id} op="publish" label="Publier" primary />}
                  {status === "published" && <Op id={j.id} op="feature" label={j.featured ? "Retirer de la une" : "Mettre à la une"} />}
                  {status === "published" && <Op id={j.id} op="unpublish" label="Dépublier" />}
                </div>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-indigo">Lire l&apos;offre</summary>
                <p className="mt-2 whitespace-pre-line text-sm">{j.description}</p>
                {j.profile && <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{j.profile}</p>}
              </details>
              {status === "pending" && (
                <form action={moderateJob} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={j.id} />
                  <input type="hidden" name="op" value="reject" />
                  <input name="reason" className="input flex-1 py-1.5 text-sm" placeholder="Motif du refus, envoyé au recruteur" aria-label="Motif du refus" maxLength={300} />
                  <button className="btn btn-danger btn-sm">Refuser</button>
                </form>
              )}
            </li>
          );
        })}
        {!jobs.length && <li className="card p-6 text-center text-ink-soft">Aucune offre dans ce statut.</li>}
      </ul>

      <section id="signalements" className="card p-5">
        <h2 className="text-lg font-bold">Signalements des candidats</h2>
        <ul className="mt-3 divide-y divide-line">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
              <span>
                <Link href={jobPath(r.job_id, r.title, r.city)} className="font-semibold hover:text-indigo">{r.title}</Link>
                <span className="block text-ink-soft">{r.reason}</span>
                <span className="text-xs text-muted">{shortDate(r.created_at)}</span>
              </span>
              <span className="flex gap-2">
                <Op id={r.job_id} op="unpublish" label="Dépublier l'offre" />
                <form action={resolveReport}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="btn btn-ghost btn-sm">Marquer comme traité</button>
                </form>
              </span>
            </li>
          ))}
          {!reports.length && <li className="py-3 text-sm text-ink-soft">Aucun signalement en attente.</li>}
        </ul>
      </section>
    </div>
  );
}

function Op({ id, op, label, primary }: { id: number; op: string; label: string; primary?: boolean }) {
  return (
    <form action={moderateJob}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <button className={`btn btn-sm ${primary ? "btn-primary" : "btn-ghost"}`}>{label}</button>
    </form>
  );
}
