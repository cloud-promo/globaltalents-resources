import Link from "next/link";
import { requireRecruiter } from "@/lib/auth";
import { query, one } from "@/lib/db";
import { since } from "@/lib/format";
import { stageOf } from "@/lib/ref";

export const metadata = { title: "Tableau de bord recruteur" };

export default async function RecruiterHome({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const { bienvenue } = await searchParams;
  const { user, company } = await requireRecruiter();
  const cid = company.company_id;
  const [stats, recent, jobs] = await Promise.all([
    one<{ active: number; pending: number; apps: number; new_apps: number; interviews: number; hired: number }>(
      `SELECT
         (SELECT count(*)::int FROM jobs WHERE company_id=$1 AND status='published' AND expires_at>now()) active,
         (SELECT count(*)::int FROM jobs WHERE company_id=$1 AND status='pending') pending,
         (SELECT count(*)::int FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1) apps,
         (SELECT count(*)::int FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND a.stage='nouvelle') new_apps,
         (SELECT count(*)::int FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND a.stage IN ('entretien_rh','entretien_manager')) interviews,
         (SELECT count(*)::int FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND a.stage='embauche') hired`,
      [cid],
    ),
    query<{ id: string; first_name: string; last_name: string; anonymous: boolean; title: string; score: number; stage: string; created_at: string; failed_screening: boolean }>(
      `SELECT a.id,u.first_name,u.last_name,a.anonymous,j.title,a.score,a.stage,a.created_at,a.failed_screening
       FROM applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.candidate_id
       WHERE j.company_id=$1 ORDER BY a.created_at DESC LIMIT 8`,
      [cid],
    ),
    query<{ id: number; title: string; n: number; fresh: number; expires_at: string }>(
      `SELECT j.id,j.title,j.expires_at,
         (SELECT count(*)::int FROM applications a WHERE a.job_id=j.id) n,
         (SELECT count(*)::int FROM applications a WHERE a.job_id=j.id AND a.stage='nouvelle') fresh
       FROM jobs j WHERE j.company_id=$1 AND j.status='published' AND j.expires_at>now() ORDER BY j.published_at DESC LIMIT 6`,
      [cid],
    ),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bonjour {user.first_name}</h1>
          <p className="mt-1 text-ink-soft">
            {stats?.new_apps
              ? `${stats.new_apps} candidature${stats.new_apps > 1 ? "s" : ""} à trier.`
              : "Aucune nouvelle candidature à trier."}
          </p>
        </div>
        <Link href="/recruteur/offres/nouvelle" className="btn btn-primary">Publier une offre</Link>
      </div>
      {bienvenue && (
        <p className="rounded-lg border border-[#bfe0cf] bg-leaf-soft p-3 text-sm text-leaf">
          Compte entreprise créé. Votre première offre est offerte : publiez-la dès maintenant, elle sera mise en ligne après la vérification de l&apos;entreprise.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Offres en ligne", stats?.active, `${stats?.pending ?? 0} en modération`],
          ["Candidatures reçues", stats?.apps, `${stats?.new_apps ?? 0} nouvelles`],
          ["En entretien", stats?.interviews, "RH et manager"],
          ["Embauches", stats?.hired, "depuis l'ouverture du compte"],
        ].map(([k, v, s]) => (
          <div key={String(k)} className="card p-4">
            <dt className="text-sm text-ink-soft">{k}</dt>
            <dd className="mt-1 font-display text-2xl font-bold">{v ?? 0}</dd>
            <dd className="text-xs text-muted">{s}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Dernières candidatures</h2>
          <ul className="divide-y divide-line">
            {recent.map((a) => (
              <li key={a.id}>
                <Link href={`/recruteur/candidatures/${a.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-indigo">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{a.anonymous ? "Candidat anonyme" : `${a.first_name} ${a.last_name}`}</span>
                    <span className="block truncate text-sm text-ink-soft">{a.title}, {since(a.created_at)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {a.failed_screening && <span className="chip bg-clay-soft text-clay">Présélection non validée</span>}
                    <span className="chip">{a.score} %</span>
                    <span className="chip bg-wash">{stageOf(a.stage).label}</span>
                  </span>
                </Link>
              </li>
            ))}
            {!recent.length && <li className="py-3 text-sm text-ink-soft">Les candidatures apparaîtront ici.</li>}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Offres en ligne</h2>
          <ul className="divide-y divide-line">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/recruteur/offres/${j.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-indigo">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{j.title}</span>
                    <span className="text-sm text-ink-soft">Expire {new Date(j.expires_at) > new Date() ? "le " + new Date(j.expires_at).toLocaleDateString("fr-FR") : ""}</span>
                  </span>
                  <span className="shrink-0 text-sm"><strong>{j.n}</strong> candidature{j.n > 1 ? "s" : ""}{j.fresh > 0 && <span className="chip ml-2 bg-saffron-soft text-ochre">{j.fresh} nouvelle{j.fresh > 1 ? "s" : ""}</span>}</span>
                </Link>
              </li>
            ))}
            {!jobs.length && <li className="py-3 text-sm text-ink-soft">Aucune offre en ligne.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
