import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { date, jobPath, shortDate } from "@/lib/format";
import { CONTRACT_TYPES, EXPERIENCE_LEVELS, labelOf, stageOf, STUDY_LEVELS } from "@/lib/ref";
import { withdrawApplication } from "@/app/actions/candidate";

export const metadata = { title: "Mes candidatures" };

type App = {
  id: string; stage: string; score: number; anonymous: boolean; share_test: boolean; created_at: string; viewed_at: string | null;
  job_id: number; title: string; city: string; company: string; contract_type: string; experience_level: string; study_level: string;
  published_at: string; expires_at: string; positions: number; job_status: string;
  total: number; below: number; opened: number;
};

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ envoyee?: string }> }) {
  const { envoyee } = await searchParams;
  const u = await requireUser(["candidate"]);
  const apps = await query<App>(
    `SELECT a.id,a.stage,a.score,a.anonymous,a.share_test,a.created_at,a.viewed_at,
       j.id job_id,j.title,j.city,CASE WHEN j.confidential THEN 'Entreprise confidentielle' ELSE c.name END company,
       j.contract_type,j.experience_level,j.study_level,j.published_at,j.expires_at,j.positions,j.status job_status,
       (SELECT count(*)::int FROM applications x WHERE x.job_id=a.job_id) total,
       (SELECT count(*)::int FROM applications x WHERE x.job_id=a.job_id AND x.score < a.score) below,
       (SELECT count(*)::int FROM applications x WHERE x.job_id=a.job_id AND x.viewed_at IS NOT NULL) opened
     FROM applications a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id
     WHERE a.candidate_id=$1 ORDER BY a.created_at DESC`,
    [u.id],
  );
  const events = apps.length
    ? await query<{ application_id: string; label: string; created_at: string }>(
        `SELECT application_id,label,created_at FROM application_events WHERE application_id = ANY($1) AND visible_to_candidate ORDER BY created_at`,
        [apps.map((a) => a.id)],
      )
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Mes candidatures</h1>
        <p className="mt-1 text-ink-soft">{apps.length} candidature{apps.length > 1 ? "s" : ""}. Chaque étape franchie chez le recruteur s&apos;affiche ici.</p>
      </div>
      {envoyee && (
        <p className="rounded-lg border border-[#bfe0cf] bg-leaf-soft p-3 text-sm text-leaf">Votre candidature est envoyée. Vous serez prévenu dès que le recruteur l&apos;ouvre.</p>
      )}
      {!apps.length && (
        <div className="card p-8 text-center">
          <p className="text-ink-soft">Vous n&apos;avez encore postulé à aucune offre.</p>
          <Link href="/offres" className="btn btn-primary mt-4">Chercher une offre</Link>
        </div>
      )}
      {apps.map((a) => {
        const others = a.total - 1;
        const percentile = others > 0 ? Math.round((100 * a.below) / others) : null;
        const openRate = a.total > 0 ? Math.round((100 * a.opened) / a.total) : 0;
        const stage = stageOf(a.stage);
        const closed = a.job_status !== "published" || new Date(a.expires_at) < new Date();
        return (
          <article key={a.id} className="card overflow-hidden">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
              <div>
                <h2 className="text-lg font-semibold">
                  <Link href={jobPath(a.job_id, a.title, a.city)} className="hover:text-indigo">{a.title}</Link>
                </h2>
                <p className="text-sm text-ink-soft">{a.company}, {a.city}</p>
                <p className="mt-1 text-sm font-medium">Correspondance avec votre profil : {a.score} %</p>
              </div>
              <span className={`chip ${a.stage === "refuse" ? "bg-clay-soft text-clay" : a.stage === "embauche" ? "bg-leaf-soft text-leaf" : "bg-indigo text-white"}`}>
                {stage.candidate}
              </span>
            </header>
            <div className="grid gap-6 p-5 md:grid-cols-3">
              <dl className="space-y-1.5 text-sm">
                <Row k="Publiée le" v={shortDate(a.published_at)} />
                <Row k="Clôture" v={shortDate(a.expires_at)} />
                <Row k="Postes" v={String(a.positions)} />
                <Row k="Contrat" v={CONTRACT_TYPES.includes(a.contract_type as never) ? a.contract_type : ""} />
                <Row k="Expérience" v={labelOf(EXPERIENCE_LEVELS, a.experience_level)} />
                <Row k="Études" v={labelOf(STUDY_LEVELS, a.study_level)} />
              </dl>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Avancement</h3>
                <ol className="relative space-y-3 border-l-2 border-line pl-4 text-sm">
                  {events.filter((e) => e.application_id === a.id).map((e, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-indigo" aria-hidden="true" />
                      {e.label}
                      <span className="block text-xs text-muted">{date(e.created_at)}</span>
                    </li>
                  ))}
                  {!a.viewed_at && (
                    <li className="relative text-muted">
                      <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-line bg-white" aria-hidden="true" />
                      CV pas encore ouvert par le recruteur
                    </li>
                  )}
                  {closed && <li className="relative text-muted">Annonce clôturée le {shortDate(a.expires_at)}</li>}
                </ol>
              </div>
              <div className="rounded-lg bg-wash p-4 text-sm">
                <h3 className="font-semibold">Vos chances de succès</h3>
                {percentile !== null ? (
                  <p className="mt-2">Votre profil correspond mieux que celui de <strong>{percentile} %</strong> des autres candidats ({a.total} au total).</p>
                ) : (
                  <p className="mt-2">Vous êtes pour l&apos;instant le seul candidat sur cette offre.</p>
                )}
                <p className="mt-2">
                  {a.viewed_at
                    ? `Votre CV a été ouvert, comme ${openRate} % des candidatures sur ce poste.`
                    : `Votre CV n'a pas encore été ouvert. Le recruteur a ouvert ${openRate} % des candidatures sur ce poste.`}
                </p>
                <p className="mt-3 text-xs text-ink-soft">
                  {a.anonymous ? "Candidature anonyme." : "Candidature nominative."} {a.share_test ? "Résultats de tests partagés." : "Résultats de tests non partagés."}
                </p>
              </div>
            </div>
            {["nouvelle", "preselection"].includes(a.stage) && (
              <footer className="border-t border-line px-5 py-3 text-right">
                <form action={withdrawApplication}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-sm text-muted hover:text-clay">Retirer ma candidature</button>
                </form>
              </footer>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
