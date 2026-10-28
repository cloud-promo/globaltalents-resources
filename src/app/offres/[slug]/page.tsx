import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getJob, getQuestions, getMatchProfile, JOB_FROM, JOB_SELECT, PUBLISHED, type JobRow } from "@/lib/jobs";
import { getUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { matchScore } from "@/lib/match";
import { date, jobPath, since, salaryRange } from "@/lib/format";
import { EXPERIENCE_LEVELS, STUDY_LEVELS, REMOTE_OPTIONS, labelOf, stageOf } from "@/lib/ref";
import { CompanyBadge, JobCard, MatchMeter } from "@/components/JobCard";
import { SaveButton } from "@/components/SaveButton";
import { ActionForm, Submit } from "@/components/Form";
import { applyToJob, reportJob, toggleCompanyRelation } from "@/app/actions/candidate";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

const idFrom = (slug: string) => Number(slug.split("-")[0]) || 0;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const job = await getJob(idFrom((await params).slug));
  if (!job) return { title: "Offre introuvable" };
  return {
    title: `${job.title} à ${job.city} (${job.contract_type})`,
    description: `${job.company_name} recrute : ${job.title} à ${job.city}, ${job.country_name}. ${job.description.slice(0, 140)}`,
    alternates: { canonical: jobPath(job.id, job.title, job.city) },
  };
}

function Paragraphs({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="prose-gtr text-[0.98rem] text-ink">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        const bullets = lines.filter((l) => /^\s*[-•]/.test(l));
        if (bullets.length === lines.length) {
          return <ul key={i}>{lines.map((l, k) => <li key={k}>{l.replace(/^\s*[-•]\s?/, "")}</li>)}</ul>;
        }
        if (bullets.length) {
          const head = lines.filter((l) => !/^\s*[-•]/.test(l));
          return (
            <div key={i}>
              {head.map((h, k) => <p key={k}>{h}</p>)}
              <ul>{bullets.map((l, k) => <li key={k}>{l.replace(/^\s*[-•]\s?/, "")}</li>)}</ul>
            </div>
          );
        }
        return <p key={i}>{b}</p>;
      })}
    </div>
  );
}

export default async function JobPage({ params }: { params: Params }) {
  const { slug } = await params;
  const id = idFrom(slug);
  const job = await getJob(id);
  if (!job) notFound();
  const canonical = jobPath(job.id, job.title, job.city);
  if (`/offres/${slug}` !== canonical) redirect(canonical);

  await query(`UPDATE jobs SET views=views+1 WHERE id=$1`, [id]);
  const user = await getUser();
  const isCandidate = user?.role === "candidate";
  const [questions, similar] = await Promise.all([
    getQuestions(id),
    query<JobRow>(
      `SELECT ${JOB_SELECT} ${JOB_FROM} WHERE ${PUBLISHED} AND j.id<>$1 AND (j.function_id=$2 OR j.company_id=$3)
       ORDER BY (j.function_id=$2) DESC, j.published_at DESC LIMIT 4`,
      [id, job.function_id, job.company_id],
    ),
  ]);

  let match: ReturnType<typeof matchScore> | null = null;
  let existing: { id: string; stage: string; created_at: string } | null = null;
  let docs: { id: string; filename: string; is_primary: boolean }[] = [];
  let saved = false;
  let following = false;
  let hidden = false;
  if (isCandidate) {
    const profile = await getMatchProfile(user.id);
    match = profile ? matchScore(profile, job) : null;
    existing = await one<{ id: string; stage: string; created_at: string }>(`SELECT id,stage,created_at FROM applications WHERE job_id=$1 AND candidate_id=$2`, [id, user.id]);
    docs = await query<{ id: string; filename: string; is_primary: boolean }>(`SELECT id,filename,is_primary FROM documents WHERE user_id=$1 AND kind='cv' ORDER BY is_primary DESC, created_at DESC`, [user.id]);
    saved = !!(await one(`SELECT 1 FROM saved_jobs WHERE user_id=$1 AND job_id=$2`, [user.id, id]));
    following = !!(await one(`SELECT 1 FROM followed_companies WHERE user_id=$1 AND company_id=$2`, [user.id, job.company_id]));
    hidden = !!(await one(`SELECT 1 FROM hidden_companies WHERE user_id=$1 AND company_id=$2`, [user.id, job.company_id]));
  }

  const salary = job.show_salary ? salaryRange(job.salary_min, job.salary_max, job.currency) : "";
  const appUrl = process.env.APP_URL || "https://globaltalents-resources.com";
  const shareUrl = encodeURIComponent(appUrl + canonical);
  const shareText = encodeURIComponent(`${job.title} chez ${job.company_name} à ${job.city}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: `${job.description}\n\n${job.profile}`,
    datePosted: job.published_at,
    validThrough: job.expires_at,
    employmentType: job.contract_type === "CDI" ? "FULL_TIME" : job.contract_type === "Stage" ? "INTERN" : "CONTRACTOR",
    hiringOrganization: { "@type": "Organization", name: job.company_name },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.city, addressCountry: job.country_code } },
    ...(salary && job.salary_min
      ? { baseSalary: { "@type": "MonetaryAmount", currency: job.currency, value: { "@type": "QuantitativeValue", minValue: job.salary_min, maxValue: job.salary_max, unitText: "MONTH" } } }
      : {}),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav className="mb-4 text-sm text-ink-soft" aria-label="Fil d'Ariane">
        <Link href="/offres" className="hover:text-indigo">Offres d&apos;emploi</Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/offres?pays=${job.country_code}`} className="hover:text-indigo">{job.country_name}</Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <article>
          <header className="card p-5 sm:p-6">
            <div className="flex gap-4">
              <CompanyBadge name={job.company_name} color={job.confidential ? "#6B7394" : job.brand_color} size={56} />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold sm:text-3xl">{job.title}</h1>
                <p className="mt-1 text-ink-soft">
                  {job.company_slug ? <Link href={`/entreprises/${job.company_slug}`} className="font-semibold text-indigo hover:underline">{job.company_name}</Link> : job.company_name}
                  , {job.city} ({job.country_name})
                </p>
              </div>
              {isCandidate && <SaveButton jobId={job.id} saved={saved} />}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Info label="Contrat" value={job.contract_type} />
              <Info label="Expérience" value={labelOf(EXPERIENCE_LEVELS, job.experience_level)} />
              <Info label="Études" value={labelOf(STUDY_LEVELS, job.study_level)} />
              <Info label="Lieu de travail" value={labelOf(REMOTE_OPTIONS, job.remote)} />
              <Info label="Postes à pourvoir" value={String(job.positions)} />
              <Info label="Salaire" value={salary || "Non communiqué"} />
              <Info label="Fonction" value={job.function_name ?? ""} />
              <Info label="Publiée" value={since(job.published_at)} />
              <Info label="Date limite" value={date(job.expires_at)} />
            </dl>
          </header>

          <div className="mt-6 space-y-6">
            {job.company_description && (
              <Section title="L'entreprise"><Paragraphs text={job.company_description} /></Section>
            )}
            {job.company_culture && (
              <Section title="Culture de l'entreprise"><Paragraphs text={job.company_culture} /></Section>
            )}
            <Section title="Le poste"><Paragraphs text={job.description} /></Section>
            {job.profile && <Section title="Profil recherché"><Paragraphs text={job.profile} /></Section>}
            {job.skills.length > 0 && (
              <Section title="Compétences demandées">
                <ul className="flex flex-wrap gap-1.5">{job.skills.map((s) => <li key={s} className="chip">{s}</li>)}</ul>
              </Section>
            )}
            {job.languages.length > 0 && (
              <Section title="Langues"><p>{job.languages.join(", ")}</p></Section>
            )}
            {job.benefits && <Section title="Avantages"><Paragraphs text={job.benefits} /></Section>}
            <Section title="Lieu">
              <p>{job.city}, {job.country_name}</p>
              <a className="mt-2 inline-block text-sm font-semibold text-indigo hover:underline" target="_blank" rel="noopener noreferrer"
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(job.city + ", " + job.country_name)}`}>
                Voir sur la carte
              </a>
            </Section>
          </div>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-5">
            {!user && (
              <>
                <h2 className="text-lg font-bold">Postuler à cette offre</h2>
                <p className="mt-2 text-sm text-ink-soft">Créez votre compte en 2 minutes pour postuler et suivre votre candidature.</p>
                <Link href={`/inscription?next=${encodeURIComponent(canonical)}`} className="btn btn-primary mt-4 w-full">Créer mon compte et postuler</Link>
                <Link href={`/connexion?next=${encodeURIComponent(canonical)}`} className="btn btn-ghost mt-2 w-full">J&apos;ai déjà un compte</Link>
              </>
            )}
            {user && !isCandidate && <p className="text-sm text-ink-soft">Connectez-vous avec un compte candidat pour postuler.</p>}
            {isCandidate && match && (
              <div className="mb-4 border-b border-line pb-4">
                <MatchMeter score={match.score} />
                <ul className="mt-3 space-y-1 text-sm">
                  {match.reasons.map((r, i) => (
                    <li key={i} className={`flex gap-2 ${r.ok ? "text-ink" : "text-muted"}`}>
                      <span aria-hidden="true">{r.ok ? "✓" : "–"}</span> {r.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {isCandidate && existing && (
              <div>
                <h2 className="text-lg font-bold">Vous avez postulé</h2>
                <p className="mt-1 text-sm text-ink-soft">Le {date(existing.created_at)}. Statut : {stageOf(existing.stage).candidate}.</p>
                <Link href="/candidat/candidatures" className="btn btn-ghost mt-3 w-full">Suivre ma candidature</Link>
              </div>
            )}
            {isCandidate && !existing && (
              <ActionForm action={applyToJob} className="space-y-4">
                <h2 className="text-lg font-bold">Postuler</h2>
                <input type="hidden" name="job_id" value={job.id} />
                {docs.length ? (
                  <label className="block">
                    <span className="label">CV envoyé</span>
                    <select name="document_id" className="input" defaultValue={docs[0].id}>
                      {docs.map((d) => <option key={d.id} value={d.id}>{d.filename}{d.is_primary ? " (principal)" : ""}</option>)}
                    </select>
                  </label>
                ) : (
                  <p className="rounded-lg bg-saffron-soft p-3 text-sm">
                    Ajoutez d&apos;abord votre CV. <Link href="/candidat/profil#documents" className="font-semibold text-indigo underline">Ajouter mon CV</Link>
                  </p>
                )}
                {questions.map((q) => (
                  <fieldset key={q.id}>
                    <legend className="label">{q.question}</legend>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-1.5"><input type="radio" name={`q_${q.id}`} value="oui" required /> Oui</label>
                      <label className="flex items-center gap-1.5"><input type="radio" name={`q_${q.id}`} value="non" /> Non</label>
                    </div>
                  </fieldset>
                ))}
                <label className="block">
                  <span className="label">Message au recruteur (facultatif)</span>
                  <textarea name="cover_letter" className="input" maxLength={4000} placeholder="Pourquoi ce poste vous intéresse, en quelques lignes." />
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="anonymous" className="mt-1" /> Candidature anonyme : votre nom est masqué jusqu&apos;à l&apos;entretien
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="share_test" className="mt-1" /> Partager les résultats de mes tests avec ce recruteur
                </label>
                <Submit className="btn btn-primary w-full" pendingLabel="Envoi…">Envoyer ma candidature</Submit>
              </ActionForm>
            )}
          </div>

          <div className="card p-5 text-sm">
            <h2 className="font-semibold">Partager l&apos;offre</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${shareText}%20${shareUrl}`}>WhatsApp</a>
              <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}>LinkedIn</a>
              <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}>Facebook</a>
              <a className="btn btn-ghost btn-sm" href={`mailto:?subject=${shareText}&body=${shareUrl}`}>E-mail</a>
            </div>
            {isCandidate && !job.confidential && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <form action={toggleCompanyRelation}>
                  <input type="hidden" name="company_id" value={job.company_id} />
                  <input type="hidden" name="kind" value="follow" />
                  <button className="btn btn-ghost btn-sm">{following ? "Ne plus suivre l'entreprise" : "Suivre l'entreprise"}</button>
                </form>
                <form action={toggleCompanyRelation}>
                  <input type="hidden" name="company_id" value={job.company_id} />
                  <input type="hidden" name="kind" value="hide" />
                  <button className="btn btn-ghost btn-sm">{hidden ? "Ne plus masquer" : "Masquer ses offres"}</button>
                </form>
              </div>
            )}
            <details className="mt-4 border-t border-line pt-4">
              <summary className="cursor-pointer text-muted hover:text-clay">Signaler une offre suspecte</summary>
              <ActionForm action={reportJob} className="mt-3 space-y-2" resetOnSuccess>
                <input type="hidden" name="job_id" value={job.id} />
                <textarea name="reason" className="input min-h-20 text-sm" required maxLength={500} placeholder="Ex. on me demande de payer pour un entretien" />
                <Submit className="btn btn-danger btn-sm" pendingLabel="Envoi…">Envoyer le signalement</Submit>
              </ActionForm>
              <p className="hint mt-2">Une vraie entreprise ne vous demande jamais d&apos;argent pour postuler.</p>
            </details>
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-12" aria-labelledby="similaires">
          <h2 id="similaires" className="mb-4 text-xl font-bold">Offres similaires</h2>
          <div className="grid gap-3 md:grid-cols-2">{similar.map((j) => <JobCard key={j.id} job={j} />)}</div>
        </section>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
