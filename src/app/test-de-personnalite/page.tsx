import Link from "next/link";
import { getUser } from "@/lib/auth";
import { TRAITS, ITEMS } from "@/lib/personality";

export const metadata = {
  title: "Test de personnalité gratuit Boussole",
  description: "Découvrez vos forces au travail en 5 minutes avec le test de personnalité gratuit Boussole de Global Talents Resources.",
};

export default async function PersonalityLanding() {
  const u = await getUser();
  const cta = u?.role === "candidate" ? "/candidat/test" : `/connexion?next=${encodeURIComponent("/candidat/test")}`;
  return (
    <div>
      <section className="relative overflow-hidden bg-indigo-strong text-white">
        <div className="weave absolute inset-x-0 bottom-0 h-2" aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div>
            <p className="chip bg-white/10 text-white">Gratuit, 5 minutes, {ITEMS.length} paires d&apos;affirmations</p>
            <h1 className="mt-4 text-4xl font-bold sm:text-5xl">Le test Boussole : découvrez vos forces au travail</h1>
            <p className="mt-4 max-w-xl text-lg text-white/85">
              Comprenez votre façon de travailler, les environnements où vous vous épanouirez et montrez aux recruteurs ce qui vous rend unique.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={cta} className="btn bg-saffron px-5 py-3 text-base text-ink hover:bg-[#f0b544]">Passer le test gratuitement</Link>
              {!u && <Link href="/inscription" className="btn border-white/30 px-5 py-3 text-base text-white hover:bg-white/10">Créer mon compte</Link>}
            </div>
          </div>
          <ul className="grid gap-3" aria-label="Les 5 traits mesurés">
            {TRAITS.map((t, i) => (
              <li key={t.code} className="flex items-center gap-3 rounded-xl bg-white/[0.07] p-3 ring-1 ring-white/10">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-saffron font-display font-bold text-ink">{i + 1}</span>
                <span><span className="block font-semibold">{t.label}</span><span className="text-sm text-white/70">Profil {t.profile}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold">Comment ça marche</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Répondez spontanément", "Pour chaque paire d'affirmations opposées, placez-vous du côté qui vous ressemble le plus au travail."],
            ["Recevez votre profil", "Vos 5 traits, votre profil dominant, vos forces et les environnements où vous serez le plus à l'aise."],
            ["Partagez si vous le souhaitez", "Joignez vos résultats à vos candidatures : les recruteurs voient votre adéquation avec le poste."],
          ].map(([t, d], i) => (
            <li key={t} className="card p-5">
              <span className="font-display text-3xl font-bold text-saffron">0{i + 1}</span>
              <h3 className="mt-2 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-ink-soft">{d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="card p-6">
            <h2 className="text-lg font-bold">Ce que mesure le test</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Boussole s&apos;appuie sur le modèle des cinq grands traits de personnalité, le plus étudié en psychologie du travail, adapté aux réalités des
              entreprises d&apos;Afrique de l&apos;Ouest.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {TRAITS.map((t) => <li key={t.code}><span className="font-semibold">{t.label}</span> : de « {t.low.toLowerCase()} » à « {t.high.toLowerCase()} ».</li>)}
            </ul>
          </div>
          <div className="card p-6">
            <h2 className="text-lg font-bold">Vos résultats vous appartiennent</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
              <li>Ils ne sont visibles par un recruteur que si vous le décidez.</li>
              <li>Vous pouvez repasser le test autant que vous voulez pendant 48 heures, puis tous les 6 mois.</li>
              <li>C&apos;est une auto-évaluation indicative, jamais le seul critère d&apos;une décision de recrutement.</li>
              <li>Vous pouvez supprimer vos données à tout moment depuis vos paramètres.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
