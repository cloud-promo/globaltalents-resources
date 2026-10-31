import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/Form";
import { login } from "@/app/actions/auth";
import { getUser, homeFor } from "@/lib/auth";

export const metadata = { title: "Se connecter" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getUser();
  if (user) redirect(homeFor(user.role));

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">Se connecter</h1>
      <p className="mt-2 text-ink-soft">Candidats et recruteurs utilisent le même formulaire.</p>
      <ActionForm action={login} className="card mt-6 space-y-4 p-6">
        <input type="hidden" name="next" value={next ?? ""} />
        <label className="block">
          <span className="label">Adresse e-mail</span>
          <input name="email" type="email" autoComplete="email" required className="input" />
        </label>
        <label className="block">
          <span className="label">Mot de passe</span>
          <input name="password" type="password" autoComplete="current-password" required className="input" />
        </label>
        <Submit className="btn btn-primary w-full" pendingLabel="Connexion…">Se connecter</Submit>
        <p className="text-center text-sm text-ink-soft">
          Mot de passe oublié ? Écrivez à <a className="text-indigo underline" href="mailto:support@globaltalents-resources.com">support@globaltalents-resources.com</a>
        </p>
      </ActionForm>
      <div className="mt-6 grid gap-2 text-center text-sm">
        <p>Pas encore de compte ? <Link href={`/inscription${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-indigo hover:underline">Créer un compte candidat</Link></p>
        <p>Vous recrutez ? <Link href="/recruteurs/inscription" className="font-semibold text-indigo hover:underline">Créer un compte entreprise</Link></p>
      </div>
    </div>
  );
}
