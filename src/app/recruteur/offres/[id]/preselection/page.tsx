import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "@/lib/auth";
import { loadScreening } from "@/lib/screening-server";
import { screen, parseQuery, applyQuery, describeQuery, SECONDARY, OFFER_SHARE, type Ranked, type ScreenQuery } from "@/lib/screening";
import { aiEnabled, aiParseQuery } from "@/lib/ai";
import { stageOf } from "@/lib/ref";
import { moveApplication, bulkMove, saveScreeningSettings, analyzeMotivations } from "@/app/actions/recruiter";
import { Submit } from "@/components/Form";

export const metadata = { title: "Présélection automatique" };
export const dynamic = "force-dynamic";

const SUGGESTIONS = [
  "Affiche-moi les 10 candidats que je devrais interviewer",
  "Top 5 disponibles immédiatement",
  "Top 10 dans le budget de l'offre",
  "Les 5 meilleurs qui habitent la ville du poste",
  "Top 10 avec test de personnalité",
];

function tone(v: number) {
  return v >= 75 ? "bg-leaf" : v >= 50 ? "bg-saffron" : "bg-clay";
}

export default async function ScreeningPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { company } = await requireRecruiter();
  const data = await loadScreening(Number(id) || 0, company.company_id);
  if (!data) notFound();
  const { job, settings, candidates, cities } = data;
  const text = (sp.q ?? SUGGESTIONS[0]).slice(0, 300);
  const ctx = { cities, skills: job.skills };

  // Suggestions qui dépendent de l'offre
  let ask = text;
  if (text === SUGGESTIONS[2] && job.salary_max) ask = `top 10 moins de ${job.salary_max}`;
  if (text === SUGGESTIONS[3]) ask = `top 5 à ${job.city}`;
  const ai = aiEnabled();
  const aiQuery = ai && text !== SUGGESTIONS[0] ? await aiParseQuery(ask, ctx) : null;
  const q: ScreenQuery = aiQuery ?? parseQuery(ask, ctx);

  const ranked = screen(job, candidates, settings);
  const { top, rest, filtered } = applyQuery(ranked, q);
  const excluded = ranked.filter((r) => r.excluded);
  const pendingAi = candidates.filter((c) => !c.ai_motivation && c.stage !== "refuse").length;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/recruteur/offres/${job.id}`} className="text-sm text-ink-soft hover:text-indigo">Candidatures de l&apos;offre</Link>
        <h1 className="text-2xl font-bold">Présélection automatique</h1>
        <p className="mt-1 text-ink-soft">{job.title}, {job.city} · {candidates.length} candidature{candidates.length > 1 ? "s" : ""} analysée{candidates.length > 1 ? "s" : ""}</p>
      </div>

      <section className="card overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-strong via-indigo to-[#3b4bb0] p-5 text-white sm:p-6">
          <form className="flex flex-col gap-3 sm:flex-row" role="search">
            <label htmlFor="ask" className="sr-only">Votre demande</label>
            <input id="ask" name="q" defaultValue={text} maxLength={300} className="input flex-1 border-white/20 bg-white text-ink" placeholder="ex. Top 10 à Dakar disponibles sous un mois, moins de 900 000 FCFA" />
            <button className="btn bg-saffron px-5 text-ink hover:bg-[#f0b544]">Classer les candidats</button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {SUGGESTIONS.map((s) => (
              <Link key={s} href={`?q=${encodeURIComponent(s)}`} className={`chip border border-white/25 ${s === text ? "bg-white text-indigo" : "bg-white/10 text-white hover:bg-white/20"}`}>{s}</Link>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
          <span className="font-semibold">Compris :</span>
          {describeQuery(q, job.currency).map((p) => <span key={p} className="chip bg-wash text-indigo">{p}</span>)}
          <span className="text-muted">{aiQuery ? "Demande interprétée par l'IA" : "Demande interprétée automatiquement"}</span>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-bold">{top.length ? `Les ${top.length} candidat${top.length > 1 ? "s" : ""} à recevoir en priorité` : "Aucun candidat ne correspond à cette demande"}</h2>
            {top.length > 0 && (
              <form id="bulk" action={bulkMove} className="flex items-center gap-2">
                <select name="stage" defaultValue="entretien_rh" className="input w-auto py-1.5 text-sm" aria-label="Étape">
                  <option value="preselection">Passer en présélection</option>
                  <option value="entretien_rh">Inviter en entretien RH</option>
                </select>
                <Submit className="btn btn-primary btn-sm" pendingLabel="Mise à jour…">Appliquer aux candidats cochés</Submit>
              </form>
            )}
          </div>

          <ol className="space-y-4">
            {top.map((r, i) => <Candidate key={r.c.application_id} r={r} rank={i + 1} />)}
          </ol>

          {rest.length > 0 && (
            <details className="card p-4">
              <summary className="cursor-pointer font-semibold">Suite du classement ({rest.length})</summary>
              <ol className="mt-3 divide-y divide-line text-sm">
                {rest.map((r, i) => (
                  <li key={r.c.application_id} className="flex items-center justify-between gap-3 py-2">
                    <span><span className="text-muted">{top.length + i + 1}.</span> <Link href={`/recruteur/candidatures/${r.c.application_id}`} className="font-medium hover:text-indigo">{r.c.name}</Link> <span className="text-ink-soft">· {r.c.city || "ville non renseignée"}</span></span>
                    <span className="font-semibold">{r.score}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
          {filtered.length > 0 && (
            <details className="card p-4">
              <summary className="cursor-pointer font-semibold">Écartés par votre demande ({filtered.length})</summary>
              <ul className="mt-3 divide-y divide-line text-sm">
                {filtered.map(({ r, reason }) => (
                  <li key={r.c.application_id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/recruteur/candidatures/${r.c.application_id}`} className="font-medium hover:text-indigo">{r.c.name}</Link>
                    <span className="text-ink-soft">{reason} · {r.score}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {excluded.length > 0 && (
            <details className="card p-4">
              <summary className="cursor-pointer font-semibold">Exclus par vos critères obligatoires ({excluded.length})</summary>
              <ul className="mt-3 divide-y divide-line text-sm">
                {excluded.map((r) => (
                  <li key={r.c.application_id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/recruteur/candidatures/${r.c.application_id}`} className="font-medium hover:text-indigo">{r.c.name}</Link>
                    <span className="text-ink-soft">{r.excluded}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-xs text-muted">
            Outil d&apos;aide à la décision : le classement s&apos;appuie uniquement sur des critères professionnels (offre, motivation, localisation, salaire, disponibilité, test partagé).
            L&apos;âge, le sexe, l&apos;origine, la religion, la situation familiale et la photo ne sont jamais utilisés. Vous restez seul décideur de chaque étape.
          </p>
        </div>

        <aside className="space-y-4">
          <section className="card p-4 text-sm">
            <h2 className="font-bold">Comment le classement est calculé</h2>
            <p className="mt-2"><span className="font-semibold">{Math.round(OFFER_SHARE * 100)} % : critères de votre offre.</span> Compétences, expérience, diplôme, métier, langues.</p>
            <p className="mt-1"><span className="font-semibold">{Math.round((1 - OFFER_SHARE) * 100)} % : critères complémentaires.</span> Motivation, zone d&apos;habitat, prétentions, disponibilité, test de personnalité.</p>
            <p className="mt-2 text-ink-soft">Une information non renseignée ne pénalise pas le candidat : elle n&apos;est pas comptée.</p>
          </section>

          {ai ? (
            <form action={analyzeMotivations} className="card p-4 text-sm">
              <input type="hidden" name="job_id" value={job.id} />
              <h2 className="font-bold">Analyse IA des lettres</h2>
              <p className="mt-1 text-ink-soft">{pendingAi ? `${pendingAi} lettre${pendingAi > 1 ? "s" : ""} pas encore analysée${pendingAi > 1 ? "s" : ""} par l'IA (analyse par règles en attendant).` : "Toutes les lettres ont été analysées par l'IA."}</p>
              {pendingAi > 0 && <Submit className="btn btn-primary btn-sm mt-3 w-full" pendingLabel="Analyse en cours…">Analyser les lettres</Submit>}
              <p className="mt-2 text-xs text-muted">Seuls le texte de la lettre et l&apos;intitulé du poste sont transmis, sans nom ni coordonnées.</p>
            </form>
          ) : (
            <section className="card p-4 text-sm">
              <h2 className="font-bold">Analyse de la motivation</h2>
              <p className="mt-1 text-ink-soft">Analyse par règles : personnalisation, réalisations concrètes, lien avec le poste. L&apos;analyse par IA s&apos;active dès que la clé est configurée par Global Talents.</p>
            </section>
          )}

          <form key={JSON.stringify(settings)} action={saveScreeningSettings} className="card space-y-3 p-4 text-sm">
            <input type="hidden" name="job_id" value={job.id} />
            <h2 className="font-bold">Réglages de cette offre</h2>
            <fieldset className="space-y-2">
              <legend className="label">Importance des critères complémentaires</legend>
              {SECONDARY.map((s) => (
                <label key={s.key} className="flex items-center justify-between gap-2">
                  <span>{s.label}</span>
                  <select name={`w_${s.key}`} defaultValue={String(settings.weights[s.key])} className="input w-auto py-1 text-sm">
                    <option value="0">Ignorer</option>
                    <option value="1">Normale</option>
                    <option value="2">Forte</option>
                  </select>
                </label>
              ))}
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="label">Critères obligatoires</legend>
              <label className="flex gap-2"><input type="checkbox" name="exclude_failed" defaultChecked={settings.exclude_failed} /> Exclure les réponses éliminatoires</label>
              <label className="flex gap-2"><input type="checkbox" name="require_study" defaultChecked={settings.require_study} /> Diplôme minimum exigé</label>
              <label className="flex gap-2"><input type="checkbox" name="require_experience" defaultChecked={settings.require_experience} /> Expérience minimum exigée</label>
              <label className="flex gap-2"><input type="checkbox" name="same_country" defaultChecked={settings.same_country} /> Résider dans le pays du poste</label>
            </fieldset>
            <Submit className="btn btn-ghost w-full">Enregistrer et reclasser</Submit>
          </form>
        </aside>
      </div>
    </div>
  );
}

function Candidate({ r, rank }: { r: Ranked; rank: number }) {
  const stage = stageOf(r.c.stage);
  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo font-display text-lg font-bold text-white" aria-label={`Rang ${rank}`}>{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/recruteur/candidatures/${r.c.application_id}`} className="text-lg font-bold hover:text-indigo">{r.c.name}</Link>
            {r.c.stage !== "nouvelle" && <span className="chip bg-wash text-indigo">{stage.label}</span>}
          </div>
          <p className="text-sm text-ink-soft">{r.c.headline || "Titre non renseigné"} · {r.c.city || "ville non renseignée"}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.highlights.slice(0, 4).map((h) => <span key={h} className="chip bg-leaf-soft text-leaf">{h}</span>)}
            {r.concerns.slice(0, 3).map((h) => <span key={h} className="chip bg-clay-soft text-clay">{h}</span>)}
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-bold leading-none">{r.score}<span className="text-base text-muted">/100</span></p>
          <p className="mt-1 text-xs text-ink-soft">Offre {r.offer}{r.extra !== null && ` · Complément ${r.extra}`}</p>
        </div>
      </div>

      <details className="mt-3 group">
        <summary className="cursor-pointer text-sm font-semibold text-indigo">Pourquoi ce rang ?</summary>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {r.criteria.map((k) => (
            <div key={k.key}>
              <dt className="flex items-center justify-between gap-2">
                <span className="font-medium">{k.label}{k.group === "complement" && <span className="text-xs text-muted"> · complément</span>}</span>
                <span className="text-xs text-ink-soft">{k.value === null ? "non compté" : `${Math.round(k.value * 100)} %`}</span>
              </dt>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-wash" aria-hidden="true">
                {k.value !== null && <div className={`h-full rounded-full ${tone(k.value * 100)}`} style={{ width: `${Math.max(4, k.value * 100)}%` }} />}
              </div>
              <dd className="mt-0.5 text-xs text-ink-soft">{k.detail}</dd>
            </div>
          ))}
        </dl>
        {r.motivation.strengths.length > 0 && <p className="mt-3 text-sm"><span className="font-semibold">Lettre :</span> {r.motivation.strengths.join(" · ")}</p>}
      </details>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <label className="mr-auto flex items-center gap-2 text-sm"><input type="checkbox" name="ids" value={r.c.application_id} form="bulk" defaultChecked={r.c.stage === "nouvelle" || r.c.stage === "preselection"} /> Sélectionner</label>
        <Link href={`/recruteur/candidatures/${r.c.application_id}`} className="btn btn-ghost btn-sm">Voir la fiche</Link>
        {!["entretien_rh", "entretien_manager", "offre", "embauche"].includes(r.c.stage) && (
          <form action={moveApplication}>
            <input type="hidden" name="id" value={r.c.application_id} />
            <input type="hidden" name="stage" value="entretien_rh" />
            <button className="btn btn-primary btn-sm">Inviter en entretien</button>
          </form>
        )}
      </div>
    </li>
  );
}
