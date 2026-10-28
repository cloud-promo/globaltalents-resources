import { requireRecruiter } from "@/lib/auth";
import { one } from "@/lib/db";
import { getRefs } from "@/lib/refdata";
import { JobForm } from "@/components/JobForm";

export const metadata = { title: "Publier une offre" };

export default async function NewJobPage() {
  const { company } = await requireRecruiter();
  const [refs, c] = await Promise.all([
    getRefs(),
    one<{ job_credits: number; country_code: string; city: string; sector_id: number | null; benefits: string }>(
      `SELECT job_credits,country_code,city,sector_id,benefits FROM companies WHERE id=$1`,
      [company.company_id],
    ),
  ]);
  return (
    <div>
      <h1 className="text-2xl font-bold">Publier une offre</h1>
      <p className="mb-6 mt-1 text-ink-soft">Notre équipe vérifie chaque offre avant sa mise en ligne, en général sous 24 h ouvrées.</p>
      <JobForm v={{ country_code: c?.country_code, city: c?.city, sector_id: c?.sector_id, benefits: c?.benefits }} refs={refs} credits={c?.job_credits ?? 0} />
    </div>
  );
}
