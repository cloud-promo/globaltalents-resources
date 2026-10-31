import Link from "next/link";
import { notFound } from "next/navigation";
import { one, query } from "@/lib/db";
import { date, since } from "@/lib/format";
import { TICKET_STATUS, TICKET_PRIORITY, staffStatus, categoryLabel } from "@/lib/partners";
import { ActionForm, Submit } from "@/components/Form";
import { staffReply, updateTicket } from "@/app/actions/partners";

export const metadata = { title: "Demande de support" };
export const dynamic = "force-dynamic";

export default async function StaffTicket({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id) || 0;
  const t = await one<{ id: number; subject: string; category: string; status: string; priority: string; company: string; company_id: string; created_at: string; assigned_to: string | null; job_title: string | null; job_id: number | null; satisfaction: number | null; opener: string | null; opener_email: string | null; opener_phone: string | null }>(
    `SELECT t.id,t.subject,t.category,t.status,t.priority,c.name company,c.id company_id,t.created_at,t.assigned_to,t.satisfaction,t.job_id,j.title job_title,
       u.first_name||' '||u.last_name opener,u.email opener_email,u.phone opener_phone
     FROM support_tickets t JOIN companies c ON c.id=t.company_id LEFT JOIN jobs j ON j.id=t.job_id LEFT JOIN users u ON u.id=t.opened_by WHERE t.id=$1`,
    [id],
  );
  if (!t) notFound();
  const [messages, staff] = await Promise.all([
    query<{ id: number; body: string; internal: boolean; created_at: string; author: string | null; role: string | null }>(
      `SELECT m.id,m.body,m.internal,m.created_at,u.first_name||' '||u.last_name author,u.role FROM ticket_messages m LEFT JOIN users u ON u.id=m.author_id WHERE m.ticket_id=$1 ORDER BY m.created_at`,
      [id],
    ),
    query<{ id: string; name: string }>(`SELECT id,first_name||' '||last_name name FROM users WHERE role IN ('partner_manager','admin') AND NOT suspended ORDER BY first_name`),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <Link href="/partenaires/support" className="text-sm text-ink-soft hover:text-indigo">Support et SAV</Link>
        <h1 className="text-2xl font-bold">#{t.id} {t.subject}</h1>
        <p className="mt-1 text-ink-soft">
          <Link href={`/partenaires/entreprises/${t.company_id}`} className="font-medium text-indigo">{t.company}</Link> · {categoryLabel(t.category)} · ouverte le {date(t.created_at)}
          {t.job_title && <> · offre « {t.job_title} »</>}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <ol className="space-y-3">
            {messages.map((m) => {
              const fromClient = m.role === "recruiter";
              return (
                <li key={m.id} className={`card p-4 ${m.internal ? "border-dashed border-saffron bg-saffron-soft/40" : fromClient ? "" : "border-indigo/30 bg-wash/60"}`}>
                  <p className="text-xs text-muted">{m.author ?? "Utilisateur supprimé"} · {fromClient ? "client" : m.internal ? "note interne, invisible du client" : "équipe Global Talents"} · {since(m.created_at)}</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{m.body}</p>
                </li>
              );
            })}
          </ol>
          <section className="card p-5">
            <h2 className="font-bold">Répondre</h2>
            <ActionForm action={staffReply} resetOnSuccess className="mt-3 space-y-3">
              <input type="hidden" name="ticket_id" value={t.id} />
              <textarea name="body" className="input min-h-28" maxLength={4000} required aria-label="Message" placeholder="Bonjour, …" />
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="internal" /> Note interne (invisible du client)</label>
                <select name="status" defaultValue="attente_client" className="input w-auto" aria-label="Statut après la réponse">
                  <option value="attente_client">Puis : en attente du client</option>
                  <option value="en_cours">Puis : en cours</option>
                  <option value="resolu">Puis : résolu</option>
                </select>
                <Submit className="btn btn-primary">Envoyer</Submit>
              </div>
            </ActionForm>
          </section>
        </div>
        <aside className="space-y-4">
          <form action={updateTicket} className="card space-y-3 p-4">
            <input type="hidden" name="ticket_id" value={t.id} />
            <p className="flex items-center justify-between text-sm"><span className="font-semibold">Suivi</span><span className={`chip ${staffStatus(t.status).tone}`}>{staffStatus(t.status).label}</span></p>
            <label className="block"><span className="label">Statut</span>
              <select name="status" defaultValue={t.status} className="input">{Object.keys(TICKET_STATUS).map((k) => <option key={k} value={k}>{staffStatus(k).label}</option>)}</select>
            </label>
            <label className="block"><span className="label">Priorité</span>
              <select name="priority" defaultValue={t.priority} className="input">{Object.entries(TICKET_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="block"><span className="label">Attribuée à</span>
              <select name="assigned_to" defaultValue={t.assigned_to ?? ""} className="input"><option value="">Personne</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </label>
            <button className="btn btn-ghost w-full">Mettre à jour</button>
          </form>
          <div className="card p-4 text-sm">
            <p className="font-semibold">Demandeur</p>
            <p className="mt-1">{t.opener}</p>
            {t.opener_email && <a href={`mailto:${t.opener_email}`} className="block text-indigo">{t.opener_email}</a>}
            {t.opener_phone && <a href={`tel:${t.opener_phone}`} className="block text-indigo">{t.opener_phone}</a>}
            {t.satisfaction && <p className="mt-2">Satisfaction : {t.satisfaction} / 5</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
