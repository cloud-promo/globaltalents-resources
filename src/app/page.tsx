import Link from "next/link";
import { query, one } from "@/lib/db";
import { JOB_FROM, JOB_SELECT, PUBLISHED, type JobRow } from "@/lib/jobs";
import { JobCard, CompanyBadge } from "@/components/JobCard";
import { getRefs } from "@/lib/refdata";
import { date } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ countries, functions }, featured, companies, perCountry, stats, articles] = await Promise.all([
    getRefs(),
    query<JobRow>(`SELECT ${JOB_SELECT} ${JOB_FROM} WHERE ${PUBLISHED} ORDER BY j.featured DESC, j.published_at DESC LIMIT 6`),
    query<{ name: string; slug: string; brand_color: string; city: string; n: number; description: string }>(
      `SELECT c.name,c.slug,c.brand_color,c.city,c.description,
         (SELECT count(*)::int FROM jobs j WHERE j.company_id=c.id AND ${PUBLISHED}) n
       FROM companies c WHERE c.status='verified' ORDER BY c.featured DESC, n DESC LIMIT 6`,
    ),
    query<{ country_code: string; n: number }>(
      `SELECT j.country_code, count(*)::int n FROM jobs j JOIN companies c ON c.id=j.company_id WHERE ${PUBLISHED} GROUP BY 1`,
    ),
    one<{ jobs: number; companies: number; candidates: number }>(
      `SELECT (SELECT count(*)::int FROM jobs j JOIN companies c ON c.id=j.company_id WHERE ${PUBLISHED}) jobs,
              (SELECT count(*)::int FROM companies WHERE status='verified') companies,
              (SELECT count(*)::int FROM users WHERE role='candidate') candidates`,
    ),
    query<{ slug: string; title: string; excerpt: string; category: string; published_at: string }>(
      `SELECT slug,title,excerpt,category,published_at FROM articles WHERE published ORDER BY published_at DESC LIMIT 3`,
    ),
  ]);
  const count = (code: string) => perCountry.find((r) => r.country_code === code)?.n ?? 0;

  return (
    <>
      <section className="weave text-white">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:pt-16">
          <h1 className="max-w-3xl text-[2.1rem] font-bold sm:text-5xl">
            Votre prochain poste, de Dakar à Conakry
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Des offres vérifiées dans six pays d&apos;Afrique de l&apos;Ouest. Postulez en quelques minutes et suivez chaque étape de votre candidature.
          </p>

          <form action="/offres" className="mt-8 grid gap-2 rounded-2xl bg-white p-2 shadow-xl sm:grid-cols-[1fr_200px_auto]" role="search">
            <label className="sr-only" htmlFor="q">Métier, compétence ou entreprise</label>
            <input id="q" name="q" className="input border-0 text-base" placeholder="Métier, compétence ou entreprise" />
            <label className="sr-only" htmlFor="pays">Pays</label>
            <select id="pays" name="pays" className="input border-0 sm:border-l sm:rounded-none" defaultValue="">
              <option value="">Tous les pays</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            <button className="btn btn-primary px-6 py-3 text-base">Rechercher</button>
          </form>

          <ul className="mt-6 flex flex-wrap gap-2 text-sm">
            {countries.map((c) => (
              <li key={c.code}>
                <Link href={`/offres?pays=${c.code}`} className="inline-flex items-center gap-2 rounded-full border border-white/25 px-3 py-1.5 hover:border-saffron hover:bg-white/10">
                  {c.name}
                  <span className="text-white/60">{count(c.code)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="border-b border-line bg-white">
        <p className="mx-auto max-w-6xl px-4 py-3 text-sm text-ink-soft">
          En ce moment : <strong className="text-ink">{stats?.jobs ?? 0} offre{(stats?.jobs ?? 0) > 1 ? "s" : ""}</strong> en ligne,{" "}
          <strong className="text-ink">{stats?.companies ?? 0} entreprises</strong> vérifiées et{" "}
          <strong className="text-ink">{stats?.candidates ?? 0} candidat{(stats?.candidates ?? 0) > 1 ? "s" : ""}</strong> inscrit{(stats?.candidates ?? 0) > 1 ? "s" : ""}.
        </p>
      </div>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="une">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 id="une" className="text-2xl font-bold">Offres récentes</h2>
            <Link href="/offres" className="text-sm font-semibold text-indigo hover:underline">Voir toutes les offres</Link>
          </div>
          <div className="grid gap-3">
            {featured.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
            {!featured.length && <p className="card p-6 text-ink-soft">Aucune offre publiée pour le moment.</p>}
          </div>
        </section>

        <aside className="space-y-10">
          <section aria-labelledby="metiers">
            <h2 id="metiers" className="mb-3 text-lg font-bold">Parcourir par métier</h2>
            <ul className="flex flex-wrap gap-1.5">
              {functions.slice(0, 16).map((f) => (
                <li key={f.id}>
                  <Link href={`/offres?fonction=${f.id}`} className="chip hover:bg-indigo hover:text-white">{f.name}</Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="card overflow-hidden">
            <div className="weave h-1.5" aria-hidden="true" />
            <div className="p-5">
              <h2 className="text-lg font-bold">Vous recrutez ?</h2>
              <p className="mt-2 text-sm text-ink-soft">
                Publiez une première offre gratuitement, triez les candidatures par score de correspondance et payez par Wave ou Orange Money.
              </p>
              <Link href="/recruteurs" className="btn btn-primary mt-4 w-full">Publier une offre</Link>
            </div>
          </section>
        </aside>
      </div>

      <section className="bg-white py-12" aria-labelledby="entreprises">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 id="entreprises" className="text-2xl font-bold">Ils recrutent en ce moment</h2>
            <Link href="/entreprises" className="text-sm font-semibold text-indigo hover:underline">Toutes les entreprises</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <Link key={c.slug} href={`/entreprises/${c.slug}`} className="card flex gap-3 p-4 hover:border-indigo">
                <CompanyBadge name={c.name} color={c.brand_color} />
                <span className="min-w-0">
                  <span className="block font-semibold">{c.name}</span>
                  <span className="block text-sm text-ink-soft">{c.city}</span>
                  <span className="mt-1 block text-sm font-medium text-indigo">
                    {c.n} offre{c.n > 1 ? "s" : ""} ouverte{c.n > 1 ? "s" : ""}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="conseils">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="conseils" className="text-2xl font-bold">Conseils carrière</h2>
          <Link href="/conseils" className="text-sm font-semibold text-indigo hover:underline">Tous les articles</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {articles.map((a) => (
            <Link key={a.slug} href={`/conseils/${a.slug}`} className="card block p-5 hover:border-indigo">
              <span className="text-xs font-semibold text-ochre">{a.category}</span>
              <h3 className="mt-1 text-lg font-semibold">{a.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{a.excerpt}</p>
              <p className="mt-3 text-xs text-muted">{date(a.published_at)}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
