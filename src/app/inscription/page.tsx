import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/Form";
import { registerCandidate } from "@/app/actions/auth";
import { getUser } from "@/lib/auth";
import { getRefs } from "@/lib/refdata";

export const metadata = { title: "Créer un compte candidat" };

export default async function RegisterPage() {
  if (await getUser()) redirect("/candidat");
  const { countries } = await getRefs();
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:grid-cols-[1fr_380px]">
      <div>
        <h1 className="text-3xl font-bold">Créer mon compte candidat</h1>
        <p className="mt-2 text-ink-soft">Gratuit. Vous pourrez ajouter votre CV juste après.</p>
        <ActionForm action={registerCandidate} className="card mt-6 grid gap-4 p-6 sm:grid-cols-2">
          <label className="block">
            <span className="label">Prénom</span>
            <input name="first_name" required autoComplete="given-name" className="input" />
          </label>
          <label className="block">
            <span className="label">Nom</span>
            <input name="last_name" required autoComplete="family-name" className="input" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Adresse e-mail</span>
            <input name="email" type="email" required autoComplete="email" className="input" />
          </label>
          <label className="block">
            <span className="label">Téléphone (WhatsApp de préférence)</span>
            <input name="phone" type="tel" required autoComplete="tel" className="input" placeholder="+221 77 123 45 67" />
          </label>
          <label className="block">
            <span className="label">Pays de résidence</span>
            <select name="country_code" required className="input" defaultValue="">
              <option value="" disabled>Choisir</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Mot de passe</span>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
            <span className="hint">8 caractères minimum.</span>
          </label>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="consent" required className="mt-1" />
            <span>
              J&apos;accepte les <Link href="/infos/cgu" className="text-indigo underline">conditions d&apos;utilisation</Link> et le traitement de mes données
              personnelles pour mes candidatures, conformément à la <Link href="/infos/confidentialite" className="text-indigo underline">politique de confidentialité</Link>.
            </span>
          </label>
          <div className="sm:col-span-2">
            <Submit className="btn btn-primary w-full" pendingLabel="Création…">Créer mon compte</Submit>
          </div>
        </ActionForm>
        <p className="mt-4 text-sm">Déjà inscrit ? <Link href="/connexion" className="font-semibold text-indigo hover:underline">Se connecter</Link></p>
      </div>
      <aside className="space-y-4 self-start text-sm md:mt-20">
        <h2 className="text-lg font-bold">Avec votre compte</h2>
        <ul className="space-y-3 text-ink-soft">
          <li><strong className="text-ink">Un score de correspondance</strong> sur chaque offre, avec ce qui compte et ce qui manque.</li>
          <li><strong className="text-ink">Le suivi de vos candidatures</strong> : envoyée, CV consulté, entretien, réponse.</li>
          <li><strong className="text-ink">Des alertes</strong> chaque soir sur les nouvelles offres qui vous correspondent.</li>
          <li><strong className="text-ink">Le contrôle de votre visibilité</strong> : vous choisissez si les recruteurs peuvent vous trouver dans la CVthèque.</li>
        </ul>
      </aside>
    </div>
  );
}
