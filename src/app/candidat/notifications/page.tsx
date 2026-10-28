import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { since } from "@/lib/format";
import { markNotificationsRead } from "@/app/actions/candidate";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const u = await requireUser(["candidate"]);
  const items = await query<{ id: number; title: string; body: string; link: string; read_at: string | null; created_at: string }>(
    `SELECT id,title,body,link,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [u.id],
  );
  const unread = items.filter((i) => !i.read_at).length;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-ink-soft">{unread ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est lu."}</p>
        </div>
        {unread > 0 && (
          <form action={markNotificationsRead}>
            <button className="btn btn-ghost btn-sm">Tout marquer comme lu</button>
          </form>
        )}
      </div>
      <ul className="card mt-5 divide-y divide-line">
        {items.map((n) => (
          <li key={n.id} className={`flex gap-3 p-4 ${n.read_at ? "" : "bg-wash/60"}`}>
            <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-saffron"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{n.link ? <Link href={n.link} className="hover:text-indigo">{n.title}</Link> : n.title}</p>
              {n.body && <p className="text-sm text-ink-soft">{n.body}</p>}
              <p className="mt-1 text-xs text-muted">{since(n.created_at)}</p>
            </div>
          </li>
        ))}
        {!items.length && <li className="p-6 text-ink-soft">Aucune notification pour le moment.</li>}
      </ul>
    </div>
  );
}
