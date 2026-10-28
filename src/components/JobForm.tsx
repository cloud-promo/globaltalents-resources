import { ActionForm } from "@/components/Form";
import { saveJob } from "@/app/actions/recruiter";
import { CONTRACT_TYPES, EXPERIENCE_LEVELS, STUDY_LEVELS, REMOTE_OPTIONS, LANGUAGES } from "@/lib/ref";
import type { Country, Named, City } from "@/lib/refdata";

export type JobFormValues = {
  id?: number;
  status?: string;
  title?: string;
  function_id?: number | null;
  sector_id?: number | null;
  country_code?: string;
  city?: string;
  contract_type?: string;
  experience_level?: string;
  study_level?: string;
  remote?: string;
  positions?: number;
  salary_min?: number | null;
  salary_max?: number | null;
  show_salary?: boolean;
  description?: string;
  profile?: string;
  benefits?: string;
  skills?: string[];
  languages?: string[];
  management?: boolean;
  confidential?: boolean;
  questions?: { question: string; eliminatory: boolean; expected: string }[];
};

export function JobForm({ v, refs, credits }: { v: JobFormValues; refs: { countries: Country[]; cities: City[]; functions: Named[]; sectors: Named[] }; credits: number }) {
  const isNew = !v.id;
  const needsCredit = isNew || v.status === "draft";
  return (
    <ActionForm action={saveJob} className="space-y-6">
      {v.id && <input type="hidden" name="job_id" value={v.id} />}
      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="text-lg font-bold sm:col-span-2">Le poste</h2>
        <label className="block sm:col-span-2">
          <span className="label">Intitulé du poste</span>
          <input name="title" defaultValue={v.title} required maxLength={140} className="input" placeholder="ex. Comptable confirmé" />
          <span className="hint">Utilisez le titre que les candidats recherchent, sans abréviation interne.</span>
        </label>
        <Sel name="function_id" label="Fonction" value={v.function_id} options={refs.functions.map((f) => [f.id, f.name])} />
        <Sel name="sector_id" label="Secteur" value={v.sector_id} options={refs.sectors.map((s) => [s.id, s.name])} />
        <Sel name="country_code" label="Pays" value={v.country_code} options={refs.countries.map((c) => [c.code, c.name])} />
        <label className="block">
          <span className="label">Ville</span>
          <input name="city" defaultValue={v.city} required list="villes" className="input" />
          <datalist id="villes">{refs.cities.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </label>
        <Sel name="contract_type" label="Type de contrat" value={v.contract_type} options={CONTRACT_TYPES.map((c) => [c, c])} />
        <Sel name="remote" label="Lieu de travail" value={v.remote ?? "non"} options={REMOTE_OPTIONS.map((r) => [r.code, r.label])} required={false} />
        <Sel name="experience_level" label="Expérience demandée" value={v.experience_level} options={EXPERIENCE_LEVELS.map((e) => [e.code, e.label])} />
        <Sel name="study_level" label="Niveau d'études" value={v.study_level} options={STUDY_LEVELS.map((e) => [e.code, e.label])} />
        <label className="block">
          <span className="label">Nombre de postes</span>
          <input name="positions" type="number" min={1} max={500} defaultValue={v.positions ?? 1} className="input" />
        </label>
        {isNew ? (
          <label className="block">
            <span className="label">Durée de publication</span>
            <select name="duration" defaultValue="56" className="input">
              <option value="15">15 jours</option>
              <option value="30">30 jours</option>
              <option value="45">45 jours</option>
              <option value="56">8 semaines</option>
            </select>
          </label>
        ) : (
          <input type="hidden" name="duration" value="56" />
        )}
        <fieldset className="sm:col-span-2">
          <legend className="label">Salaire mensuel net, en monnaie locale (facultatif)</legend>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
            <input name="salary_min" type="number" min={0} defaultValue={v.salary_min ?? ""} className="input" placeholder="Minimum" aria-label="Salaire minimum" />
            <input name="salary_max" type="number" min={0} defaultValue={v.salary_max ?? ""} className="input" placeholder="Maximum" aria-label="Salaire maximum" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="show_salary" defaultChecked={v.show_salary ?? true} /> Afficher le salaire</label>
          </div>
          <span className="hint">Les offres qui affichent un salaire reçoivent des candidatures plus ciblées.</span>
        </fieldset>
        <div className="flex flex-wrap gap-5 text-sm sm:col-span-2">
          <label className="flex items-center gap-2"><input type="checkbox" name="management" defaultChecked={v.management} /> Poste avec management d&apos;équipe</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="confidential" defaultChecked={v.confidential} /> Offre confidentielle (nom de l&apos;entreprise masqué)</label>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-bold">Description</h2>
        <label className="block">
          <span className="label">Missions</span>
          <textarea name="description" defaultValue={v.description} required minLength={80} maxLength={8000} className="input min-h-48"
            placeholder={"Présentez le contexte du poste en une ou deux phrases, puis les missions :\n- première mission\n- deuxième mission"} />
          <span className="hint">Une ligne qui commence par un tiret devient une puce.</span>
        </label>
        <label className="block">
          <span className="label">Profil recherché</span>
          <textarea name="profile" defaultValue={v.profile} maxLength={5000} className="input min-h-28" />
        </label>
        <label className="block">
          <span className="label">Compétences clés, séparées par des virgules</span>
          <input name="skills" defaultValue={v.skills?.join(", ")} className="input" placeholder="ex. SYSCOHADA, Sage, Excel" />
          <span className="hint">Elles servent au calcul du score de correspondance des candidats.</span>
        </label>
        <fieldset>
          <legend className="label">Langues demandées</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            {LANGUAGES.map((l) => (
              <label key={l} className="flex items-center gap-1.5">
                <input type="checkbox" name="languages" value={l} defaultChecked={v.languages?.includes(l)} /> {l}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="label">Avantages</span>
          <textarea name="benefits" defaultValue={v.benefits} maxLength={3000} className="input min-h-20" placeholder="ex. assurance maladie, transport, prime annuelle" />
        </label>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold">Questions de présélection</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Jusqu&apos;à 5 questions fermées (oui ou non). Une question éliminatoire signale les candidats qui ne donnent pas la réponse attendue.
        </p>
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => {
            const q = v.questions?.[i];
            return (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <input name={`question_${i}`} defaultValue={q?.question} maxLength={200} className="input" placeholder={i === 0 ? "ex. Êtes-vous disponible immédiatement ?" : `Question ${i + 1} (facultatif)`} aria-label={`Question ${i + 1}`} />
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name={`elim_${i}`} defaultChecked={q?.eliminatory} /> Éliminatoire</label>
                <select name={`expected_${i}`} defaultValue={q?.expected ?? "oui"} className="input w-auto py-1.5 text-sm" aria-label="Réponse attendue">
                  <option value="oui">Réponse attendue : oui</option>
                  <option value="non">Réponse attendue : non</option>
                </select>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button name="intent" value="submit" className="btn btn-primary">{isNew || v.status === "draft" ? "Envoyer en modération" : "Enregistrer les modifications"}</button>
        {(isNew || v.status === "draft") && <button name="intent" value="draft" className="btn btn-ghost">Enregistrer en brouillon</button>}
        {needsCredit && (
          <span className="text-sm text-ink-soft">
            {credits > 0 ? `Utilise 1 crédit d'annonce sur ${credits}.` : "Vous n'avez plus de crédit : enregistrez en brouillon puis achetez un pack."}
          </span>
        )}
      </div>
    </ActionForm>
  );
}

function Sel({ name, label, value, options, required = true }: { name: string; label: string; value?: string | number | null; options: (string | number)[][]; required?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select name={name} defaultValue={value ?? ""} required={required} className="input">
        <option value="" disabled>Choisir</option>
        {options.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
      </select>
    </label>
  );
}
