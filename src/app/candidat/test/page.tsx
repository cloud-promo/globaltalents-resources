import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { retakeStatus } from "@/lib/personality-server";
import { PersonalityTest } from "@/components/PersonalityTest";
import { savePersonality } from "@/app/actions/candidate";
import { ITEMS } from "@/lib/personality";

export const metadata = { title: "Test de personnalité Boussole" };

export default async function TakeTestPage() {
  const u = await requireUser(["candidate"]);
  const st = await retakeStatus(u.id);
  if (!st.ok) redirect("/candidat/test/resultats");
  return (
    <div className="space-y-6">
      <div>
        <Link href="/candidat/test/resultats" className="text-sm text-ink-soft hover:text-indigo">{st.count ? "Mes résultats" : "Mon espace"}</Link>
        <h1 className="text-2xl font-bold">Test de personnalité Boussole</h1>
        <p className="mt-1 max-w-2xl text-ink-soft">
          {ITEMS.length} paires d&apos;affirmations, environ 5 minutes. Pour chaque paire, placez-vous du côté de l&apos;affirmation qui vous ressemble le plus
          au travail. Le cercle du milieu signifie « sans préférence ». Il n&apos;y a pas de bonne ou de mauvaise réponse : répondez spontanément.
        </p>
      </div>
      <PersonalityTest action={savePersonality} />
      <p className="text-xs text-muted">
        Vos résultats restent privés. Vous choisissez de les partager avec un recruteur, par défaut dans vos paramètres ou candidature par candidature.
        Ce test est un outil d&apos;auto-évaluation : il éclaire un profil, il ne remplace pas un entretien.
      </p>
    </div>
  );
}
