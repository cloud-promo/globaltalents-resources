import Link from "next/link";
import { requireRecruiter } from "@/lib/auth";
import { query, one } from "@/lib/db";
import { since } from "@/lib/format";
import { TICKET_CATEGORIES, TICKET_STATUS, categoryLabel } from "@/lib/partners";
import { ActionForm, Submit } from "@/components/Form";
import { openTicket } from "@/app/actions/partners";

export const metadata = { title: "Support" };

export default async function RecruiterSupport({ searchParams }: { searchParams: Promise<{ categorie?: string }> }) {
  const sp = await searchParams;
  const { company } = await requireRecruiter();
  const [tickets, jobs, manager] = await Promise.all([
    query<{ id: number; subject: string; category: string; status: string; updated_at: string }>(
      `SELECT id,subject,category,status,updated_at FROM support_tickets WHERE company_id=$1 ORDER BY updated_at DESC LIMIT 50`,
      [company.company_id],
    ),
    query<{ id: number; title: string }>(`SELECT id,title FROM jobs WHERE company_id=$1 ORDER BY created_at DESC LIMIT 30`, [company.company_id]),
    one<{ first_name: string; last_name: string; email: string; phone: string }>(
      `SELECT u.first_name,u.last_name,u.email,u.phone FROM companies c JOIN users u ON u.id=c.account_manager_id WHERE c.id=$1`,
      [company.company_id],
    ),
  ]);
  const preset = TICKET_CATEGORIES.some((c) => c.code === sp.categorie) ? sp.categorie : "";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support</h1>
        <p className="mt-1 text-ink-soft">Une question sur votre compte, un paiement, une offre ou la présélection ? Notre équipe partenaires vous répond sous 24 h ouvrées, sous 8 h pour un paiement ou un problème technique.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="card p-5">
          <h2 className="text-lg font-bold">Nouvelle demande</h2>
          <ActionForm action={openTicket} className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="label">Catégorie</span>
                <select name="category" defaultValue={preset} className="input" required>
                  <option value="" disabled>Choisir</option>
                  {TICKET_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </label>
              <label className="block"><span className="label">Offre concernée (facultatif)</span>
                <select name="job_id" className="input"><option value="">Aucune</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select>
              </label>
            </div>
            <label className="block"><span className="label">Objet</span><input name="subject" className="input" maxLength={140} required /></label>
            <label className="block"><span className="label">Votre message</span><textarea name="body" className="input min-h-32" maxLength={4000} required /></label>
            <Submit className="btn btn-primary" pendingLabel="Envoi…">Envoyer la demande</Submit>
          </ActionForm>
        </section>
        <aside className="space-y-4">
          <div className="card p-5 text-sm">
            <h2 className="font-bold">Votre chargé de compte</h2>
            {manager ? (
              <>
                <p className="mt-2 font-medium">{manager.first_name} {manager.last_name}</p>
                <a href={`mailto:${manager.email}`} className="block text-indigo">{manager.email}</a>
                {manager.phone && <a href={`tel:${manager.phone}`} className="block text-indigo">{manager.phone}</a>}
              </>
            ) : (
              <p className="mt-2 text-ink-soft">Un chargé de compte vous sera attribué à la vérification de votre entreprise. En attendant, toute l&apos;équipe partenaires reçoit vos demandes.</p>
            )}
          </div>
          <div className="card p-5 text-sm">
            <h2 className="font-bold">Demandes fréquentes</h2>
            <ul className="mt-2 space-y-1">
              <li><Link href="/recruteur/support?categorie=mise_en_avant" className="text-indigo">Mettre une offre à la une</Link></li>
              <li><Link href="/recruteur/support?categorie=paiement" className="text-indigo">Un paiement e-Wari n&apos;apparaît pas</Link></li>
              <li><Link href="/recruteur/support?categorie=compte" className="text-indigo">Accélérer la vérification</Link></li>
            </ul>
          </div>
        </aside>
      </div>
      <section>
        <h2 className="text-lg font-bold">Mes demandes</h2>
        <ul className="mt-3 space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/recruteur/support/${t.id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-indigo">
                <span className="min-w-0"><span className="block truncate font-medium">#{t.id} {t.subject}</span><span className="text-sm text-ink-soft">{categoryLabel(t.category)} · mise à jour {since(t.updated_at)}</span></span>
                <span className={`chip shrink-0 ${TICKET_STATUS[t.status].tone}`}>{TICKET_STATUS[t.status].label}</span>
              </Link>
            </li>
          ))}
          {!tickets.length && <li className="card p-5 text-sm text-ink-soft">Aucune demande pour le moment.</li>}
        </ul>
      </section>
    </div>
  );
}
