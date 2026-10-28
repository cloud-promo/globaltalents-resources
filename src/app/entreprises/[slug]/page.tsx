import { notFound } from "next/navigation";
import { one, query } from "@/lib/db";
import { JOB_FROM, JOB_SELECT, PUBLISHED, type JobRow } from "@/lib/jobs";
import { CompanyBadge, JobCard } from "@/components/JobCard";
import { getUser } from "@/lib/auth";
import { toggleCompanyRelation } from "@/app/actions/candidate";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

type Company = {
  id: string; name: string; slug: string; city: string; country: string; sector: string | null; size_band: string;
  website: string; description: string; culture: string; benefits: string; brand_color: string;
};

async function load(slug: string) {
  return one<Company>(
    `SELECT c.id,c.name,c.slug,c.city,co.name country,s.name sector,c.size_band,c.website,c.description,c.culture,c.benefits,c.brand_color
     FROM companies c JOIN countries co ON co.code=c.country_code LEFT JOIN sectors s ON s.id=c.sector_id
     WHERE c.slug=$1 AND c.status='verified'`,
    [slug],
  );
}

export async function generateMetadata({ params }: { params: Params }) {
  const c = await load((await params).slug);
  return c ? { title: `${c.name} recrute`, description: c.description.slice(0, 160) } : { title: "Entreprise introuvable" };
}

export default async function CompanyPage({ params }: { params: Params }) {
  const c = await load((await params).slug);
  if (!c) notFound();
  const jobs = await query<JobRow>(`SELECT ${JOB_SELECT} ${JOB_FROM} WHERE ${PUBLISHED} AND j.company_id=$1 AND NOT j.confidential ORDER BY j.published_at DESC`, [c.id]);
  const user = await getUser();
  const following = user?.role === "candidate" && !!(await one(`SELECT 1 FROM followed_companies WHERE user_id=$1 AND company_id=$2`, [user.id, c.id]));

  return (
    <>
      <div className="h-24" style={{ background: c.brand_color }} aria-hidden="true" />
      <div className="mx-auto max-w-6xl px-4">
        <div className="-mt-10 flex flex-wrap items-end gap-4">
          <span className="rounded-xl border-4 border-white bg-white"><CompanyBadge name={c.name} color={c.brand_color} size={72} /></span>
          <div className="flex-1 pb-1">
            <h1 className="text-3xl font-bold">{c.name}</h1>
            <p className="text-ink-soft">{[c.sector, `${c.city}, ${c.country}`, c.size_band && `${c.size_band} salariés`].filter(Boolean).join(", ")}</p>
          </div>
          {user?.role === "candidate" && (
            <form action={toggleCompanyRelation} className="pb-1">
              <input type="hidden" name="company_id" value={c.id} />
              <input type="hidden" name="kind" value="follow" />
              <button className={following ? "btn btn-ghost" : "btn btn-primary"}>{following ? "Entreprise suivie" : "Suivre l'entreprise"}</button>
            </form>
          )}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          <section aria-labelledby="offres">
            <h2 id="offres" className="mb-4 text-xl font-bold">{jobs.length} offre{jobs.length > 1 ? "s" : ""} ouverte{jobs.length > 1 ? "s" : ""}</h2>
            <div className="grid gap-3">{jobs.map((j) => <JobCard key={j.id} job={j} />)}</div>
            {!jobs.length && <p className="card p-6 text-ink-soft">Aucune offre ouverte pour le moment. Suivez l&apos;entreprise pour être prévenu de la prochaine.</p>}
          </section>
          <aside className="space-y-4">
            <div className="card p-5">
              <h2 className="font-bold">Présentation</h2>
              <p className="mt-2 text-sm text-ink-soft">{c.description}</p>
              {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-indigo hover:underline">Site de l&apos;entreprise</a>}
            </div>
            {c.culture && <div className="card p-5"><h2 className="font-bold">Culture</h2><p className="mt-2 text-sm text-ink-soft">{c.culture}</p></div>}
            {c.benefits && <div className="card p-5"><h2 className="font-bold">Avantages</h2><p className="mt-2 text-sm text-ink-soft">{c.benefits}</p></div>}
          </aside>
        </div>
      </div>
    </>
  );
}
