import Link from "next/link";
import { requireRecruiter } from "@/lib/auth";
import { query } from "@/lib/db";
import { JOB_STATUS_LABELS } from "@/lib/ref";
import { shortDate, jobPath } from "@/lib/format";
import { jobAction } from "@/app/actions/recruiter";

export const metadata = { title: "Mes offres" };

const TONE: Record<string, string> = {
  published: "bg-leaf-soft text-leaf",
  pending: "bg-saffron-soft text-ochre",
  rejected: "bg-clay-soft text-clay",
  draft: "",
  archived: "",
  expired: "",
};

export default async function RecruiterJobs({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { company } = await requireRecruiter();
  const jobs = await query<{ id: number; title: string; city: string; status: string; reject_reason: string; published_at: string | null; expires_at: string; views: number; n: number; fresh: number; created_at: string }>(
    `SELECT j.id,j.title,j.city,CASE WHEN j.status='published' AND j.expires_at<now() THEN 'expired' ELSE j.status END status,j.reject_reason,
       j.published_at,j.expires_at,j.views,j.created_at,
       (SELECT count(*)::int FROM applications a WHERE a.job_id=j.id) n,
       (SELECT count(*)::int FROM applications a WHERE a.job_id=j.id AND a.stage='nouvelle') fresh
     FROM jobs j WHERE j.company_id=$1 ORDER BY j.created_at DESC`,
    [company.company_id],
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mes offres</h1>
          <p className="mt-1 text-ink-soft">{jobs.length} offre{jobs.length > 1 ? "s" : ""}, tous statuts confondus.</p>
        </div>
        <Link href="/recruteur/offres/nouvelle" className="btn btn-primary">Publier une offre</Link>
      </div>
      {sp.soumise && <Banner>Offre envoyée en modération. Elle sera publiée après vérification, en général sous 24 h ouvrées.</Banner>}
      {sp.brouillon && <Banner>Brouillon enregistré.</Banner>}
      {sp.maj && <Banner>Offre mise à jour. Si elle était publiée, elle repasse en modération.</Banner>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line text-left text-ink-soft">
            <tr>
              <th className="p-3 font-semibold">Offre</th>
              <th className="p-3 font-semibold">Statut</th>
              <th className="p-3 font-semibold">Candidatures</th>
              <th className="p-3 font-semibold">Vues</th>
              <th className="p-3 font-semibold">Expiration</th>
              <th className="p-3 font-semibold"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {jobs.map((j) => (
              <tr key={j.id} className="align-top">
                <td className="p-3">
                  <Link href={`/recruteur/offres/${j.id}`} className="font-semibold text-ink hover:text-indigo">{j.title}</Link>
                  <span className="block text-ink-soft">{j.city}, créée le {shortDate(j.created_at)}</span>
                  {j.status === "rejected" && j.reject_reason && <span className="mt-1 block text-clay">Motif : {j.reject_reason}</span>}
                </td>
                <td className="p-3"><span className={`chip ${TONE[j.status] ?? ""}`}>{JOB_STATUS_LABELS[j.status] ?? j.status}</span></td>
                <td className="p-3">
                  <strong>{j.n}</strong>
                  {j.fresh > 0 && <span className="chip ml-2 bg-saffron-soft text-ochre">{j.fresh} à trier</span>}
                </td>
                <td className="p-3">{j.views}</td>
                <td className="p-3">{j.status === "published" ? shortDate(j.expires_at) : ""}</td>
                <td className="p-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Link href={`/recruteur/offres/${j.id}/modifier`} className="btn btn-ghost btn-sm">Modifier</Link>
                    {j.status === "published" && <Link href={jobPath(j.id, j.title, j.city)} className="btn btn-ghost btn-sm">Voir</Link>}
                    {j.status === "published" && <Op id={j.id} op="extend" label="Prolonger 4 sem." />}
                    <Op id={j.id} op="duplicate" label="Dupliquer" />
                    {["published", "pending", "expired"].includes(j.status) && <Op id={j.id} op="close" label="Clôturer" danger />}
                  </div>
                </td>
              </tr>
            ))}
            {!jobs.length && (
              <tr><td colSpan={6} className="p-6 text-center text-ink-soft">Aucune offre. Publiez la première, elle est offerte.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-[#bfe0cf] bg-leaf-soft p-3 text-sm text-leaf">{children}</p>;
}

function Op({ id, op, label, danger }: { id: number; op: string; label: string; danger?: boolean }) {
  return (
    <form action={jobAction}>
      <input type="hidden" name="job_id" value={id} />
      <input type="hidden" name="op" value={op} />
      <button className={`btn btn-sm ${danger ? "btn-danger" : "btn-ghost"}`}>{label}</button>
    </form>
  );
}
