import { query } from "@/lib/db";
import { shortDate, since } from "@/lib/format";
import { toggleUserSuspended, createStaff } from "@/app/actions/admin";
import { ActionForm, Submit } from "@/components/Form";

export const metadata = { title: "Utilisateurs" };
export const dynamic = "force-dynamic";

const ROLES: Record<string, string> = { candidate: "Candidat", recruiter: "Recruteur", partner_manager: "Gestion des partenaires", admin: "Administrateur", moderator: "Modérateur" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const sp = await searchParams;
  const role = Object.keys(ROLES).includes(sp.role ?? "") ? sp.role! : null;
  const users = await query<{ id: string; email: string; first_name: string; last_name: string; phone: string; role: string; country: string | null; suspended: boolean; created_at: string; last_login_at: string | null; company: string | null; apps: number }>(
    `SELECT u.id,u.email,u.first_name,u.last_name,u.phone,u.role,co.name country,u.suspended,u.created_at,u.last_login_at,
       (SELECT c.name FROM company_members m JOIN companies c ON c.id=m.company_id WHERE m.user_id=u.id LIMIT 1) company,
       (SELECT count(*)::int FROM applications a WHERE a.candidate_id=u.id) apps
     FROM users u LEFT JOIN countries co ON co.code=u.country_code
     WHERE ($1::text IS NULL OR u.role=$1) AND ($2::text IS NULL OR u.email ILIKE '%'||$2||'%' OR (u.first_name||' '||u.last_name) ILIKE '%'||$2||'%' OR u.phone ILIKE '%'||$2||'%')
     ORDER BY u.created_at DESC LIMIT 200`,
    [role, sp.q?.trim() || null],
  );
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Utilisateurs</h1>
      <details className="card p-4">
        <summary className="cursor-pointer font-semibold">Créer un compte d&apos;équipe (gestion des partenaires, modération)</summary>
        <ActionForm action={createStaff} resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input name="first_name" className="input" placeholder="Prénom" aria-label="Prénom" required maxLength={80} />
          <input name="last_name" className="input" placeholder="Nom" aria-label="Nom" required maxLength={80} />
          <input name="email" type="email" className="input" placeholder="E-mail professionnel" aria-label="E-mail" required maxLength={200} />
          <select name="role" className="input" aria-label="Rôle" defaultValue="partner_manager">
            <option value="partner_manager">Gestion des partenaires</option>
            <option value="moderator">Modérateur</option>
          </select>
          <Submit className="btn btn-primary">Créer le compte</Submit>
        </ActionForm>
      </details>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} className="input w-72" placeholder="Nom, e-mail ou téléphone" aria-label="Rechercher" />
        <select name="role" defaultValue={role ?? ""} className="input w-auto" aria-label="Rôle">
          <option value="">Tous les rôles</option>
          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn btn-ghost">Rechercher</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line text-left text-ink-soft">
            <tr><th className="p-3">Utilisateur</th><th className="p-3">Rôle</th><th className="p-3">Pays</th><th className="p-3">Inscription</th><th className="p-3">Dernière connexion</th><th className="p-3"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className={u.suspended ? "bg-clay-soft/40" : ""}>
                <td className="p-3"><span className="block font-medium">{u.first_name} {u.last_name}</span><span className="text-ink-soft">{u.email}{u.phone && `, ${u.phone}`}</span></td>
                <td className="p-3">{ROLES[u.role]}{u.company && <span className="block text-xs text-ink-soft">{u.company}</span>}{u.role === "candidate" && <span className="block text-xs text-ink-soft">{u.apps} candidature(s)</span>}</td>
                <td className="p-3">{u.country}</td>
                <td className="p-3">{shortDate(u.created_at)}</td>
                <td className="p-3">{u.last_login_at ? since(u.last_login_at) : "jamais"}</td>
                <td className="p-3 text-right">
                  {u.role !== "admin" && (
                    <form action={toggleUserSuspended}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className={`btn btn-sm ${u.suspended ? "btn-ghost" : "btn-danger"}`}>{u.suspended ? "Réactiver" : "Suspendre"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
