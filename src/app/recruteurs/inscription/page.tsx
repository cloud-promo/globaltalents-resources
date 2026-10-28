import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/Form";
import { registerRecruiter } from "@/app/actions/auth";
import { getUser } from "@/lib/auth";
import { getRefs } from "@/lib/refdata";
import { COMPANY_SIZES } from "@/lib/ref";

export const metadata = { title: "Créer un compte entreprise" };

export default async function RecruiterRegisterPage() {
  const user = await getUser();
  if (user?.role === "recruiter") redirect("/recruteur");
  const { countries, sectors } = await getRefs();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Créer un compte entreprise</h1>
      <p className="mt-2 text-ink-soft">Votre entreprise est vérifiée par notre équipe avant la publication de la première offre, en général sous 24 h ouvrées.</p>
      {user && <p className="mt-4 rounded-lg bg-saffron-soft p-3 text-sm">Vous êtes connecté avec un compte {user.role === "candidate" ? "candidat" : user.role}. Utilisez une autre adresse e-mail pour le compte entreprise.</p>}
      <ActionForm action={registerRecruiter} className="card mt-6 space-y-6 p-6">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-lg font-semibold">L&apos;entreprise</legend>
          <label className="block sm:col-span-2">
            <span className="label">Raison sociale</span>
            <input name="company_name" required className="input" autoComplete="organization" />
          </label>
          <label className="block">
            <span className="label">Pays du siège</span>
            <select name="country_code" required defaultValue="" className="input">
              <option value="" disabled>Choisir</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Ville</span>
            <input name="city" required className="input" />
          </label>
          <label className="block">
            <span className="label">Secteur</span>
            <select name="sector_id" required defaultValue="" className="input">
              <option value="" disabled>Choisir</option>
              {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Effectif</span>
            <select name="size_band" required defaultValue="" className="input">
              <option value="" disabled>Choisir</option>
              {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s} salariés</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Numéro RCCM ou NINEA</span>
            <input name="registration_number" required className="input" />
            <span className="hint">Il sert uniquement à vérifier que l&apos;entreprise existe. Il n&apos;est pas affiché publiquement.</span>
          </label>
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-lg font-semibold">Vous</legend>
          <label className="block">
            <span className="label">Prénom</span>
            <input name="first_name" required className="input" autoComplete="given-name" />
          </label>
          <label className="block">
            <span className="label">Nom</span>
            <input name="last_name" required className="input" autoComplete="family-name" />
          </label>
          <label className="block">
            <span className="label">E-mail professionnel</span>
            <input name="email" type="email" required className="input" autoComplete="email" />
          </label>
          <label className="block">
            <span className="label">Téléphone</span>
            <input name="phone" type="tel" required className="input" autoComplete="tel" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Mot de passe</span>
            <input name="password" type="password" required minLength={8} className="input" autoComplete="new-password" />
          </label>
        </fieldset>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" required className="mt-1" />
          <span>J&apos;accepte les <Link href="/infos/cgu" className="text-indigo underline">conditions d&apos;utilisation</Link> et m&apos;engage à publier des offres réelles, sans demander de paiement aux candidats.</span>
        </label>
        <Submit className="btn btn-primary w-full" pendingLabel="Création…">Créer le compte entreprise</Submit>
      </ActionForm>
    </div>
  );
}
