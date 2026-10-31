import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { latestPersonality, retakeStatus } from "@/lib/personality-server";
import { dominant, TRAITS } from "@/lib/personality";
import { TraitBars } from "@/components/TraitBars";
import { PrintButton } from "@/components/PrintButton";
import { date } from "@/lib/format";

export const metadata = { title: "Mes résultats au test Boussole" };

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ nouveau?: string }> }) {
  const u = await requireUser(["candidate"]);
  const sp = await searchParams;
  const [r, st, share] = await Promise.all([
    latestPersonality(u.id),
    retakeStatus(u.id),
    one<{ share_test: boolean }>(`SELECT share_test FROM candidate_profiles WHERE user_id=$1`, [u.id]),
  ]);
  if (!r) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-bold">Vous n&apos;avez pas encore passé le test</h1>
        <p className="mt-2 text-ink-soft">5 minutes pour découvrir vos points forts au travail et les environnements où vous serez le plus à l&apos;aise.</p>
        <Link href="/candidat/test" className="btn btn-primary mt-5">Passer le test Boussole</Link>
      </div>
    );
  }
  const d = dominant(r.scores);
  const strong = TRAITS.filter((t) => r.scores[t.code] >= 60);
  return (
    <div className="space-y-6">
      {sp.nouveau && <p role="status" className="rounded-lg border border-[#bfe0cf] bg-leaf-soft px-3 py-2 text-sm text-leaf">Merci ! Vos résultats sont enregistrés.</p>}
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-strong via-indigo to-[#3b4bb0] p-6 text-white sm:p-8">
          <p className="text-sm uppercase tracking-wider text-white/70">Votre profil Boussole</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{d.first.profile}</h1>
          <p className="mt-2 max-w-2xl text-white/85">
            Votre trait le plus marqué est « {d.first.label.toLowerCase()} », suivi de « {d.second.label.toLowerCase()} ». {d.first.strengths}
          </p>
          <p className="mt-4 text-xs text-white/60">Test passé le {date(r.created_at)}.</p>
        </div>
        <div className="p-6 sm:p-8">
          <h2 className="text-lg font-bold">Vos 5 traits professionnels</h2>
          <div className="mt-4"><TraitBars scores={r.scores} /></div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-lg font-bold">Vos forces au travail</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {(strong.length ? strong : [d.first, d.second]).map((t) => (
              <li key={t.code}><span className="font-semibold">{t.label}.</span> {t.strengths}</li>
            ))}
            <li className="text-ink-soft"><span className="font-semibold text-ink">{d.lowest.label} :</span> {d.lowest.lowText}</li>
          </ul>
        </section>
        <section className="card p-6">
          <h2 className="text-lg font-bold">Là où vous serez le plus à l&apos;aise</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {[d.first, d.second].map((t) => <li key={t.code}>{t.thrive}</li>)}
          </ul>
          <h3 className="mt-5 font-semibold">Point d&apos;attention</h3>
          <p className="mt-1 text-sm text-ink-soft">{d.first.watch}</p>
        </section>
      </div>

      <section className="card flex flex-wrap items-center gap-4 p-5 text-sm">
        <p className="min-w-0 flex-1">
          {share?.share_test
            ? "Vos résultats sont partagés par défaut avec les recruteurs à qui vous postulez."
            : "Vos résultats ne sont pas partagés par défaut. Vous pouvez les partager candidature par candidature."}{" "}
          Les recruteurs qui cherchent un trait précis verront mieux votre adéquation si vous partagez.
        </p>
        <Link href="/candidat/parametres" className="btn btn-ghost btn-sm">Modifier le partage</Link>
        <PrintButton />
        {st.ok ? (
          <Link href="/candidat/test" className="btn btn-ghost btn-sm">Repasser le test</Link>
        ) : (
          <span className="text-muted">Prochaine passation possible le {date(st.next)}.</span>
        )}
      </section>
      <p className="text-xs text-muted">
        Le test Boussole s&apos;appuie sur le modèle des cinq grands traits de personnalité, adapté au monde du travail. C&apos;est une auto-évaluation indicative :
        les recruteurs de Global Talents s&apos;engagent à ne pas l&apos;utiliser comme seul critère de décision.
      </p>
    </div>
  );
}
