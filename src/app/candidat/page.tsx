import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { loadProfile, completeness } from "@/lib/profile";
import { JOB_FROM, JOB_SELECT, PUBLISHED, type JobRow } from "@/lib/jobs";
import { matchScore } from "@/lib/match";
import { JobCard } from "@/components/JobCard";
import { SaveButton } from "@/components/SaveButton";
import { stageOf } from "@/lib/ref";
import { since } from "@/lib/format";

export const metadata = { title: "Mon espace" };

export default async function CandidateHome() {
  const u = await requireUser(["candidate"]);
  const loaded = await loadProfile(u.id);
  const comp = completeness(loaded);
  const p = loaded.profile!;
  const profile = { ...p, skills: loaded.skills.map((s) => s.name) };

  const [candidates, applications, saved] = await Promise.all([
    query<JobRow>(
      `SELECT ${JOB_SELECT} ${JOB_FROM} WHERE ${PUBLISHED}
         AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.job_id=j.id AND a.candidate_id=$1)
         AND NOT EXISTS (SELECT 1 FROM hidden_companies h WHERE h.company_id=j.company_id AND h.user_id=$1)
       ORDER BY j.published_at DESC LIMIT 200`,
      [u.id],
    ),
    query<{ id: string; stage: string; title: string; company: string; created_at: string; viewed_at: string | null }>(
      `SELECT a.id,a.stage,j.title,CASE WHEN j.confidential THEN 'Entreprise confidentielle' ELSE c.name END company,a.created_at,a.viewed_at
       FROM applications a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id
       WHERE a.candidate_id=$1 ORDER BY a.updated_at DESC LIMIT 5`,
      [u.id],
    ),
    query<{ job_id: number }>(`SELECT job_id FROM saved_jobs WHERE user_id=$1`, [u.id]),
  ]);
  const savedSet = new Set(saved.map((s) => s.job_id));
  const matches = candidates
    .map((j) => ({ job: j, score: matchScore(profile, j).score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const hasCv = loaded.documents.some((d) => d.kind === "cv");

  return (
    <div className="space-y-8">
      <section className="card overflow-hidden">
        <div className="weave h-1.5" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-6 p-5 sm:p-6">
          <div className="relative grid h-20 w-20 shrink-0 place-items-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-wash)" strokeWidth="4" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke={comp.percent >= 80 ? "var(--color-leaf)" : "var(--color-saffron)"} strokeWidth="4"
                strokeDasharray={`${(comp.percent / 100) * 97.4} 97.4`} strokeLinecap="round" />
            </svg>
            <span className="font-display text-lg font-bold">{comp.percent} %</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">Bonjour {u.first_name}</h1>
            <p className="mt-1 text-ink-soft">
              {comp.percent === 100
                ? "Votre profil est complet. Les scores de correspondance sont au plus juste."
                : `Profil complété à ${comp.percent} %. Il manque : ${comp.missing.slice(0, 3).join(", ")}${comp.missing.length > 3 ? "…" : "."}`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`chip ${hasCv ? "bg-leaf-soft text-leaf" : "bg-saffron-soft text-ochre"}`}>{hasCv ? "CV ajouté" : "CV manquant"}</span>
              <span className={`chip ${p.visible_cvtheque ? "bg-leaf-soft text-leaf" : ""}`}>{p.visible_cvtheque ? "Visible dans la CVthèque" : "Masqué de la CVthèque"}</span>
            </div>
          </div>
          {comp.percent < 100 && <Link href="/candidat/profil" className="btn btn-primary">Compléter mon profil</Link>}
        </div>
      </section>

      <section aria-labelledby="matchs">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 id="matchs" className="text-xl font-bold">Vos meilleures correspondances</h2>
            <p className="text-sm text-ink-soft">Classées selon votre fonction, votre expérience, vos études, votre localisation et vos compétences.</p>
          </div>
          <Link href="/offres" className="shrink-0 text-sm font-semibold text-indigo hover:underline">Toutes les offres</Link>
        </div>
        <div className="grid gap-3">
          {matches.map((m) => (
            <JobCard key={m.job.id} job={m.job} score={m.score} saved={<SaveButton jobId={m.job.id} saved={savedSet.has(m.job.id)} />} />
          ))}
          {!matches.length && <p className="card p-6 text-ink-soft">Aucune nouvelle offre pour le moment.</p>}
        </div>
      </section>

      <section aria-labelledby="cands">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 id="cands" className="text-xl font-bold">Mes dernières candidatures</h2>
          <Link href="/candidat/candidatures" className="text-sm font-semibold text-indigo hover:underline">Tout voir</Link>
        </div>
        <ul className="card divide-y divide-line">
          {applications.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <span>
                <span className="block font-semibold">{a.title}</span>
                <span className="text-sm text-ink-soft">{a.company}, envoyée {since(a.created_at)}</span>
              </span>
              <span className="flex gap-2">
                {a.viewed_at && <span className="chip">CV consulté</span>}
                <span className="chip bg-indigo text-white">{stageOf(a.stage).candidate}</span>
              </span>
            </li>
          ))}
          {!applications.length && <li className="p-6 text-ink-soft">Vous n&apos;avez pas encore postulé. Commencez par vos meilleures correspondances ci-dessus.</li>}
        </ul>
      </section>
    </div>
  );
}
