import { requireRecruiter } from "@/lib/auth";
import { query } from "@/lib/db";
import { since } from "@/lib/format";
import { ActionForm, Submit } from "@/components/Form";
import { addMember, removeMember } from "@/app/actions/recruiter";
import { changePassword } from "@/app/actions/candidate";

export const metadata = { title: "Équipe" };

const ROLES: Record<string, string> = { admin: "Administrateur", recruiter: "Recruteur", manager: "Manager (évaluation)" };

export default async function TeamPage() {
  const { user, company } = await requireRecruiter();
  const members = await query<{ user_id: string; role: string; first_name: string; last_name: string; email: string; last_login_at: string | null }>(
    `SELECT m.user_id,m.role,u.first_name,u.last_name,u.email,u.last_login_at FROM company_members m JOIN users u ON u.id=m.user_id
     WHERE m.company_id=$1 ORDER BY m.role, u.first_name`,
    [company.company_id],
  );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Équipe</h1>
        <p className="mt-1 text-ink-soft">Les membres partagent les offres, les candidatures et les notes de l&apos;entreprise.</p>
      </div>
      <ul className="card divide-y divide-line">
        {members.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <span>
              <span className="block font-semibold">{m.first_name} {m.last_name}{m.user_id === user.id && " (vous)"}</span>
              <span className="text-sm text-ink-soft">{m.email}, {m.last_login_at ? `connecté ${since(m.last_login_at)}` : "jamais connecté"}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="chip">{ROLES[m.role]}</span>
              {company.role === "admin" && m.user_id !== user.id && (
                <form action={removeMember}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <button className="btn btn-danger btn-sm">Retirer</button>
                </form>
              )}
            </span>
          </li>
        ))}
      </ul>
      {company.role === "admin" && (
        <ActionForm action={addMember} className="card grid gap-3 p-5 sm:grid-cols-2" resetOnSuccess>
          <h2 className="text-lg font-bold sm:col-span-2">Ajouter un membre</h2>
          <label className="block">
            <span className="label">Prénom</span>
            <input name="first_name" className="input" />
          </label>
          <label className="block">
            <span className="label">Nom</span>
            <input name="last_name" className="input" />
          </label>
          <label className="block">
            <span className="label">E-mail du collègue</span>
            <input name="email" type="email" required className="input" />
          </label>
          <label className="block">
            <span className="label">Rôle</span>
            <select name="role" className="input" defaultValue="recruiter">
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <p className="hint sm:col-span-2">Si votre collègue n&apos;a pas encore de compte, il est créé avec un mot de passe temporaire que vous lui transmettez.</p>
          <div className="sm:col-span-2"><Submit className="btn btn-primary">Ajouter à l&apos;équipe</Submit></div>
        </ActionForm>
      )}
      <ActionForm action={changePassword} className="card grid gap-3 p-5 sm:grid-cols-3" resetOnSuccess>
        <h2 className="text-lg font-bold sm:col-span-3">Mon mot de passe</h2>
        <input name="current" type="password" required className="input" placeholder="Mot de passe actuel" aria-label="Mot de passe actuel" autoComplete="current-password" />
        <input name="next" type="password" required minLength={8} className="input" placeholder="Nouveau mot de passe" aria-label="Nouveau mot de passe" autoComplete="new-password" />
        <input name="confirm" type="password" required minLength={8} className="input" placeholder="Confirmer" aria-label="Confirmer le nouveau mot de passe" autoComplete="new-password" />
        <div className="sm:col-span-3"><Submit className="btn btn-ghost">Changer mon mot de passe</Submit></div>
      </ActionForm>
    </div>
  );
}
