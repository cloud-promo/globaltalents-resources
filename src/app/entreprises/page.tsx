import Link from "next/link";
import { query } from "@/lib/db";
import { PUBLISHED } from "@/lib/jobs";
import { getRefs } from "@/lib/refdata";
import { CompanyBadge } from "@/components/JobCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entreprises qui recrutent" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ pays?: string; secteur?: string }> }) {
  const sp = await searchParams;
  const { countries, sectors } = await getRefs();
  const params: unknown[] = [];
  const where = ["c.status='verified'"];
  if (sp.pays) { params.push(sp.pays); where.push(`c.country_code=$${params.length}`); }
  if (sp.secteur) { params.push(Number(sp.secteur) || 0); where.push(`c.sector_id=$${params.length}`); }
  const companies = await query<{ name: string; slug: string; brand_color: string; city: string; country: string; sector: string | null; n: number; description: string }>(
    `SELECT c.name,c.slug,c.brand_color,c.city,co.name country,s.name sector,c.description,
       (SELECT count(*)::int FROM jobs j WHERE j.company_id=c.id AND ${PUBLISHED}) n
     FROM companies c JOIN countries co ON co.code=c.country_code LEFT JOIN sectors s ON s.id=c.sector_id
     WHERE ${where.join(" AND ")} ORDER BY n DESC, c.name`,
    params,
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">Entreprises qui recrutent</h1>
      <p className="mt-1 text-ink-soft">Toutes les entreprises affichées ont été vérifiées par notre équipe.</p>
      <form className="mt-6 flex flex-wrap gap-2" action="/entreprises">
        <select name="pays" defaultValue={sp.pays ?? ""} className="input w-auto">
          <option value="">Tous les pays</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select name="secteur" defaultValue={sp.secteur ?? ""} className="input w-auto">
          <option value="">Tous les secteurs</option>
          {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn btn-ghost">Filtrer</button>
      </form>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <Link key={c.slug} href={`/entreprises/${c.slug}`} className="card flex flex-col gap-3 p-5 hover:border-indigo">
            <span className="flex items-center gap-3">
              <CompanyBadge name={c.name} color={c.brand_color} />
              <span>
                <span className="block font-semibold">{c.name}</span>
                <span className="block text-sm text-ink-soft">{c.city}, {c.country}</span>
              </span>
            </span>
            <span className="line-clamp-2 text-sm text-ink-soft">{c.description}</span>
            <span className="mt-auto flex items-center justify-between text-sm">
              <span className="text-muted">{c.sector}</span>
              <span className="font-semibold text-indigo">{c.n} offre{c.n > 1 ? "s" : ""}</span>
            </span>
          </Link>
        ))}
      </div>
      {!companies.length && <p className="card mt-6 p-6 text-ink-soft">Aucune entreprise pour ces critères.</p>}
    </div>
  );
}
