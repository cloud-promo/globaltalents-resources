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
    query<JobRow>(`SELECT ${JOB_SELECT} ${JOB_FROM} WHERE ${PUBLISHED} ORDER BY (j.featured AND (j.featured_until IS NULL OR j.featured_until > now())) DESC, j.published_at DESC LIMIT 6`),
    query<{ name: string; slug: string; brand_color: string; city: string; n: number; description: string }>(
      `SELECT c.name,c.slug,c.brand_color,c.city,c.description,
         (SELECT count(*)::int FROM jobs j WHERE j.company_id=c.id AND ${PUBLISHED}) n
       FROM companies c WHERE c.status='verified' ORDER BY (c.featured AND (c.featured_until IS NULL OR c.featured_until > now())) DESC, n DESC LIMIT 6`,
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
      <section className="hero relative overflow-hidden text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-12 sm:pt-16 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white/90">
              <span className="h-2 w-2 rounded-full bg-saffron" aria-hidden="true" /> Entreprises vérifiées une à une par notre équipe
            </p>
            <h1 className="mt-5 max-w-2xl text-[2.3rem] font-bold leading-[1.05] sm:text-[3.4rem]">
              Votre prochain poste, <span className="text-saffron">de Dakar à Conakry</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/80">
              Des offres vérifiées dans six pays d&apos;Afrique de l&apos;Ouest. Postulez en quelques minutes, découvrez vos forces avec le test Boussole et suivez chaque étape de votre candidature.
            </p>

            <form action="/offres" className="mt-8 grid gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-indigo-strong/40 sm:grid-cols-[1fr_190px_auto]" role="search">
              <label className="sr-only" htmlFor="q">Métier, compétence ou entreprise</label>
              <input id="q" name="q" className="input border-0 text-base" placeholder="Métier, compétence ou entreprise" />
              <label className="sr-only" htmlFor="pays">Pays</label>
              <select id="pays" name="pays" className="input border-0 sm:rounded-none sm:border-l" defaultValue="">
                <option value="">Tous les pays</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              <button className="btn btn-accent px-6 py-3 text-base">Rechercher</button>
            </form>

            <ul className="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Offres par pays">
              {countries.map((c) => (
                <li key={c.code}>
                  <Link href={`/offres?pays=${c.code}`} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 transition hover:border-saffron hover:bg-white/15">
                    {c.name}
                    <span className="rounded-full bg-white/15 px-1.5 text-xs text-white/80">{count(c.code)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative hidden h-[360px] lg:block" aria-hidden="true">
            <div className="floaty absolute right-4 top-2 w-[330px] rounded-2xl bg-white p-4 text-ink shadow-2xl">
              <div className="flex gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#1F6F8B] font-display font-bold text-white">TT</span>
                <div>
                  <p className="font-semibold">Ingénieure cybersécurité</p>
                  <p className="text-sm text-ink-soft">Teranga Télécom, Dakar</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5"><span className="chip">CDI</span><span className="chip bg-saffron-soft text-ink">900 000 à 1 400 000 FCFA</span></div>
              <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
                <span className="relative h-2 w-24 overflow-hidden rounded-full bg-wash"><span className="absolute inset-y-0 left-0 w-[92%] rounded-full bg-leaf" /></span>
                92 % de correspondance
              </div>
            </div>
            <div className="floaty-slow absolute left-0 top-40 w-[250px] rounded-2xl bg-white p-4 text-ink shadow-2xl">
              <p className="text-xs uppercase tracking-wider text-muted">Votre profil Boussole</p>
              <p className="mt-1 font-display text-xl font-bold text-indigo">Organisateur</p>
              {[["Organisation et rigueur", 82], ["Calme sous pression", 74], ["Esprit d'équipe", 63]].map(([l, v]) => (
                <div key={l as string} className="mt-2">
                  <p className="text-xs text-ink-soft">{l}</p>
                  <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-wash"><span className="block h-full rounded-full bg-gradient-to-r from-indigo to-saffron" style={{ width: `${v}%` }} /></span>
                </div>
              ))}
            </div>
            <div className="floaty absolute bottom-2 right-10 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-ink shadow-2xl">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-leaf-soft text-leaf">✓</span>
              <span className="text-sm"><span className="block font-semibold">Entretien RH confirmé</span><span className="text-ink-soft">Votre candidature avance</span></span>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-indigo-strong/40">
          <dl className="mx-auto grid max-w-6xl grid-cols-3 gap-4 px-4 py-5 text-center sm:text-left">
            {[
              [stats?.jobs ?? 0, "offres en ligne"],
              [stats?.companies ?? 0, "entreprises vérifiées"],
              [stats?.candidates ?? 0, "candidats inscrits"],
            ].map(([n, l]) => (
              <div key={l as string}>
                <dt className="sr-only">{l}</dt>
                <dd><span className="block font-display text-2xl font-bold sm:text-3xl">{n}</span><span className="text-sm text-white/70">{l}</span></dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="weave-strip" aria-hidden="true" />
      </section>

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
                  <Link href={`/offres?fonction=${f.id}`} className="chip border border-line bg-white px-3 py-1 hover:border-indigo hover:bg-indigo hover:text-white">{f.name}</Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="card overflow-hidden">
            <div className="bg-gradient-to-br from-saffron-soft to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ochre">Gratuit · 5 minutes</p>
              <h2 className="mt-1 text-lg font-bold">Test de personnalité Boussole</h2>
              <p className="mt-2 text-sm text-ink-soft">Découvrez vos forces au travail et voyez votre adéquation avec chaque offre.</p>
              <Link href="/test-de-personnalite" className="btn btn-primary mt-4 w-full">Passer le test</Link>
            </div>
          </section>
        </aside>
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-12" aria-labelledby="comment">
        <h2 id="comment" className="text-2xl font-bold">Trouver un emploi en 3 étapes</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            ["Créez votre profil", "Ajoutez votre CV, vos compétences et vos souhaits. Les offres qui vous correspondent remontent en premier.", "/inscription"],
            ["Passez le test Boussole", "5 minutes pour révéler vos forces au travail et montrer aux recruteurs ce qui vous distingue.", "/test-de-personnalite"],
            ["Postulez et suivez", "Une candidature en quelques clics, puis chaque étape en temps réel : lue, présélectionnée, entretien.", "/offres"],
          ].map(([t, d, href], i) => (
            <li key={t}>
              <Link href={href} className="card card-hover block h-full p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo font-display text-lg font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 text-lg font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-ink-soft">{d}</p>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="hero text-white" aria-labelledby="recruteurs">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-saffron">Vous recrutez ?</p>
            <h2 id="recruteurs" className="mt-2 text-3xl font-bold">Recevez directement les 10 candidats à interviewer</h2>
            <p className="mt-3 max-w-xl text-white/80">
              Notre présélection automatique classe vos candidatures comme le ferait un cabinet : critères de votre offre d&apos;abord, puis motivation, lieu de résidence, salaire, disponibilité et test de personnalité.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/recruteurs/inscription" className="btn btn-accent px-5 py-3 text-base">Publier une offre gratuite</Link>
              <Link href="/recruteurs" className="btn border-white/30 px-5 py-3 text-base text-white hover:bg-white/10">Découvrir l&apos;offre recruteurs</Link>
            </div>
          </div>
          <ul className="grid gap-3 text-sm">
            {[
              ["Top 10 en un clic", "« Affiche-moi les 10 candidats à recevoir » : classement expliqué critère par critère."],
              ["Un chargé de compte dédié", "Vérification, support et mises en avant gérés par notre équipe partenaires."],
              ["Paiement e-Wari", "QR code, Mobile Money ou carte, facture immédiate."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <span className="block font-semibold">{t}</span>
                <span className="text-white/75">{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-white py-12" aria-labelledby="entreprises">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 id="entreprises" className="text-2xl font-bold">Ils recrutent en ce moment</h2>
            <Link href="/entreprises" className="text-sm font-semibold text-indigo hover:underline">Toutes les entreprises</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <Link key={c.slug} href={`/entreprises/${c.slug}`} className="card card-hover flex gap-3 p-4">
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
            <Link key={a.slug} href={`/conseils/${a.slug}`} className="card card-hover block p-5">
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
