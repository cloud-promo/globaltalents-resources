import Link from "next/link";
import { query } from "@/lib/db";
import { shortDate } from "@/lib/format";
import { FEATURE_DURATIONS } from "@/lib/partners";
import { setFeatured } from "@/app/actions/partners";

export const metadata = { title: "Mises en avant" };
export const dynamic = "force-dynamic";

const ACTIVE = (t: string) => `(${t}.featured AND (${t}.featured_until IS NULL OR ${t}.featured_until>now()))`;

export default async function Featured() {
  const [jobs, companies, candidates] = await Promise.all([
    query<{ id: number; title: string; company: string; company_id: string; featured_until: string | null; apps: number; views: number }>(
      `SELECT j.id,j.title,c.name company,c.id company_id,j.featured_until,j.views,(SELECT count(*)::int FROM applications a WHERE a.job_id=j.id) apps
       FROM jobs j JOIN companies c ON c.id=j.company_id WHERE ${ACTIVE("j")} ORDER BY j.featured_until NULLS FIRST`,
    ),
    query<{ id: string; name: string; city: string; featured_until: string | null }>(
      `SELECT c.id,c.name,c.city,c.featured_until FROM companies c WHERE ${ACTIVE("c")} ORDER BY c.featured_until NULLS FIRST`,
    ),
    query<{ id: number; title: string; company: string; company_id: string; apps: number; published_at: string }>(
      `SELECT j.id,j.title,c.name company,c.id company_id,j.published_at,(SELECT count(*)::int FROM applications a WHERE a.job_id=j.id) apps
       FROM jobs j JOIN companies c ON c.id=j.company_id
       WHERE j.status='published' AND j.expires_at>now() AND c.status='verified' AND NOT ${ACTIVE("j")}
       ORDER BY apps, j.published_at LIMIT 10`,
    ),
  ]);
  const Remove = ({ target, id }: { target: string; id: string | number }) => (
    <form action={setFeatured}>
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="days" value="0" />
      <button className="btn btn-ghost btn-sm">Retirer</button>
    </form>
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mises en avant</h1>
        <p className="mt-1 text-ink-soft">
          Une offre « à la une » passe en tête des résultats et sur la page d&apos;accueil. Une entreprise mise en avant apparaît dans les entreprises qui recrutent.
          Elles s&apos;arrêtent automatiquement à la date de fin. La formule « Annonce unique » inclut 7 jours à la une : appliquez-les depuis le dossier de l&apos;entreprise dès la publication.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="text-lg font-bold">Offres à la une ({jobs.length})</h2>
        <ul className="mt-3 divide-y divide-line">
          {jobs.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span><span className="block font-medium">{j.title}</span><Link href={`/partenaires/entreprises/${j.company_id}`} className="text-ink-soft hover:text-indigo">{j.company}</Link> · {j.views} vues · {j.apps} candidatures</span>
              <span className="flex items-center gap-3"><span className="text-ink-soft">{j.featured_until ? `jusqu'au ${shortDate(j.featured_until)}` : "sans date de fin"}</span><Remove target="job" id={j.id} /></span>
            </li>
          ))}
          {!jobs.length && <li className="py-3 text-sm text-ink-soft">Aucune offre à la une.</li>}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold">Entreprises mises en avant ({companies.length})</h2>
        <ul className="mt-3 divide-y divide-line">
          {companies.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <Link href={`/partenaires/entreprises/${c.id}`} className="font-medium hover:text-indigo">{c.name} <span className="font-normal text-ink-soft">· {c.city}</span></Link>
              <span className="flex items-center gap-3"><span className="text-ink-soft">{c.featured_until ? `jusqu'au ${shortDate(c.featured_until)}` : "sans date de fin"}</span><Remove target="company" id={c.id} /></span>
            </li>
          ))}
          {!companies.length && <li className="py-3 text-sm text-ink-soft">Aucune entreprise mise en avant.</li>}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold">Offres qui reçoivent peu de candidatures</h2>
        <p className="text-sm text-ink-soft">Bonnes candidates pour une mise à la une, offerte ou vendue.</p>
        <ul className="mt-3 divide-y divide-line">
          {candidates.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span><span className="block font-medium">{j.title}</span><Link href={`/partenaires/entreprises/${j.company_id}`} className="text-ink-soft hover:text-indigo">{j.company}</Link> · {j.apps} candidature(s) · publiée le {shortDate(j.published_at)}</span>
              <form action={setFeatured} className="flex items-center gap-1">
                <input type="hidden" name="target" value="job" />
                <input type="hidden" name="id" value={j.id} />
                <select name="days" defaultValue="7" className="input w-auto py-1 text-sm" aria-label={`Durée pour ${j.title}`}>
                  {FEATURE_DURATIONS.map((d) => <option key={d} value={d}>{d} jours</option>)}
                </select>
                <button className="btn btn-primary btn-sm">À la une</button>
              </form>
            </li>
          ))}
          {!candidates.length && <li className="py-3 text-sm text-ink-soft">Rien à signaler.</li>}
        </ul>
      </section>
    </div>
  );
}
