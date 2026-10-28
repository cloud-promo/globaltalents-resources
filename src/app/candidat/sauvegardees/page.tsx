import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { JOB_FROM, JOB_SELECT, getMatchProfile, type JobRow } from "@/lib/jobs";
import { JobCard } from "@/components/JobCard";
import { SaveButton } from "@/components/SaveButton";
import { matchScore } from "@/lib/match";

export const metadata = { title: "Offres sauvegardées" };

export default async function SavedPage() {
  const u = await requireUser(["candidate"]);
  const jobs = await query<JobRow & { open: boolean }>(
    `SELECT ${JOB_SELECT}, (j.status='published' AND j.expires_at>now()) open ${JOB_FROM}
     JOIN saved_jobs sj ON sj.job_id=j.id AND sj.user_id=$1 ORDER BY sj.created_at DESC`,
    [u.id],
  );
  const profile = await getMatchProfile(u.id);
  return (
    <div>
      <h1 className="text-2xl font-bold">Offres sauvegardées</h1>
      <p className="mt-1 text-ink-soft">Les offres que vous avez mises de côté pour plus tard.</p>
      <div className="mt-5 grid gap-3">
        {jobs.map((j) => (
          <div key={j.id} className={j.open ? "" : "opacity-60"}>
            <JobCard job={j} score={profile ? matchScore(profile, j).score : undefined} saved={<SaveButton jobId={j.id} saved />} />
            {!j.open && <p className="mt-1 text-sm text-muted">Cette offre est clôturée.</p>}
          </div>
        ))}
        {!jobs.length && (
          <div className="card p-8 text-center">
            <p className="text-ink-soft">Aucune offre sauvegardée. Utilisez l&apos;icône signet sur une offre pour la retrouver ici.</p>
            <Link href="/offres" className="btn btn-primary mt-4">Parcourir les offres</Link>
          </div>
        )}
      </div>
    </div>
  );
}
