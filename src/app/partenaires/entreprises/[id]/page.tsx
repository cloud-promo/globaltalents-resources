import Link from "next/link";
import { notFound } from "next/navigation";
import { one, query } from "@/lib/db";
import { date, money, shortDate, since } from "@/lib/format";
import { COMPANY_STATUS_LABELS, JOB_STATUS_LABELS } from "@/lib/ref";
import { VERIFICATION_CHECKS, NOTE_KINDS, TICKET_STATUS, staffStatus, FEATURE_DURATIONS, categoryLabel } from "@/lib/partners";
import { ActionForm, Submit } from "@/components/Form";
import { decideSave, decideVerify, decideReject, decideSuspend, decideRestore, assignManager, addCompanyNote, grantGesture, setFeatured } from "@/app/actions/partners";

export const metadata = { title: "Dossier entreprise" };
export const dynamic = "force-dynamic";

type Company = {
  id: string; name: string; slug: string; city: string; country: string; sector: string | null; size_band: string; registration_number: string;
  website: string; description: string; status: string; verification: { checks?: Record<string, boolean>; comment?: string; at?: string; by?: string };
  verified_at: string | null; reject_reason: string; plan: string | null; plan_expires_at: string | null; job_credits: number; cv_credits: number;
  account_manager_id: string | null; featured_active: boolean; featured_until: string | null; created_at: string;
};

export default async function CompanyFile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await one<Company>(
    `SELECT c.id,c.name,c.slug,c.city,co.name country,s.name sector,c.size_band,c.registration_number,c.website,c.description,c.status,c.verification,
       c.verified_at,c.reject_reason,p.name plan,c.plan_expires_at,c.job_credits,c.cv_credits,c.account_manager_id,c.created_at,c.featured_until,
       (c.featured AND (c.featured_until IS NULL OR c.featured_until>now())) featured_active
     FROM companies c JOIN countries co ON co.code=c.country_code LEFT JOIN sectors s ON s.id=c.sector_id LEFT JOIN plans p ON p.code=c.plan_code WHERE c.id=$1`,
    [id],
  );
  if (!c) notFound();
  const [members, jobs, payments, notes, tickets, staff] = await Promise.all([
    query<{ id: string; name: string; email: string; phone: string; role: string; last_login_at: string | null }>(
      `SELECT u.id,u.first_name||' '||u.last_name name,u.email,u.phone,m.role,u.last_login_at FROM company_members m JOIN users u ON u.id=m.user_id WHERE m.company_id=$1 ORDER BY (m.role='admin') DESC`,
      [id],
    ),
    query<{ id: number; title: string; status: string; city: string; apps: number; featured: boolean; featured_until: string | null; expires_at: string | null }>(
      `SELECT j.id,j.title,j.status,j.city,j.expires_at,j.featured_until,(j.featured AND (j.featured_until IS NULL OR j.featured_until>now())) featured,
         (SELECT count(*)::int FROM applications a WHERE a.job_id=j.id) apps
       FROM jobs j WHERE j.company_id=$1 ORDER BY j.created_at DESC LIMIT 20`,
      [id],
    ),
    query<{ id: string; plan: string; amount: number; currency: string; status: string; provider: string; created_at: string; invoice_number: string | null }>(
      `SELECT pa.id,p.name plan,pa.amount,pa.currency,pa.status,pa.provider,pa.created_at,pa.invoice_number FROM payments pa JOIN plans p ON p.code=pa.plan_code WHERE pa.company_id=$1 ORDER BY pa.created_at DESC LIMIT 10`,
      [id],
    ),
    query<{ id: number; kind: string; body: string; created_at: string; author: string | null }>(
      `SELECT n.id,n.kind,n.body,n.created_at,u.first_name||' '||u.last_name author FROM company_notes n LEFT JOIN users u ON u.id=n.author_id WHERE n.company_id=$1 ORDER BY n.created_at DESC LIMIT 30`,
      [id],
    ),
    query<{ id: number; subject: string; category: string; status: string; updated_at: string; satisfaction: number | null }>(
      `SELECT id,subject,category,status,updated_at,satisfaction FROM support_tickets WHERE company_id=$1 ORDER BY updated_at DESC LIMIT 10`,
      [id],
    ),
    query<{ id: string; name: string }>(`SELECT id,first_name||' '||last_name name FROM users WHERE role IN ('partner_manager','admin') AND NOT suspended ORDER BY first_name`),
  ]);
  const checks = c.verification?.checks ?? {};
  const done = VERIFICATION_CHECKS.filter((k) => checks[k.code]).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/partenaires/entreprises" className="text-sm text-ink-soft hover:text-indigo">Portefeuille</Link>
          <h1 className="text-2xl font-bold">{c.name}</h1>
          <p className="mt-1 text-ink-soft">
            {c.sector ?? "Secteur non renseigné"} · {c.size_band || "taille non renseignée"} · {c.city}, {c.country} · inscrite le {date(c.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${c.status === "verified" ? "bg-leaf-soft text-leaf" : c.status === "pending" ? "bg-saffron-soft text-ochre" : "bg-clay-soft text-clay"}`}>{COMPANY_STATUS_LABELS[c.status]}</span>
          {c.featured_active && <span className="chip bg-indigo text-white">Mise en avant jusqu&apos;au {shortDate(c.featured_until)}</span>}
          {c.status === "verified" && <Link href={`/entreprises/${c.slug}`} className="btn btn-ghost btn-sm">Page publique</Link>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <section className="card p-5" aria-labelledby="verif">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="verif" className="text-lg font-bold">Vérification du compte</h2>
              <span className="text-sm text-ink-soft">{done} / {VERIFICATION_CHECKS.length} contrôles{c.verified_at && `, vérifiée le ${date(c.verified_at)}`}</span>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div><dt className="inline text-ink-soft">RCCM : </dt><dd className="inline font-medium">{c.registration_number || "non renseigné"}</dd></div>
              <div><dt className="inline text-ink-soft">Site : </dt><dd className="inline font-medium">{c.website ? <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer nofollow" className="text-indigo underline">{c.website}</a> : "aucun"}</dd></div>
            </dl>
            <form action={decideSave} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={c.id} />
              <fieldset className="space-y-2">
                <legend className="sr-only">Contrôles</legend>
                {VERIFICATION_CHECKS.map((k) => (
                  <label key={k.code} className="flex gap-3 rounded-lg border border-line p-3 text-sm hover:bg-wash/50">
                    <input type="checkbox" name="checks" value={k.code} defaultChecked={!!checks[k.code]} className="mt-0.5" />
                    <span><span className="font-medium">{k.label}</span><span className="block text-ink-soft">{k.hint}</span></span>
                  </label>
                ))}
              </fieldset>
              <label className="block">
                <span className="label">Commentaire interne</span>
                <textarea name="comment" defaultValue={c.verification?.comment} className="input min-h-16" maxLength={1000} />
              </label>
              <label className="block">
                <span className="label">Motif communiqué au client (refus ou suspension)</span>
                <input name="reason" className="input" maxLength={300} defaultValue={c.reject_reason} placeholder="ex. Numéro RCCM introuvable au registre" />
              </label>
              {c.status === "pending" && <p className="text-xs text-ink-soft">Les {VERIFICATION_CHECKS.length} contrôles doivent être cochés pour valider l&apos;entreprise.</p>}
              <div className="flex flex-wrap gap-2">
                <button formAction={decideSave} className="btn btn-ghost">Enregistrer les contrôles</button>
                {c.status !== "verified" && c.status !== "suspended" && <button formAction={decideVerify} className="btn btn-primary">Valider l&apos;entreprise</button>}
                {c.status === "pending" && <button formAction={decideReject} className="btn btn-danger">Refuser</button>}
                {c.status === "verified" && <button formAction={decideSuspend} className="btn btn-danger">Suspendre</button>}
                {c.status === "suspended" && <button formAction={decideRestore} className="btn btn-ghost">Réactiver</button>}
              </div>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-bold">Offres</h2>
            <ul className="mt-3 divide-y divide-line">
              {jobs.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{j.title}</span>
                    <span className="text-ink-soft">{JOB_STATUS_LABELS[j.status] ?? j.status} · {j.city} · {j.apps} candidature(s){j.featured && ` · à la une jusqu'au ${shortDate(j.featured_until)}`}</span>
                  </span>
                  {j.status === "published" && (
                    <form action={setFeatured} className="flex items-center gap-1">
                      <input type="hidden" name="target" value="job" />
                      <input type="hidden" name="id" value={j.id} />
                      <select name="days" className="input w-auto py-1 text-sm" aria-label={`Durée de mise à la une pour ${j.title}`} defaultValue="7">
                        {FEATURE_DURATIONS.map((d) => <option key={d} value={d}>{d} jours</option>)}
                        {j.featured && <option value="0">Retirer</option>}
                      </select>
                      <button className="btn btn-ghost btn-sm">{j.featured ? "Modifier" : "À la une"}</button>
                    </form>
                  )}
                </li>
              ))}
              {!jobs.length && <li className="py-3 text-sm text-ink-soft">Aucune offre.</li>}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-bold">Historique du compte</h2>
            <ActionForm action={addCompanyNote} resetOnSuccess className="mt-3 space-y-2">
              <input type="hidden" name="id" value={c.id} />
              <div className="flex flex-wrap gap-2">
                <select name="kind" className="input w-auto" aria-label="Type">
                  {Object.entries(NOTE_KINDS).filter(([k]) => k !== "geste").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input name="body" className="input min-w-0 flex-1" maxLength={2000} placeholder="Compte rendu d'appel, besoin exprimé, relance…" aria-label="Note" />
                <Submit className="btn btn-primary">Ajouter</Submit>
              </div>
            </ActionForm>
            <ol className="mt-4 space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="border-l-2 border-indigo/30 pl-3 text-sm">
                  <p className="text-xs text-muted">{NOTE_KINDS[n.kind]} · {n.author ?? "équipe"} · {since(n.created_at)}</p>
                  <p>{n.body}</p>
                </li>
              ))}
              {!notes.length && <li className="text-sm text-ink-soft">Aucune note pour le moment.</li>}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="text-lg font-bold">Chargé de compte</h2>
            <form action={assignManager} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={c.id} />
              <select key={c.account_manager_id ?? "aucun"} name="manager_id" defaultValue={c.account_manager_id ?? ""} className="input" aria-label="Chargé de compte">
                <option value="">Non attribué</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button className="btn btn-ghost">Attribuer</button>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-bold">Contacts</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {members.map((m) => (
                <li key={m.id}>
                  <span className="font-medium">{m.name}</span> <span className="text-ink-soft">({m.role === "admin" ? "administrateur" : m.role === "manager" ? "manager" : "recruteur"})</span>
                  <span className="block text-ink-soft"><a href={`mailto:${m.email}`} className="hover:text-indigo">{m.email}</a>{m.phone && <> · <a href={`tel:${m.phone}`} className="hover:text-indigo">{m.phone}</a></>} · connexion {m.last_login_at ? since(m.last_login_at) : "jamais"}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-bold">Formule et crédits</h2>
            <p className="mt-2 text-sm">{c.plan ?? "Sans formule"}{c.plan_expires_at && `, jusqu'au ${date(c.plan_expires_at)}`}</p>
            <p className="text-sm text-ink-soft">{c.job_credits} crédit(s) d&apos;annonce · {c.cv_credits} profil(s) CVthèque</p>
            <h3 className="mt-4 font-semibold">Geste commercial</h3>
            <ActionForm action={grantGesture} resetOnSuccess className="mt-2 space-y-2">
              <input type="hidden" name="id" value={c.id} />
              <div className="grid grid-cols-2 gap-2">
                <label><span className="label">Annonces</span><input name="jobs" type="number" min={0} max={20} defaultValue={0} className="input" /></label>
                <label><span className="label">Profils CVthèque</span><input name="cvs" type="number" min={0} max={200} defaultValue={0} className="input" /></label>
              </div>
              <input name="gesture_reason" className="input" maxLength={300} placeholder="Motif (ex. offre bloquée 3 jours par un incident)" aria-label="Motif" />
              <Submit className="btn btn-ghost w-full">Offrir ces crédits</Submit>
            </ActionForm>
            <h3 className="mt-4 font-semibold">Mise en avant de l&apos;entreprise</h3>
            <form action={setFeatured} className="mt-2 flex gap-2">
              <input type="hidden" name="target" value="company" />
              <input type="hidden" name="id" value={c.id} />
              <select name="days" className="input" aria-label="Durée de mise en avant" defaultValue="30">
                {FEATURE_DURATIONS.map((d) => <option key={d} value={d}>{c.featured_active ? `Prolonger de ${d} jours` : `${d} jours`}</option>)}
                {c.featured_active && <option value="0">Retirer la mise en avant</option>}
              </select>
              <button className="btn btn-ghost" disabled={c.status !== "verified"}>Appliquer</button>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-bold">Paiements</h2>
            <ul className="mt-2 divide-y divide-line text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-2 py-2">
                  <span>{p.plan}<span className="block text-xs text-ink-soft">{shortDate(p.created_at)} · {p.provider === "ewari" ? "e-Wari" : "démonstration"}{p.invoice_number && ` · ${p.invoice_number}`}</span></span>
                  <span className="text-right">{money(p.amount, p.currency)}<span className="block text-xs text-ink-soft">{p.status === "paid" ? "payé" : p.status === "pending" ? "en attente" : p.status === "failed" ? "échoué" : p.status === "expired" ? "expiré" : "annulé"}</span></span>
                </li>
              ))}
              {!payments.length && <li className="py-2 text-ink-soft">Aucun paiement.</li>}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-bold">Demandes de support</h2>
            <ul className="mt-2 divide-y divide-line text-sm">
              {tickets.map((t) => (
                <li key={t.id} className="py-2">
                  <Link href={`/partenaires/support/${t.id}`} className="flex justify-between gap-2 hover:text-indigo">
                    <span className="min-w-0"><span className="block truncate font-medium">#{t.id} {t.subject}</span><span className="text-xs text-ink-soft">{categoryLabel(t.category)} · {since(t.updated_at)}{t.satisfaction && ` · ${t.satisfaction}/5`}</span></span>
                    <span className={`chip h-fit shrink-0 ${staffStatus(t.status).tone}`}>{staffStatus(t.status).label}</span>
                  </Link>
                </li>
              ))}
              {!tickets.length && <li className="py-2 text-ink-soft">Aucune demande.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
