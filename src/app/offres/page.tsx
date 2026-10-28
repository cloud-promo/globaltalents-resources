import Link from "next/link";
import type { Metadata } from "next";
import { searchJobs, getMatchProfile, type JobFilters } from "@/lib/jobs";
import { getRefs } from "@/lib/refdata";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { JobCard } from "@/components/JobCard";
import { SaveButton } from "@/components/SaveButton";
import { matchScore } from "@/lib/match";
import { CONTRACT_TYPES, EXPERIENCE_LEVELS, STUDY_LEVELS, REMOTE_OPTIONS, LANGUAGES } from "@/lib/ref";
import { saveSearchAsAlert } from "@/app/actions/candidate";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const { countries } = await getRefs();
  const c = countries.find((x) => x.code === sp.pays);
  return {
    title: c ? `Offres d'emploi : ${c.name}` : "Offres d'emploi en Afrique de l'Ouest",
    description: "Recherchez parmi les offres d'emploi vérifiées au Sénégal, en Côte d'Ivoire, au Mali, au Burkina Faso, au Niger et en Guinée.",
  };
}

export default async function OffresPage({ searchParams }: { searchParams: SP }) {
  const sp = (await searchParams) as JobFilters;
  const user = await getUser();
  const isCandidate = user?.role === "candidate";
  const [{ countries, cities, functions, sectors }, result] = await Promise.all([getRefs(), searchJobs(sp, isCandidate ? user.id : null)]);

  let saved = new Set<number>();
  let profile: Awaited<ReturnType<typeof getMatchProfile>> = null;
  if (isCandidate) {
    saved = new Set((await query<{ job_id: number }>(`SELECT job_id FROM saved_jobs WHERE user_id=$1`, [user.id])).map((r) => r.job_id));
    profile = await getMatchProfile(user.id);
  }

  const qs = (over: Record<string, string>) => {
    const u = new URLSearchParams(Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][]);
    return `/offres?${u.toString()}`;
  };
  const activeFilters = Object.entries(sp).filter(([k, v]) => v && k !== "page").length;
  const countryCities = cities.filter((c) => !sp.pays || c.country_code === sp.pays);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">Offres d&apos;emploi</h1>
      <p className="mt-1 text-ink-soft">
        {result.total} offre{result.total > 1 ? "s" : ""} correspond{result.total > 1 ? "ent" : ""} à votre recherche
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4 self-start lg:sticky lg:top-20">
        <form action="/offres" aria-label="Filtres de recherche">
          <details className="card p-4 lg:open:block" open>
            <summary className="cursor-pointer list-none font-semibold lg:pointer-events-none">
              Filtres {activeFilters > 0 && <span className="chip ml-1">{activeFilters}</span>}
            </summary>
            <div className="mt-4 space-y-3">
              <Field label="Mots-clés">
                <input name="q" defaultValue={sp.q} className="input" placeholder="ex. comptable, SOC, Sage" />
              </Field>
              <Select name="pays" label="Pays" value={sp.pays} options={countries.map((c) => [c.code, c.name])} />
              <Select name="ville" label="Ville" value={sp.ville} options={countryCities.map((c) => [c.name, c.name])} />
              <Select name="fonction" label="Fonction" value={sp.fonction} options={functions.map((f) => [String(f.id), f.name])} />
              <Select name="secteur" label="Secteur" value={sp.secteur} options={sectors.map((s) => [String(s.id), s.name])} />
              <Select name="contrat" label="Type de contrat" value={sp.contrat} options={CONTRACT_TYPES.map((c) => [c, c])} />
              <Select name="experience" label="Niveau d'expérience" value={sp.experience} options={EXPERIENCE_LEVELS.map((e) => [e.code, e.label])} />
              <Select name="etudes" label="Niveau d'études" value={sp.etudes} options={STUDY_LEVELS.map((e) => [e.code, e.label])} />
              <Select name="teletravail" label="Télétravail" value={sp.teletravail} options={REMOTE_OPTIONS.map((e) => [e.code, e.label])} />
              <Select name="langue" label="Langue demandée" value={sp.langue} options={LANGUAGES.map((l) => [l, l])} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="management" value="1" defaultChecked={sp.management === "1"} /> Poste avec management
              </label>
              <div className="flex gap-2 pt-1">
                <button className="btn btn-primary flex-1">Appliquer</button>
                <Link href="/offres" className="btn btn-ghost">Effacer</Link>
              </div>
            </div>
          </details>
        </form>
          {isCandidate && activeFilters > 0 && (
            <div className="card p-4 text-sm">
              <p className="text-ink-soft">Recevez chaque soir les nouvelles offres de cette recherche.</p>
              <SaveSearch query={sp} />
            </div>
          )}
        </div>

        <section aria-label="Résultats">
          <div className="grid gap-3">
            {result.jobs.map((j) => (
              <JobCard
                key={j.id}
                job={j}
                score={profile ? matchScore(profile, j).score : undefined}
                saved={isCandidate ? <SaveButton jobId={j.id} saved={saved.has(j.id)} /> : undefined}
              />
            ))}
          </div>
          {!result.jobs.length && (
            <div className="card p-8 text-center">
              <h2 className="text-lg font-semibold">Aucune offre ne correspond à ces critères</h2>
              <p className="mt-2 text-ink-soft">Retirez un filtre ou élargissez la recherche à tous les pays.</p>
              <Link href="/offres" className="btn btn-ghost mt-4">Voir toutes les offres</Link>
            </div>
          )}
          {result.pages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
              {result.page > 1 && <Link className="btn btn-ghost btn-sm" href={qs({ page: String(result.page - 1) })}>Page précédente</Link>}
              <span className="text-sm text-ink-soft">Page {result.page} sur {result.pages}</span>
              {result.page < result.pages && <Link className="btn btn-ghost btn-sm" href={qs({ page: String(result.page + 1) })}>Page suivante</Link>}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}

function SaveSearch({ query: q }: { query: JobFilters }) {
  return (
    <form action={saveSearchAsAlert} className="mt-3 flex gap-2">
      <input type="hidden" name="query" value={JSON.stringify(Object.fromEntries(Object.entries(q).filter(([k, v]) => v && k !== "page")))} />
      <input name="name" className="input py-1.5 text-sm" placeholder="Nom de l'alerte" required maxLength={80} />
      <button className="btn btn-ghost btn-sm">Créer l&apos;alerte</button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: (string | number)[][] }) {
  return (
    <Field label={label}>
      <select name={name} defaultValue={value ?? ""} className="input">
        <option value="">Tous</option>
        {options.map(([v, l]) => (
          <option key={String(v)} value={String(v)}>{l}</option>
        ))}
      </select>
    </Field>
  );
}
