import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Journal d'audit" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireUser(["admin"]);
  const rows = await query<{ id: number; created_at: string; actor: string | null; action: string; target_type: string; target_id: string; meta: object }>(
    `SELECT l.id,l.created_at,u.email actor,l.action,l.target_type,l.target_id,l.meta FROM audit_log l LEFT JOIN users u ON u.id=l.actor_id ORDER BY l.id DESC LIMIT 300`,
  );
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Journal d&apos;audit</h1>
      <p className="text-sm text-ink-soft">Les 300 dernières actions sensibles. Ce journal ne peut pas être modifié depuis l&apos;interface.</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line text-left text-ink-soft"><tr><th className="p-3">Date</th><th className="p-3">Auteur</th><th className="p-3">Action</th><th className="p-3">Cible</th><th className="p-3">Détails</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap p-3">{new Date(r.created_at).toLocaleString("fr-FR")}</td>
                <td className="p-3">{r.actor ?? "système"}</td>
                <td className="p-3 font-mono text-xs">{r.action}</td>
                <td className="p-3 text-xs">{r.target_type} {r.target_id}</td>
                <td className="p-3 font-mono text-xs text-ink-soft">{Object.keys(r.meta).length ? JSON.stringify(r.meta) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
