import { requirePartnerStaff } from "@/lib/auth";
import { ActionForm, Submit } from "@/components/Form";
import { changePassword } from "@/app/actions/candidate";

export const metadata = { title: "Mon compte" };

export default async function StaffAccount() {
  const u = await requirePartnerStaff();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Mon compte</h1>
      <p className="text-ink-soft">{u.first_name} {u.last_name} · {u.email}</p>
      <ActionForm action={changePassword} className="card grid gap-3 p-5 sm:grid-cols-3" resetOnSuccess>
        <h2 className="text-lg font-bold sm:col-span-3">Mon mot de passe</h2>
        <input name="current" type="password" required className="input" placeholder="Mot de passe actuel" aria-label="Mot de passe actuel" autoComplete="current-password" />
        <input name="next" type="password" required minLength={8} className="input" placeholder="Nouveau mot de passe" aria-label="Nouveau mot de passe" autoComplete="new-password" />
        <input name="confirm" type="password" required minLength={8} className="input" placeholder="Confirmer" aria-label="Confirmer le nouveau mot de passe" autoComplete="new-password" />
        <div className="sm:col-span-3"><Submit className="btn btn-primary">Changer mon mot de passe</Submit></div>
      </ActionForm>
    </div>
  );
}
