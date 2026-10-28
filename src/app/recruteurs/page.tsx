import Link from "next/link";
import { query } from "@/lib/db";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recruter en Afrique de l'Ouest", description: "Publiez vos offres, triez les candidatures par score et accédez à la CVthèque. Paiement par Mobile Money." };

export default async function RecruitersPage() {
  const plans = await query<{ code: string; name: string; description: string; price_xof: number; period: string }>(
    `SELECT code,name,description,price_xof,period FROM plans ORDER BY sort`,
  );
  return (
    <>
      <section className="weave text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h1 className="max-w-3xl text-[2.1rem] font-bold sm:text-5xl">Recevez moins de CV hors sujet, et les bons plus vite</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Chaque candidature arrive avec un score de correspondance, les réponses à vos questions de présélection et son CV. Vous la faites avancer étape par étape jusqu&apos;à l&apos;embauche.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/recruteurs/inscription" className="btn bg-saffron px-6 py-3 text-base text-ink hover:bg-[#ecb54b]">Publier ma première offre gratuitement</Link>
            <Link href="/connexion" className="btn border-white/40 px-6 py-3 text-base text-white hover:bg-white/10">J&apos;ai déjà un compte</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold">De l&apos;offre à l&apos;embauche</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            ["Publiez", "Rédigez l'offre, ajoutez vos questions éliminatoires. Notre équipe la valide sous 24 h ouvrées."],
            ["Triez", "Les candidatures sont classées par score. Celles qui échouent à une question éliminatoire sont signalées."],
            ["Avancez", "Déplacez chaque candidat dans votre pipeline. Il voit l'étape où il en est, ce qui réduit les relances."],
            ["Cherchez", "Trouvez dans la CVthèque des profils qui n'ont pas encore postulé, par métier, pays et expérience."],
          ].map(([t, d], i) => (
            <li key={t} className="card p-5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo font-display font-bold text-white">{i + 1}</span>
              <h3 className="mt-3 text-lg font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-ink-soft">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="tarifs" className="bg-white py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold">Tarifs</h2>
          <p className="mt-1 text-ink-soft">Prix hors taxes. Une première offre est offerte à chaque nouvelle entreprise. Paiement par Wave, Orange Money, Moov, MTN, Free Money ou carte.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <div key={p.code} className={`card flex flex-col p-5 ${p.code === "pro" ? "border-2 border-indigo" : ""}`}>
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-1 flex-1 text-sm text-ink-soft">{p.description}</p>
                <p className="mt-4 font-display text-2xl font-bold">
                  {money(p.price_xof)}
                  {p.period === "month" && <span className="text-base font-medium text-muted"> par mois</span>}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-ink-soft">
            Cabinet de recrutement, groupe multi-pays ou ONG ? <a href="mailto:entreprises@globaltalents-resources.com" className="font-semibold text-indigo underline">Demandez un devis</a>.
          </p>
        </div>
      </section>
    </>
  );
}
