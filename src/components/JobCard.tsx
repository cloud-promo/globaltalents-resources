import Link from "next/link";
import type { JobRow } from "@/lib/jobs";
import { jobPath, since, salaryRange, initials } from "@/lib/format";
import { EXPERIENCE_LEVELS, labelOf, REMOTE_OPTIONS } from "@/lib/ref";

export function CompanyBadge({ name, color, size = 44 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg font-display font-bold text-white"
      style={{ background: color, width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function MatchMeter({ score }: { score: number }) {
  const tone = score >= 70 ? "bg-leaf" : score >= 45 ? "bg-saffron" : "bg-muted";
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink" title="Correspondance avec votre profil">
      <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-wash" aria-hidden="true">
        <span className={`absolute inset-y-0 left-0 ${tone}`} style={{ width: `${score}%` }} />
      </span>
      {score} % de correspondance
    </span>
  );
}

export function JobCard({ job, score, saved }: { job: JobRow; score?: number; saved?: React.ReactNode }) {
  const salary = job.show_salary ? salaryRange(job.salary_min, job.salary_max, job.currency) : "";
  return (
    <article className="card relative flex gap-4 p-4 sm:p-5">
      <CompanyBadge name={job.company_name} color={job.confidential ? "#6B7394" : job.brand_color} />
      <div className="min-w-0 flex-1">
        <h3 className="text-[1.08rem] font-semibold">
          <Link href={jobPath(job.id, job.title, job.city)} className="after:absolute after:inset-0 hover:text-indigo">
            {job.title}
          </Link>
        </h3>
        <p className="mt-0.5 text-sm text-ink-soft">
          {job.company_name}, {job.city} ({job.country_name})
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="chip">{job.contract_type}</span>
          {job.experience_level && <span className="chip">{labelOf(EXPERIENCE_LEVELS, job.experience_level).split(" (")[0]}</span>}
          {job.remote !== "non" && <span className="chip">{labelOf(REMOTE_OPTIONS, job.remote)}</span>}
          {salary && <span className="chip bg-saffron-soft text-ink">{salary}</span>}
          {job.featured && <span className="chip bg-indigo text-white">À la une</span>}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {score !== undefined ? <MatchMeter score={score} /> : <span />}
          <span className="text-xs text-muted">Publiée {since(job.published_at)}</span>
        </div>
      </div>
      {saved && <div className="relative z-10 self-start">{saved}</div>}
    </article>
  );
}
