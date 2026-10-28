import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { PUBLISHED } from "@/lib/jobs";
import { CompanyBadge } from "@/components/JobCard";
import { toggleCompanyRelation } from "@/app/actions/candidate";

export const metadata = { title: "Entreprises suivies et masquées" };

type C = { id: string; name: string; slug: string; brand_color: string; city: string; n: number };

export default async function MyCompaniesPage() {
  const u = await requireUser(["candidate"]);
  const sql = (table: string) =>
    `SELECT c.id,c.name,c.slug,c.brand_color,c.city,(SELECT count(*)::int FROM jobs j WHERE j.company_id=c.id AND ${PUBLISHED}) n
     FROM ${table} t JOIN companies c ON c.id=t.company_id WHERE t.user_id=$1 ORDER BY c.name`;
  const [followed, hidden] = await Promise.all([query<C>(sql("followed_companies"), [u.id]), query<C>(sql("hidden_companies"), [u.id])]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Entreprises suivies et masquées</h1>
      <section className="card p-5">
        <h2 className="font-semibold">Entreprises suivies</h2>
        <p className="mt-1 text-sm text-ink-soft">Chaque semaine, un récapitulatif des nouvelles offres de ces entreprises.</p>
        <List items={followed} kind="follow" action="Ne plus suivre" empty="Vous ne suivez aucune entreprise. Suivez-en une depuis sa page ou l'une de ses offres." />
        <Link href="/entreprises" className="btn btn-ghost btn-sm mt-4">Découvrir les entreprises</Link>
      </section>
      <section className="card p-5">
        <h2 className="font-semibold">Entreprises masquées</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Leurs offres n&apos;apparaissent plus dans vos résultats ni dans vos alertes. Elles restent accessibles si vous recherchez leur nom.
        </p>
        <List items={hidden} kind="hide" action="Ne plus masquer" empty="Aucune entreprise masquée." />
      </section>
    </div>
  );
}

function List({ items, kind, action, empty }: { items: C[]; kind: string; action: string; empty: string }) {
  if (!items.length) return <p className="mt-4 text-sm text-ink-soft">{empty}</p>;
  return (
    <ul className="mt-4 divide-y divide-line">
      {items.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 py-3">
          <Link href={`/entreprises/${c.slug}`} className="flex items-center gap-3 hover:text-indigo">
            <CompanyBadge name={c.name} color={c.brand_color} size={36} />
            <span>
              <span className="block font-medium">{c.name}</span>
              <span className="text-sm text-ink-soft">{c.n} offre{c.n > 1 ? "s" : ""} ouverte{c.n > 1 ? "s" : ""}</span>
            </span>
          </Link>
          <form action={toggleCompanyRelation}>
            <input type="hidden" name="company_id" value={c.id} />
            <input type="hidden" name="kind" value={kind} />
            <button className="btn btn-ghost btn-sm">{action}</button>
          </form>
        </li>
      ))}
    </ul>
  );
}
