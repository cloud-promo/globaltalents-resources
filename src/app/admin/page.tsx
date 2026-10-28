import Link from "next/link";
import { one, query } from "@/lib/db";
import { money } from "@/lib/format";

export const metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [s, byCountry] = await Promise.all([
    one<Record<string, number>>(
      `SELECT
        (SELECT count(*)::int FROM users WHERE role='candidate') candidates,
        (SELECT count(*)::int FROM users WHERE role='candidate' AND created_at>now()-interval '30 days') candidates30,
        (SELECT count(*)::int FROM companies WHERE status='verified') companies,
        (SELECT count(*)::int FROM companies WHERE status='pending') companies_pending,
        (SELECT count(*)::int FROM jobs WHERE status='published' AND expires_at>now()) jobs,
        (SELECT count(*)::int FROM jobs WHERE status='pending') jobs_pending,
        (SELECT count(*)::int FROM applications) apps,
        (SELECT count(*)::int FROM applications WHERE created_at>now()-interval '30 days') apps30,
        (SELECT count(*)::int FROM job_reports WHERE NOT resolved) reports,
        (SELECT coalesce(sum(amount),0)::int FROM payments WHERE status='paid' AND paid_at>now()-interval '30 days') revenue30,
        (SELECT coalesce(sum(amount),0)::int FROM payments WHERE status='paid') revenue,
        (SELECT count(*)::int FROM candidate_profiles WHERE visible_cvtheque) visible`,
    ),
    query<{ name: string; jobs: number; candidates: number; companies: number }>(
      `SELECT co.name,
         (SELECT count(*)::int FROM jobs j WHERE j.country_code=co.code AND j.status='published' AND j.expires_at>now()) jobs,
         (SELECT count(*)::int FROM users u WHERE u.country_code=co.code AND u.role='candidate') candidates,
         (SELECT count(*)::int FROM companies c WHERE c.country_code=co.code AND c.status='verified') companies
       FROM countries co ORDER BY co.sort`,
    ),
  ]);
  const todo = [
    { n: s?.companies_pending ?? 0, label: "entreprise(s) à vérifier", href: "/admin/entreprises?statut=pending" },
    { n: s?.jobs_pending ?? 0, label: "offre(s) à modérer", href: "/admin/offres" },
    { n: s?.reports ?? 0, label: "signalement(s) à traiter", href: "/admin/offres#signalements" },
  ].filter((t) => t.n > 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Vue d&apos;ensemble</h1>
      {todo.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {todo.map((t) => (
            <li key={t.href}><Link href={t.href} className="btn bg-saffron-soft text-ink hover:bg-saffron">{t.n} {t.label}</Link></li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft">Rien à modérer pour le moment.</p>
      )}
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Candidats inscrits", s?.candidates, `${s?.candidates30 ?? 0} sur 30 jours`],
          ["Profils visibles en CVthèque", s?.visible, ""],
          ["Entreprises vérifiées", s?.companies, `${s?.companies_pending ?? 0} en attente`],
          ["Offres en ligne", s?.jobs, `${s?.jobs_pending ?? 0} en modération`],
          ["Candidatures", s?.apps, `${s?.apps30 ?? 0} sur 30 jours`],
          ["Encaissé sur 30 jours", money(s?.revenue30 ?? 0), ""],
          ["Encaissé au total", money(s?.revenue ?? 0), ""],
        ].map(([k, v, sub]) => (
          <div key={String(k)} className="card p-4">
            <dt className="text-sm text-ink-soft">{k}</dt>
            <dd className="mt-1 font-display text-xl font-bold">{v ?? 0}</dd>
            {sub && <dd className="text-xs text-muted">{sub}</dd>}
          </div>
        ))}
      </dl>
      <section className="card overflow-x-auto">
        <h2 className="p-4 pb-0 text-lg font-bold">Par pays</h2>
        <table className="mt-2 w-full text-sm">
          <thead className="border-b border-line text-left text-ink-soft"><tr><th className="p-3">Pays</th><th className="p-3">Offres en ligne</th><th className="p-3">Candidats</th><th className="p-3">Entreprises</th></tr></thead>
          <tbody className="divide-y divide-line">
            {byCountry.map((c) => (
              <tr key={c.name}><td className="p-3 font-medium">{c.name}</td><td className="p-3">{c.jobs}</td><td className="p-3">{c.candidates}</td><td className="p-3">{c.companies}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
