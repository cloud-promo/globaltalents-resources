import { notFound } from "next/navigation";
import { requireRecruiter } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getRefs } from "@/lib/refdata";
import { JobForm, type JobFormValues } from "@/components/JobForm";

export const metadata = { title: "Modifier l'offre" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await requireRecruiter();
  const job = await one<JobFormValues>(`SELECT * FROM jobs WHERE id=$1 AND company_id=$2`, [Number(id) || 0, company.company_id]);
  if (!job) notFound();
  const [refs, questions, c] = await Promise.all([
    getRefs(),
    query<{ question: string; eliminatory: boolean; expected: string }>(`SELECT question,eliminatory,expected FROM job_questions WHERE job_id=$1 ORDER BY sort,id`, [job.id]),
    one<{ job_credits: number }>(`SELECT job_credits FROM companies WHERE id=$1`, [company.company_id]),
  ]);
  return (
    <div>
      <h1 className="text-2xl font-bold">Modifier l&apos;offre</h1>
      <p className="mb-6 mt-1 text-ink-soft">
        {job.status === "published" ? "Une offre publiée qui est modifiée repasse en modération avant sa remise en ligne." : "Complétez l'offre puis envoyez-la en modération."}
      </p>
      <JobForm v={{ ...job, questions }} refs={refs} credits={c?.job_credits ?? 0} />
    </div>
  );
}
