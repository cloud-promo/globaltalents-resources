import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { date, since } from "@/lib/format";
import { TICKET_STATUS, categoryLabel } from "@/lib/partners";
import { ActionForm, Submit } from "@/components/Form";
import { recruiterReply, rateTicket } from "@/app/actions/partners";

export const metadata = { title: "Ma demande" };

export default async function RecruiterTicket({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ envoye?: string }> }) {
  const id = Number((await params).id) || 0;
  const sp = await searchParams;
  const { company } = await requireRecruiter();
  const t = await one<{ id: number; subject: string; category: string; status: string; created_at: string; satisfaction: number | null }>(
    `SELECT id,subject,category,status,created_at,satisfaction FROM support_tickets WHERE id=$1 AND company_id=$2`,
    [id, company.company_id],
  );
  if (!t) notFound();
  const messages = await query<{ id: number; body: string; created_at: string; author: string | null; role: string | null }>(
    `SELECT m.id,m.body,m.created_at,u.first_name author,u.role FROM ticket_messages m LEFT JOIN users u ON u.id=m.author_id
     WHERE m.ticket_id=$1 AND NOT m.internal ORDER BY m.created_at`,
    [id],
  );
  const closed = ["resolu", "ferme"].includes(t.status);
  return (
    <div className="space-y-5">
      <div>
        <Link href="/recruteur/support" className="text-sm text-ink-soft hover:text-indigo">Support</Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">#{t.id} {t.subject}</h1>
          <span className={`chip ${TICKET_STATUS[t.status].tone}`}>{TICKET_STATUS[t.status].label}</span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">{categoryLabel(t.category)} · ouverte le {date(t.created_at)}</p>
      </div>
      {sp.envoye && <p role="status" className="rounded-lg border border-[#bfe0cf] bg-leaf-soft px-3 py-2 text-sm text-leaf">Demande envoyée. Vous serez notifié dès que l&apos;équipe vous répond.</p>}
      <ol className="space-y-3">
        {messages.map((m) => {
          const staff = m.role !== "recruiter";
          return (
            <li key={m.id} className={`card p-4 ${staff ? "border-indigo/30 bg-wash/60" : ""}`}>
              <p className="text-xs text-muted">{staff ? `${m.author ?? "Équipe"}, équipe Global Talents` : m.author ?? "Vous"} · {since(m.created_at)}</p>
              <p className="mt-1 whitespace-pre-line text-sm">{m.body}</p>
            </li>
          );
        })}
      </ol>
      {closed && !t.satisfaction && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-semibold">Votre demande a-t-elle été bien traitée ?</span>
          <span className="flex gap-1" role="group" aria-label="Note de 1 à 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <form key={n} action={rateTicket}>
                <input type="hidden" name="ticket_id" value={t.id} />
                <input type="hidden" name="score" value={n} />
                <button className="btn btn-ghost btn-sm w-10" aria-label={`${n} sur 5`}>{n}</button>
              </form>
            ))}
          </span>
        </div>
      )}
      {t.satisfaction && <p className="text-sm text-ink-soft">Merci pour votre note : {t.satisfaction} / 5.</p>}
      {t.status !== "ferme" && (
        <ActionForm action={recruiterReply} resetOnSuccess className="card space-y-3 p-5">
          <input type="hidden" name="ticket_id" value={t.id} />
          <label className="block"><span className="label">{closed ? "Le problème persiste ? Répondez pour rouvrir la demande" : "Votre réponse"}</span>
            <textarea name="body" className="input min-h-24" maxLength={4000} required />
          </label>
          <Submit className="btn btn-primary">Envoyer</Submit>
        </ActionForm>
      )}
    </div>
  );
}
