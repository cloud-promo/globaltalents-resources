import Link from "next/link";
import { requirePartnerStaff } from "@/lib/auth";
import { query, one } from "@/lib/db";
import { since, money, date } from "@/lib/format";
import { TICKET_STATUS, staffStatus, SLA_HOURS, categoryLabel } from "@/lib/partners";

export const metadata = { title: "Gestion des partenaires" };
export const dynamic = "force-dynamic";

export default async function PartnersHome() {
  const u = await requirePartnerStaff();
  const [k, pending, tickets, expiring] = await Promise.all([
    one<{ pending: number; mine: number; open: number; late: number; featured: number; revenue: number; csat: number | null; verified30: number }>(
      `SELECT
         (SELECT count(*)::int FROM companies WHERE status='pending') pending,
         (SELECT count(*)::int FROM companies WHERE account_manager_id=$1) mine,
         (SELECT count(*)::int FROM support_tickets WHERE status IN ('ouvert','en_cours')) open,
         (SELECT count(*)::int FROM support_tickets t WHERE status='ouvert'
            AND t.created_at < now() - make_interval(hours => CASE t.priority WHEN 'urgente' THEN 4 WHEN 'haute' THEN 8 WHEN 'normale' THEN 24 ELSE 48 END)) late,
         (SELECT count(*)::int FROM jobs WHERE featured AND (featured_until IS NULL OR featured_until>now()))
           + (SELECT count(*)::int FROM companies WHERE featured AND (featured_until IS NULL OR featured_until>now())) featured,
         (SELECT coalesce(sum(amount),0)::int FROM payments WHERE status='paid' AND paid_at > now() - interval '30 days') revenue,
         (SELECT round(avg(satisfaction)::numeric,1)::float FROM support_tickets WHERE satisfaction IS NOT NULL) csat,
         (SELECT count(*)::int FROM companies WHERE verified_at > now() - interval '30 days') verified30`,
      [u.id],
    ),
    query<{ id: string; name: string; city: string; country: string; created_at: string; owner_email: string | null }>(
      `SELECT c.id,c.name,c.city,co.name country,c.created_at,
         (SELECT us.email FROM company_members m JOIN users us ON us.id=m.user_id WHERE m.company_id=c.id ORDER BY (m.role='admin') DESC LIMIT 1) owner_email
       FROM companies c JOIN countries co ON co.code=c.country_code WHERE c.status='pending' ORDER BY c.created_at LIMIT 5`,
    ),
    query<{ id: number; subject: string; category: string; status: string; priority: string; company: string; updated_at: string; created_at: string }>(
      `SELECT t.id,t.subject,t.category,t.status,t.priority,c.name company,t.updated_at,t.created_at
       FROM support_tickets t JOIN companies c ON c.id=t.company_id
       WHERE t.status IN ('ouvert','en_cours') AND (t.assigned_to=$1 OR t.assigned_to IS NULL)
       ORDER BY CASE t.priority WHEN 'urgente' THEN 0 WHEN 'haute' THEN 1 WHEN 'normale' THEN 2 ELSE 3 END, t.created_at LIMIT 8`,
      [u.id],
    ),
    query<{ id: string; name: string; plan_expires_at: string; plan: string }>(
      `SELECT c.id,c.name,c.plan_expires_at,p.name plan FROM companies c JOIN plans p ON p.code=c.plan_code
       WHERE c.plan_expires_at BETWEEN now() AND now() + interval '15 days' ORDER BY c.plan_expires_at LIMIT 6`,
    ),
  ]);

  const tiles: [string, string | number, string, string][] = [
    ["Inscriptions à vérifier", k?.pending ?? 0, "objectif : sous 24 h ouvrées", "/partenaires/inscriptions"],
    ["Demandes ouvertes", k?.open ?? 0, `${k?.late ?? 0} hors délai`, "/partenaires/support"],
    ["Mises en avant actives", k?.featured ?? 0, "offres et entreprises", "/partenaires/mises-en-avant"],
    ["Encaissé sur 30 jours", money(k?.revenue ?? 0), `satisfaction support : ${k?.csat ?? "–"} / 5`, "/partenaires/entreprises"],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Bonjour {u.first_name}</h1>
        <p className="mt-1 text-ink-soft">
          {k?.mine ?? 0} entreprise{(k?.mine ?? 0) > 1 ? "s" : ""} dans votre portefeuille. {k?.verified30 ?? 0} entreprise{(k?.verified30 ?? 0) > 1 ? "s" : ""} vérifiée{(k?.verified30 ?? 0) > 1 ? "s" : ""} ces 30 derniers jours.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, value, sub, href]) => (
          <Link key={label} href={href} className="card p-4 hover:border-indigo">
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className="mt-1 font-display text-2xl font-bold">{value}</dd>
            <p className="mt-1 text-xs text-muted">{sub}</p>
          </Link>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Inscriptions en attente</h2>
            <Link href="/partenaires/inscriptions" className="text-sm font-semibold text-indigo">Tout voir</Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {pending.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-sm text-ink-soft">{c.city}, {c.country} · {c.owner_email} · {since(c.created_at)}</p>
                </div>
                <Link href={`/partenaires/entreprises/${c.id}`} className="btn btn-primary btn-sm shrink-0">Vérifier</Link>
              </li>
            ))}
            {!pending.length && <li className="py-3 text-sm text-ink-soft">Aucune inscription en attente.</li>}
          </ul>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Mes demandes à traiter</h2>
            <Link href="/partenaires/support" className="text-sm font-semibold text-indigo">Tout voir</Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {tickets.map((t) => {
              const late = t.status === "ouvert" && Date.now() - new Date(t.created_at).getTime() > SLA_HOURS[t.priority] * 3600_000;
              return (
                <li key={t.id} className="py-3">
                  <Link href={`/partenaires/support/${t.id}`} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">#{t.id} {t.subject}</span>
                      <span className="text-sm text-ink-soft">{t.company} · {categoryLabel(t.category)} · {since(t.updated_at)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`chip ${staffStatus(t.status).tone}`}>{staffStatus(t.status).label}</span>
                      {late && <span className="chip bg-clay-soft text-clay">Hors délai</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
            {!tickets.length && <li className="py-3 text-sm text-ink-soft">Aucune demande en cours.</li>}
          </ul>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="text-lg font-bold">Renouvellements à venir (15 jours)</h2>
        <p className="text-sm text-ink-soft">Contactez ces clients avant la fin de leur formule.</p>
        <ul className="mt-3 divide-y divide-line">
          {expiring.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <Link href={`/partenaires/entreprises/${c.id}`} className="font-medium hover:text-indigo">{c.name}</Link>
              <span className="text-ink-soft">{c.plan}, fin le {date(c.plan_expires_at)}</span>
            </li>
          ))}
          {!expiring.length && <li className="py-3 text-sm text-ink-soft">Aucun renouvellement dans les 15 prochains jours.</li>}
        </ul>
      </section>
    </div>
  );
}
