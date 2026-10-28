import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { STAGES, JOB_STATUS_LABELS } from "@/lib/ref";
import { since, jobPath } from "@/lib/format";
import { moveApplication, bulkMove } from "@/app/actions/recruiter";

export const metadata = { title: "Candidatures de l'offre" };

type Card = { id: string; first_name: string; last_name: string; anonymous: boolean; score: number; stage: string; created_at: string; viewed_at: string | null; failed_screening: boolean; title: string; city: string; notes: number };

export default async function PipelinePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ min?: string; vue?: string; masquer?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { company } = await requireRecruiter();
  const job = await one<{ id: number; title: string; city: string; status: string; expires_at: string }>(
    `SELECT id,title,city,status,expires_at FROM jobs WHERE id=$1 AND company_id=$2`,
    [Number(id) || 0, company.company_id],
  );
  if (!job) notFound();
  const min = Math.max(0, Math.min(100, Number(sp.min) || 0));
  const hideFailed = sp.masquer === "1";
  const cards = await query<Card>(
    `SELECT a.id,u.first_name,u.last_name,a.anonymous,a.score,a.stage,a.created_at,a.viewed_at,a.failed_screening,
       coalesce(p.title,'') title, coalesce(p.city,'') city,
       (SELECT count(*)::int FROM application_notes n WHERE n.application_id=a.id) notes
     FROM applications a JOIN users u ON u.id=a.candidate_id LEFT JOIN candidate_profiles p ON p.user_id=a.candidate_id
     WHERE a.job_id=$1 AND a.score >= $2 ${hideFailed ? "AND NOT a.failed_screening" : ""}
     ORDER BY a.score DESC, a.created_at`,
    [job.id, min],
  );
  const list = sp.vue === "liste";
  const name = (c: Card) => (c.anonymous && !["entretien_rh", "entretien_manager", "offre", "embauche"].includes(c.stage) ? "Candidat anonyme" : `${c.first_name} ${c.last_name}`);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/recruteur/offres" className="text-sm text-ink-soft hover:text-indigo">Mes offres</Link>
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <p className="text-ink-soft">{job.city}, {JOB_STATUS_LABELS[job.status]}, {cards.length} candidature{cards.length > 1 ? "s" : ""} affichée{cards.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {job.status === "published" && <Link href={jobPath(job.id, job.title, job.city)} className="btn btn-ghost btn-sm">Voir l&apos;annonce</Link>}
          <Link href={`/recruteur/offres/${job.id}/modifier`} className="btn btn-ghost btn-sm">Modifier</Link>
          <a href={`/api/recruteur/offres/${job.id}/export`} className="btn btn-ghost btn-sm">Exporter (CSV)</a>
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-3 text-sm">
        <label>
          <span className="label">Score minimum</span>
          <select name="min" defaultValue={String(min)} className="input w-auto py-1.5">
            {[0, 40, 50, 60, 70, 80].map((v) => <option key={v} value={v}>{v === 0 ? "Tous" : `${v} % et plus`}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2"><input type="checkbox" name="masquer" value="1" defaultChecked={hideFailed} /> Masquer les présélections non validées</label>
        <input type="hidden" name="vue" value={sp.vue ?? ""} />
        <button className="btn btn-ghost btn-sm">Filtrer</button>
        <span className="ml-auto flex gap-1">
          <Link href={`?min=${min}&masquer=${hideFailed ? 1 : ""}`} className={`btn btn-sm ${!list ? "btn-primary" : "btn-ghost"}`}>Colonnes</Link>
          <Link href={`?min=${min}&masquer=${hideFailed ? 1 : ""}&vue=liste`} className={`btn btn-sm ${list ? "btn-primary" : "btn-ghost"}`}>Liste</Link>
        </span>
      </form>

      <form id="bulk" action={bulkMove} className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-soft">Pour les candidats cochés :</span>
        <select name="stage" className="input w-auto py-1.5" aria-label="Étape cible" defaultValue="preselection">
          {STAGES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm">Déplacer</button>
      </form>

      {list ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line text-left text-ink-soft">
              <tr><th className="p-3"><span className="sr-only">Sélection</span></th><th className="p-3">Candidat</th><th className="p-3">Score</th><th className="p-3">Étape</th><th className="p-3">Reçue</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {cards.map((c) => (
                <tr key={c.id}>
                  <td className="p-3"><input type="checkbox" name="ids" value={c.id} form="bulk" aria-label={`Sélectionner ${name(c)}`} /></td>
                  <td className="p-3">
                    <Link href={`/recruteur/candidatures/${c.id}`} className="font-semibold hover:text-indigo">{name(c)}</Link>
                    <span className="block text-ink-soft">{c.title}{c.city && `, ${c.city}`}</span>
                    {c.failed_screening && <span className="chip mt-1 bg-clay-soft text-clay">Présélection non validée</span>}
                  </td>
                  <td className="p-3 font-semibold">{c.score} %</td>
                  <td className="p-3"><StageSelect id={c.id} stage={c.stage} /></td>
                  <td className="p-3 text-ink-soft">{since(c.created_at)}{!c.viewed_at && <span className="chip ml-2 bg-saffron-soft text-ochre">Non lue</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4">
          <div className="flex gap-3">
            {STAGES.map((s) => {
              const col = cards.filter((c) => c.stage === s.code);
              return (
                <section key={s.code} className="w-64 shrink-0 rounded-xl bg-wash p-2" aria-label={s.label}>
                  <h2 className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold">
                    {s.label}<span className="text-ink-soft">{col.length}</span>
                  </h2>
                  <ul className="space-y-2">
                    {col.map((c) => (
                      <li key={c.id} className="card p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <input type="checkbox" name="ids" value={c.id} form="bulk" className="mt-1" aria-label={`Sélectionner ${name(c)}`} />
                          <div className="min-w-0 flex-1">
                            <Link href={`/recruteur/candidatures/${c.id}`} className="block truncate font-semibold hover:text-indigo">{name(c)}</Link>
                            <span className="block truncate text-xs text-ink-soft">{c.title || "Profil sans titre"}</span>
                          </div>
                          <span className={`chip shrink-0 ${c.score >= 70 ? "bg-leaf-soft text-leaf" : ""}`}>{c.score} %</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {!c.viewed_at && <span className="chip bg-saffron-soft text-ochre">Non lue</span>}
                          {c.failed_screening && <span className="chip bg-clay-soft text-clay">Présélection non validée</span>}
                          {c.notes > 0 && <span className="chip">{c.notes} note{c.notes > 1 ? "s" : ""}</span>}
                        </div>
                        <div className="mt-2"><StageSelect id={c.id} stage={c.stage} /></div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}
      {!cards.length && <p className="card p-6 text-center text-ink-soft">Aucune candidature pour ces critères.</p>}
    </div>
  );
}

function StageSelect({ id, stage }: { id: string; stage: string }) {
  return (
    <form action={moveApplication} className="flex gap-1">
      <input type="hidden" name="id" value={id} />
      <select name="stage" defaultValue={stage} className="input py-1 text-xs" aria-label="Changer d'étape">
        {STAGES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
      </select>
      <button className="btn btn-ghost btn-sm px-2 text-xs">OK</button>
    </form>
  );
}
