import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { loadProfile } from "@/lib/profile";
import { getRefs } from "@/lib/refdata";
import { date, shortDate } from "@/lib/format";
import { EXPERIENCE_LEVELS, STUDY_LEVELS, STAGES, labelOf, stageOf } from "@/lib/ref";
import { ActionForm, Submit } from "@/components/Form";
import { moveApplication, addNote, messageCandidate } from "@/app/actions/recruiter";
import { latestPersonality } from "@/lib/personality-server";
import { TraitBars } from "@/components/TraitBars";
import { dominant } from "@/lib/personality";

export const metadata = { title: "Fiche candidat" };

type App = {
  id: string; job_id: number; job_title: string; candidate_id: string; stage: string; score: number; score_reasons: { label: string; ok: boolean }[];
  answers: { question: string; answer: string }[]; cover_letter: string; anonymous: boolean; share_test: boolean; failed_screening: boolean;
  document_id: string | null; created_at: string; viewed_at: string | null;
  first_name: string; last_name: string; email: string; phone: string;
};

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { user, company } = await requireRecruiter();
  const app = await one<App>(
    `SELECT a.*, j.title job_title, u.first_name,u.last_name,u.email,u.phone
     FROM applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.candidate_id
     WHERE a.id=$1 AND j.company_id=$2`,
    [id, company.company_id],
  );
  if (!app) notFound();

  // Première ouverture : le candidat voit « CV consulté »
  if (!app.viewed_at) {
    await query(`UPDATE applications SET viewed_at=now() WHERE id=$1`, [app.id]);
    await query(`INSERT INTO application_events(application_id,kind,label,actor_id) VALUES($1,'viewed','CV consulté par le recruteur',$2)`, [app.id, user.id]);
    await query(
      `INSERT INTO notifications(user_id,title,body,link) SELECT $1,'Votre candidature a été vue',$2,'/candidat/candidatures'
       FROM candidate_profiles WHERE user_id=$1 AND notify_cv_viewed`,
      [app.candidate_id, `${app.job_title} : le recruteur a ouvert votre candidature.`],
    );
  }

  const [data, notes, events, { functions }] = await Promise.all([
    loadProfile(app.candidate_id),
    query<{ body: string; rating: number | null; created_at: string; author: string }>(
      `SELECT n.body,n.rating,n.created_at,coalesce(u.first_name||' '||u.last_name,'Ancien membre') author
       FROM application_notes n LEFT JOIN users u ON u.id=n.author_id WHERE n.application_id=$1 ORDER BY n.created_at DESC`,
      [app.id],
    ),
    query<{ label: string; created_at: string }>(`SELECT label,created_at FROM application_events WHERE application_id=$1 ORDER BY created_at DESC`, [app.id]),
    getRefs(),
  ]);
  const p = data.profile;
  const test = app.share_test ? await latestPersonality(app.candidate_id) : null;
  const wanted = (await one<{ personality_traits: string[] }>(`SELECT personality_traits FROM jobs WHERE id=$1`, [app.job_id]))?.personality_traits ?? [];
  const masked = app.anonymous && !["entretien_rh", "entretien_manager", "offre", "embauche"].includes(app.stage);
  const avg = notes.filter((n) => n.rating).reduce((s, n, _, arr) => s + (n.rating ?? 0) / arr.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/recruteur/offres/${app.job_id}`} className="text-sm text-ink-soft hover:text-indigo">{app.job_title}</Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{masked ? "Candidat anonyme" : `${app.first_name} ${app.last_name}`}</h1>
            <p className="text-ink-soft">{p?.title || "Profil sans titre"}{p?.city && `, ${p.city}`}</p>
            {masked && <p className="mt-1 text-sm text-ochre">Nom et coordonnées masqués jusqu&apos;à l&apos;étape « Entretien RH ».</p>}
          </div>
          <form action={moveApplication} className="flex items-center gap-2">
            <input type="hidden" name="id" value={app.id} />
            <label className="text-sm font-semibold" htmlFor="stage">Étape</label>
            <select id="stage" name="stage" defaultValue={app.stage} className="input w-auto">
              {STAGES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
            </select>
            <button className="btn btn-primary">Mettre à jour</button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Correspondance : {app.score} %</h2>
              {app.failed_screening && <span className="chip bg-clay-soft text-clay">Présélection non validée</span>}
            </div>
            <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              {app.score_reasons.map((r, i) => (
                <li key={i} className={r.ok ? "" : "text-muted"}><span aria-hidden="true">{r.ok ? "✓ " : "– "}</span>{r.label}</li>
              ))}
            </ul>
            {app.answers.length > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <h3 className="text-sm font-semibold">Questions de présélection</h3>
                <dl className="mt-2 space-y-1 text-sm">
                  {app.answers.map((a, i) => (
                    <div key={i} className="flex justify-between gap-3"><dt className="text-ink-soft">{a.question}</dt><dd className="font-semibold uppercase">{a.answer}</dd></div>
                  ))}
                </dl>
              </div>
            )}
          </section>

          {app.cover_letter && (
            <section className="card p-5">
              <h2 className="text-lg font-bold">Message du candidat</h2>
              <p className="mt-2 whitespace-pre-line text-sm">{app.cover_letter}</p>
            </section>
          )}

          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Test de personnalité Boussole</h2>
              {test && <span className="chip bg-indigo text-white">Profil {test.profile}</span>}
            </div>
            {test ? (
              <>
                <p className="mt-1 text-sm text-ink-soft">Passé le {date(test.created_at)}. Traits dominants : {dominant(test.scores).first.label.toLowerCase()}, {dominant(test.scores).second.label.toLowerCase()}.</p>
                <div className="mt-4"><TraitBars scores={test.scores} highlight={wanted} /></div>
                <p className="mt-3 text-xs text-muted">Auto-évaluation indicative : à utiliser comme support d&apos;entretien, jamais comme seul critère de décision.</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">{app.share_test ? "Le candidat n'a pas encore passé le test." : "Le candidat n'a pas partagé ses résultats pour cette candidature."}</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-bold">Profil</h2>
            {p?.summary && <p className="mt-2 text-sm">{p.summary}</p>}
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row k="Expérience" v={labelOf(EXPERIENCE_LEVELS, p?.experience_level)} />
              <Row k="Études" v={labelOf(STUDY_LEVELS, p?.study_level)} />
              <Row k="Fonction actuelle" v={functions.find((f) => f.id === p?.current_function_id)?.name ?? ""} />
              <Row k="Disponibilité" v={p?.availability ?? ""} />
              <Row k="Salaire souhaité" v={p?.desired_salary ?? ""} />
              <Row k="Langues" v={data.languages.map((l) => `${l.name} (${l.level.toLowerCase()})`).join(", ")} />
            </dl>
            {data.skills.length > 0 && <ul className="mt-4 flex flex-wrap gap-1.5">{data.skills.map((s) => <li key={s.name} className="chip">{s.name}</li>)}</ul>}
            {data.experiences.length > 0 && (
              <>
                <h3 className="mt-5 font-semibold">Expériences</h3>
                <ul className="mt-2 space-y-3 text-sm">
                  {data.experiences.map((e) => (
                    <li key={e.id}>
                      <strong>{e.title}</strong>, {masked ? "entreprise masquée" : e.company}
                      <span className="block text-xs text-muted">{shortDate(e.start_date)} à {e.end_date ? shortDate(e.end_date) : "aujourd'hui"}</span>
                      {e.description && <span className="block text-ink-soft">{e.description}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {data.educations.length > 0 && (
              <>
                <h3 className="mt-5 font-semibold">Formations</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {data.educations.map((e) => <li key={e.id}>{e.degree}{e.field && `, ${e.field}`}, {e.school}{e.year_end && ` (${e.year_end})`}</li>)}
                </ul>
              </>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-bold">Notes de l&apos;équipe {avg > 0 && <span className="text-base font-medium text-ink-soft">, moyenne {avg.toFixed(1)} / 5</span>}</h2>
            <ActionForm action={addNote} className="mt-3 space-y-2" resetOnSuccess>
              <input type="hidden" name="id" value={app.id} />
              <textarea name="body" className="input min-h-20" maxLength={3000} placeholder="Impressions, points à vérifier en entretien…" aria-label="Note" />
              <div className="flex items-center gap-3">
                <select name="rating" className="input w-auto" aria-label="Évaluation" defaultValue="">
                  <option value="">Sans évaluation</option>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
                </select>
                <Submit className="btn btn-ghost">Ajouter la note</Submit>
              </div>
            </ActionForm>
            <ul className="mt-4 space-y-3 text-sm">
              {notes.map((n, i) => (
                <li key={i} className="rounded-lg bg-wash p-3">
                  <p className="text-xs text-muted">{n.author}, {date(n.created_at)}{n.rating ? `, ${n.rating} / 5` : ""}</p>
                  {n.body && <p className="mt-1 whitespace-pre-line">{n.body}</p>}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5 text-sm">
            <h2 className="font-bold">Coordonnées et CV</h2>
            {masked ? (
              <p className="mt-2 text-ink-soft">Masquées tant que le candidat n&apos;a pas atteint l&apos;étape « Entretien RH ».</p>
            ) : (
              <dl className="mt-2 space-y-1">
                <Row k="E-mail" v={app.email} />
                <Row k="Téléphone" v={app.phone} />
              </dl>
            )}
            {app.document_id && !masked && (
              <a href={`/api/documents/${app.document_id}`} target="_blank" className="btn btn-primary mt-3 w-full">Ouvrir le CV</a>
            )}
            {app.document_id && masked && <p className="mt-3 text-ink-soft">Le CV sera disponible à l&apos;étape « Entretien RH ».</p>}
            {!masked && app.phone && (
              <a href={`https://wa.me/${app.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-2 w-full">Écrire sur WhatsApp</a>
            )}
            <p className="mt-3 text-xs text-muted">Reçue le {date(app.created_at)}. {app.share_test ? "Le candidat partage ses résultats de tests." : "Résultats de tests non partagés."}</p>
          </section>

          <section className="card p-5 text-sm">
            <h2 className="font-bold">Envoyer un message</h2>
            <ActionForm action={messageCandidate} className="mt-2 space-y-2" resetOnSuccess>
              <input type="hidden" name="id" value={app.id} />
              <textarea name="body" className="input min-h-24" maxLength={2000} placeholder="ex. Pouvez-vous nous indiquer vos disponibilités pour un entretien ?" aria-label="Message" />
              <Submit className="btn btn-ghost w-full">Envoyer</Submit>
            </ActionForm>
            <p className="hint">Le candidat le reçoit dans ses notifications et dans le suivi de sa candidature.</p>
          </section>

          <section className="card p-5 text-sm">
            <h2 className="font-bold">Historique</h2>
            <ol className="mt-2 space-y-2">
              {events.map((e, i) => (
                <li key={i}><span className="block">{e.label}</span><span className="text-xs text-muted">{date(e.created_at)}</span></li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted">Étape actuelle vue par le candidat : {stageOf(app.stage).candidate}.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
