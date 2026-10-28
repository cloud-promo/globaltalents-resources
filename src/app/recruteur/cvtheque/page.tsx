import Link from "next/link";
import { requireRecruiter } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getRefs } from "@/lib/refdata";
import { EXPERIENCE_LEVELS, STUDY_LEVELS, LANGUAGES, labelOf } from "@/lib/ref";
import { since } from "@/lib/format";
import { unlockCandidate } from "@/app/actions/recruiter";

export const metadata = { title: "CVthèque" };

type SP = { q?: string; pays?: string; fonction?: string; experience?: string; etudes?: string; langue?: string; dispo?: string; page?: string };
type Row = {
  user_id: string; title: string; city: string; country_code: string; experience_level: string; study_level: string; availability: string;
  updated_at: string; skills: string[]; first_name: string; last_name: string; email: string; phone: string; unlocked: boolean;
  doc_id: string | null; total: number;
};

export default async function CvthequePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { company } = await requireRecruiter();
  const { countries, functions } = await getRefs();
  const params: unknown[] = [company.company_id];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  const where = ["cp.visible_cvtheque", "NOT u.suspended"];
  if (sp.q?.trim()) {
    const v = `%${sp.q.trim().slice(0, 80)}%`;
    where.push(`(cp.title ILIKE ${p(v)} OR cp.summary ILIKE ${p(v)} OR EXISTS (SELECT 1 FROM candidate_skills s WHERE s.user_id=u.id AND s.name ILIKE ${p(v)}))`);
  }
  if (sp.pays) where.push(`(u.country_code=${p(sp.pays)} OR ${p(sp.pays)}=ANY(cp.search_countries))`);
  if (sp.fonction) { const f = Number(sp.fonction) || 0; where.push(`(cp.current_function_id=${p(f)} OR ${p(f)}=ANY(cp.desired_function_ids))`); }
  if (sp.experience) where.push(`cp.experience_level=${p(sp.experience)}`);
  if (sp.etudes) where.push(`cp.study_level=${p(sp.etudes)}`);
  if (sp.dispo) where.push(`cp.availability=${p(sp.dispo)}`);
  if (sp.langue) where.push(`EXISTS (SELECT 1 FROM candidate_languages l WHERE l.user_id=u.id AND l.name=${p(sp.langue)})`);
  const page = Math.max(1, Number(sp.page) || 1);

  const [rows, c] = await Promise.all([
    query<Row>(
      `SELECT u.id user_id,cp.title,cp.city,u.country_code,cp.experience_level,cp.study_level,cp.availability,cp.updated_at,
         ARRAY(SELECT name FROM candidate_skills s WHERE s.user_id=u.id ORDER BY name LIMIT 8) skills,
         u.first_name,u.last_name,u.email,u.phone,
         EXISTS (SELECT 1 FROM cv_unlocks x WHERE x.company_id=$1 AND x.candidate_id=u.id) unlocked,
         (SELECT d.id FROM documents d WHERE d.user_id=u.id AND d.kind='cv' ORDER BY d.is_primary DESC, d.created_at DESC LIMIT 1) doc_id,
         count(*) OVER()::int total
       FROM users u JOIN candidate_profiles cp ON cp.user_id=u.id
       WHERE ${where.join(" AND ")} ORDER BY cp.updated_at DESC LIMIT 20 OFFSET ${(page - 1) * 20}`,
      params,
    ),
    one<{ cv_credits: number; unlimited: boolean }>(`SELECT cv_credits,(cv_unlimited_until>now()) unlimited FROM companies WHERE id=$1`, [company.company_id]),
  ]);
  const total = rows[0]?.total ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">CVthèque</h1>
        <p className="mt-1 text-ink-soft">
          {total} profil{total > 1 ? "s" : ""} visible{total > 1 ? "s" : ""}. Coordonnées et CV se débloquent profil par profil.{" "}
          {c?.unlimited ? "Votre accès est illimité." : `Il vous reste ${c?.cv_credits ?? 0} crédit${(c?.cv_credits ?? 0) > 1 ? "s" : ""}.`}{" "}
          {!c?.unlimited && <Link href="/recruteur/abonnement" className="font-semibold text-indigo hover:underline">Obtenir un accès illimité</Link>}
        </p>
      </div>
      <form className="card grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        <input name="q" defaultValue={sp.q} className="input sm:col-span-2" placeholder="Poste, compétence ou mot-clé" aria-label="Mots-clés" />
        <Sel name="pays" label="Pays" value={sp.pays} options={countries.map((x) => [x.code, x.name])} />
        <Sel name="fonction" label="Fonction" value={sp.fonction} options={functions.map((f) => [String(f.id), f.name])} />
        <Sel name="experience" label="Expérience" value={sp.experience} options={EXPERIENCE_LEVELS.map((e) => [e.code, e.label])} />
        <Sel name="etudes" label="Études" value={sp.etudes} options={STUDY_LEVELS.map((e) => [e.code, e.label])} />
        <Sel name="langue" label="Langue" value={sp.langue} options={LANGUAGES.map((l) => [l, l])} />
        <Sel name="dispo" label="Disponibilité" value={sp.dispo} options={["Immédiate", "Sous 1 mois", "Sous 3 mois", "En veille"].map((d) => [d, d])} />
        <button className="btn btn-primary">Rechercher</button>
      </form>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.user_id} className="card flex flex-wrap items-start justify-between gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.unlocked ? `${r.first_name} ${r.last_name}` : r.title || "Profil sans titre"}</p>
              {r.unlocked && r.title && <p className="text-sm">{r.title}</p>}
              <p className="text-sm text-ink-soft">
                {[r.city, countries.find((x) => x.code === r.country_code)?.name, labelOf(EXPERIENCE_LEVELS, r.experience_level), labelOf(STUDY_LEVELS, r.study_level)].filter(Boolean).join(", ")}
              </p>
              {r.skills.length > 0 && <ul className="mt-2 flex flex-wrap gap-1">{r.skills.map((s) => <li key={s} className="chip">{s}</li>)}</ul>}
              <p className="mt-2 text-xs text-muted">{r.availability && `Disponibilité : ${r.availability.toLowerCase()}. `}Profil mis à jour {since(r.updated_at)}.</p>
            </div>
            <div className="text-sm">
              {r.unlocked ? (
                <div className="space-y-1 text-right">
                  <p><a href={`mailto:${r.email}`} className="text-indigo hover:underline">{r.email}</a></p>
                  <p>{r.phone}</p>
                  {r.doc_id && <a href={`/api/documents/${r.doc_id}`} target="_blank" className="btn btn-ghost btn-sm mt-1">Ouvrir le CV</a>}
                </div>
              ) : (
                <form action={unlockCandidate}>
                  <input type="hidden" name="candidate_id" value={r.user_id} />
                  <button className="btn btn-primary btn-sm">{c?.unlimited ? "Voir les coordonnées" : "Débloquer (1 crédit)"}</button>
                </form>
              )}
            </div>
          </li>
        ))}
        {!rows.length && <li className="card p-6 text-center text-ink-soft">Aucun profil ne correspond. Élargissez vos critères.</li>}
      </ul>
      {total > 20 && (
        <nav className="flex justify-center gap-2" aria-label="Pagination">
          {page > 1 && <Link className="btn btn-ghost btn-sm" href={`?${new URLSearchParams({ ...sp, page: String(page - 1) } as Record<string, string>)}`}>Page précédente</Link>}
          {page * 20 < total && <Link className="btn btn-ghost btn-sm" href={`?${new URLSearchParams({ ...sp, page: String(page + 1) } as Record<string, string>)}`}>Page suivante</Link>}
        </nav>
      )}
    </div>
  );
}

function Sel({ name, label, value, options }: { name: string; label: string; value?: string; options: string[][] }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="input" aria-label={label}>
      <option value="">{label} : tous</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
