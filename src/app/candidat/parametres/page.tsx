import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import type { Profile } from "@/lib/profile";
import { ActionForm, Submit } from "@/components/Form";
import { updateSettings, changePassword, changeEmail, deleteAccount } from "@/app/actions/candidate";

export const metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const u = await requireUser(["candidate"]);
  const p = (await one<Profile>(`SELECT * FROM candidate_profiles WHERE user_id=$1`, [u.id]))!;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Paramètres</h1>

      <ActionForm action={updateSettings} className="card space-y-5 p-5 sm:p-6">
        <fieldset>
          <legend className="text-lg font-bold">Visibilité de mon profil</legend>
          <div className="mt-3 space-y-3">
            <Check name="visible_cvtheque" on={p.visible_cvtheque} label="Les recruteurs peuvent trouver mon profil dans la CVthèque" hint="Vos coordonnées restent masquées tant qu'un recruteur ne les a pas débloquées." />
            <Check name="public_profile" on={p.public_profile} label="Mon profil est visible sur Google (profil public)" hint="Seuls votre titre, votre ville et vos compétences sont publiés, jamais vos coordonnées." />
            <Check name="show_photo" on={p.show_photo} label="J'affiche ma photo sur mon profil public" />
            <Check name="share_test" on={p.share_test} label="Je partage par défaut les résultats de mes tests de personnalité" hint="Vous pouvez aussi choisir candidature par candidature." />
          </div>
        </fieldset>
        <fieldset className="border-t border-line pt-5">
          <legend className="text-lg font-bold">Messages que je reçois</legend>
          <div className="mt-3 space-y-3">
            <Check name="notify_cv_viewed" on={p.notify_cv_viewed} label="Me prévenir quand un recruteur consulte mon CV" />
            <Check name="whatsapp_alerts" on={p.whatsapp_alerts} label="Recevoir mes alertes emploi sur WhatsApp" hint={`Au numéro ${u.phone || "indiqué dans votre profil"}.`} />
            <Check name="newsletter" on={p.newsletter} label="Recevoir la newsletter conseils et emploi" />
            <label className="ml-7 flex items-center gap-2 text-sm">
              Fréquence
              <select name="newsletter_frequency" defaultValue={p.newsletter_frequency} className="input w-auto py-1">
                <option value="hebdomadaire">Hebdomadaire</option>
                <option value="mensuelle">Mensuelle</option>
              </select>
            </label>
            <Check name="partner_offers" on={p.partner_offers} label="Recevoir les offres de nos partenaires (formations, écoles)" />
          </div>
        </fieldset>
        <Submit>Enregistrer les paramètres</Submit>
      </ActionForm>

      <div className="grid gap-6 md:grid-cols-2">
        <ActionForm action={changeEmail} className="card space-y-3 p-5" resetOnSuccess>
          <h2 className="text-lg font-bold">Adresse e-mail</h2>
          <p className="text-sm text-ink-soft">Actuelle : <strong>{u.email}</strong>. Elle sert d&apos;identifiant de connexion.</p>
          <input name="email" type="email" required className="input" placeholder="Nouvelle adresse" aria-label="Nouvelle adresse e-mail" />
          <input name="password" type="password" required className="input" placeholder="Mot de passe actuel" aria-label="Mot de passe actuel" autoComplete="current-password" />
          <Submit className="btn btn-ghost">Modifier l&apos;adresse</Submit>
        </ActionForm>
        <ActionForm action={changePassword} className="card space-y-3 p-5" resetOnSuccess>
          <h2 className="text-lg font-bold">Mot de passe</h2>
          <input name="current" type="password" required className="input" placeholder="Mot de passe actuel" aria-label="Mot de passe actuel" autoComplete="current-password" />
          <input name="next" type="password" required minLength={8} className="input" placeholder="Nouveau mot de passe" aria-label="Nouveau mot de passe" autoComplete="new-password" />
          <input name="confirm" type="password" required minLength={8} className="input" placeholder="Confirmer le nouveau mot de passe" aria-label="Confirmer" autoComplete="new-password" />
          <Submit className="btn btn-ghost">Changer le mot de passe</Submit>
        </ActionForm>
      </div>

      <section className="card p-5">
        <h2 className="text-lg font-bold">Mes données personnelles</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Responsable du traitement : Global Talents Resources. Contact du délégué à la protection des données : dpo@globaltalents-resources.com.
        </p>
        <a href="/api/me/export" className="btn btn-ghost btn-sm mt-3">Télécharger toutes mes données</a>
        <details className="mt-5 border-t border-line pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-clay">Supprimer mon compte</summary>
          <ActionForm action={deleteAccount} className="mt-3 space-y-3">
            <p className="text-sm text-ink-soft">Votre profil, vos CV et vos candidatures sont supprimés définitivement. Cette action ne peut pas être annulée.</p>
            <input name="confirm" className="input max-w-xs" placeholder="Tapez SUPPRIMER" aria-label="Tapez SUPPRIMER pour confirmer" required />
            <Submit className="btn btn-danger" pendingLabel="Suppression…">Supprimer définitivement mon compte</Submit>
          </ActionForm>
        </details>
      </section>
    </div>
  );
}

function Check({ name, on, label, hint }: { name: string; on: boolean; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={on} className="mt-1 h-4 w-4 accent-[#23317A]" />
      <span>
        <span className="block text-[0.95rem]">{label}</span>
        {hint && <span className="hint block">{hint}</span>}
      </span>
    </label>
  );
}
