import { requireUser } from "@/lib/auth";
import { loadProfile, completeness } from "@/lib/profile";
import { getRefs } from "@/lib/refdata";
import { ActionForm, Submit } from "@/components/Form";
import { EXPERIENCE_LEVELS, STUDY_LEVELS, SALARY_BANDS, LANGUAGES, LANGUAGE_LEVELS } from "@/lib/ref";
import { shortDate } from "@/lib/format";
import {
  updateIdentity, updateSummary, updateWishes, addExperience, addEducation, addSkill, addLanguage,
  removeProfileItem, uploadDocument, setPrimaryDocument,
} from "@/app/actions/candidate";

export const metadata = { title: "Mon profil et CV" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const { bienvenue } = await searchParams;
  const u = await requireUser(["candidate"]);
  const data = await loadProfile(u.id);
  const p = data.profile!;
  const { countries, functions } = await getRefs();
  const comp = completeness(data);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon profil et CV</h1>
        <p className="mt-1 text-ink-soft">Votre profil sert de CV en ligne. Il est complété à {comp.percent} %.</p>
        {bienvenue && (
          <p className="mt-4 rounded-lg border border-[#bfe0cf] bg-leaf-soft p-3 text-sm text-leaf">
            Votre compte est créé. Ajoutez votre CV et vos souhaits pour recevoir des offres qui vous correspondent.
          </p>
        )}
      </div>

      <Block title="Documents attachés" id="documents" hint="PDF, DOC, DOCX ou photo de votre CV, 5 Mo maximum. Le CV principal est envoyé par défaut quand vous postulez.">
        <ul className="divide-y divide-line">
          {data.documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="min-w-0">
                <a href={`/api/documents/${d.id}`} className="font-medium text-indigo hover:underline">{d.filename}</a>
                <span className="block text-xs text-muted">
                  {d.kind === "cv" ? "CV" : "Autre document"}, {Math.ceil(d.size / 1024)} Ko, ajouté le {shortDate(d.created_at)}
                </span>
              </span>
              <span className="flex gap-2">
                {d.is_primary ? (
                  <span className="chip bg-leaf-soft text-leaf">CV principal</span>
                ) : (
                  <form action={setPrimaryDocument}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="btn btn-ghost btn-sm">Utiliser comme CV principal</button>
                  </form>
                )}
                <RemoveButton kind="document" id={d.id} label="Supprimer" />
              </span>
            </li>
          ))}
        </ul>
        <ActionForm action={uploadDocument} className="mt-3 grid gap-3 rounded-lg bg-wash p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end" resetOnSuccess>
          <label className="block">
            <span className="label">Fichier</span>
            <input type="file" name="file" required accept=".pdf,.doc,.docx,image/jpeg,image/png" className="block w-full text-sm" />
          </label>
          <label className="block">
            <span className="label">Type</span>
            <select name="kind" className="input">
              <option value="cv">CV</option>
              <option value="other">Lettre, attestation, portfolio…</option>
            </select>
          </label>
          <Submit className="btn btn-primary" pendingLabel="Envoi…">Ajouter</Submit>
        </ActionForm>
      </Block>

      <Block title="Informations personnelles">
        <ActionForm action={updateIdentity} className="grid gap-4 sm:grid-cols-2">
          <Input name="first_name" label="Prénom" value={u.first_name} required />
          <Input name="last_name" label="Nom" value={u.last_name} required />
          <Input name="title" label="Titre du profil" value={p.title} placeholder="ex. Comptable confirmé, Ingénieur réseau" full />
          <Input name="phone" label="Téléphone" value={u.phone} required type="tel" />
          <label className="block">
            <span className="label">Pays de résidence</span>
            <select name="country_code" defaultValue={u.country_code ?? "SN"} className="input">
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
          <Input name="city" label="Ville" value={p.city} />
          <Input name="nationality" label="Nationalité" value={p.nationality} />
          <Input name="birth_date" label="Date de naissance" value={p.birth_date ? new Date(p.birth_date).toISOString().slice(0, 10) : ""} type="date" />
          <Input name="linkedin_url" label="Profil LinkedIn" value={p.linkedin_url} placeholder="https://www.linkedin.com/in/…" />
          <div className="sm:col-span-2"><Submit>Enregistrer</Submit></div>
        </ActionForm>
      </Block>

      <Block title="Résumé" hint="Trois ou quatre phrases : votre métier, vos années d'expérience, vos réalisations marquantes.">
        <ActionForm action={updateSummary} className="space-y-3">
          <textarea name="summary" defaultValue={p.summary} maxLength={1500} className="input" />
          <Submit>Enregistrer le résumé</Submit>
        </ActionForm>
      </Block>

      <Block title="Profil et souhaits" hint="Ces informations alimentent le score de correspondance sur chaque offre.">
        <ActionForm action={updateWishes} className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Niveau d&apos;expérience</span>
            <select name="experience_level" defaultValue={p.experience_level} className="input">
              <option value="">Choisir</option>
              {EXPERIENCE_LEVELS.map((e) => <option key={e.code} value={e.code}>{e.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Niveau d&apos;études</span>
            <select name="study_level" defaultValue={p.study_level} className="input">
              <option value="">Choisir</option>
              {STUDY_LEVELS.map((e) => <option key={e.code} value={e.code}>{e.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Fonction actuelle</span>
            <select name="current_function_id" defaultValue={p.current_function_id ?? ""} className="input">
              <option value="">Choisir</option>
              {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Disponibilité</span>
            <select name="availability" defaultValue={p.availability} className="input">
              <option value="">Choisir</option>
              {["Immédiate", "Sous 1 mois", "Sous 3 mois", "En veille"].map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          {[0, 1, 2].map((i) => (
            <label key={i} className="block">
              <span className="label">Fonction recherchée {i + 1}{i > 0 && " (facultatif)"}</span>
              <select name="desired_function_ids" defaultValue={p.desired_function_ids[i] ?? ""} className="input">
                <option value="">Choisir</option>
                {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
          ))}
          <fieldset className="sm:col-span-2">
            <legend className="label">Pays où vous cherchez un emploi</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {countries.map((c) => (
                <label key={c.code} className="flex items-center gap-1.5">
                  <input type="checkbox" name="search_countries" value={c.code} defaultChecked={p.search_countries.includes(c.code)} /> {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="label">Salaire actuel (net mensuel)</span>
            <select name="current_salary" defaultValue={p.current_salary} className="input">
              <option value="">Ne pas indiquer</option>
              {SALARY_BANDS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Salaire souhaité (net mensuel)</span>
            <select name="desired_salary" defaultValue={p.desired_salary} className="input">
              <option value="">Ne pas indiquer</option>
              {SALARY_BANDS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2"><Submit>Enregistrer mes souhaits</Submit></div>
        </ActionForm>
      </Block>

      <Block title="Expériences">
        <ul className="divide-y divide-line">
          {data.experiences.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-3">
              <span>
                <span className="block font-semibold">{e.title}</span>
                <span className="block text-sm text-ink-soft">{e.company}{e.city && `, ${e.city}`}</span>
                <span className="block text-xs text-muted">
                  {monthYear(e.start_date)} à {e.end_date ? monthYear(e.end_date) : "aujourd'hui"}
                </span>
                {e.description && <span className="mt-1 block text-sm text-ink-soft">{e.description}</span>}
              </span>
              <RemoveButton kind="experience" id={e.id} />
            </li>
          ))}
        </ul>
        <details className="mt-3">
          <summary className="btn btn-ghost btn-sm">Ajouter une expérience</summary>
          <ActionForm action={addExperience} className="mt-3 grid gap-3 rounded-lg bg-wash p-4 sm:grid-cols-2" resetOnSuccess>
            <Input name="title" label="Poste occupé" required />
            <Input name="company" label="Entreprise ou organisation" required />
            <Input name="city" label="Ville" />
            <span />
            <Input name="start_date" label="Début" type="month" required />
            <Input name="end_date" label="Fin (vide si poste actuel)" type="month" />
            <label className="block sm:col-span-2">
              <span className="label">Missions et réalisations</span>
              <textarea name="description" className="input min-h-20" maxLength={2000} />
            </label>
            <div className="sm:col-span-2"><Submit>Ajouter l&apos;expérience</Submit></div>
          </ActionForm>
        </details>
      </Block>

      <Block title="Formations">
        <ul className="divide-y divide-line">
          {data.educations.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-3">
              <span>
                <span className="block font-semibold">{e.degree}{e.field && `, ${e.field}`}</span>
                <span className="block text-sm text-ink-soft">{e.school}{e.year_end && `, ${e.year_end}`}</span>
              </span>
              <RemoveButton kind="education" id={e.id} />
            </li>
          ))}
        </ul>
        <details className="mt-3">
          <summary className="btn btn-ghost btn-sm">Ajouter une formation</summary>
          <ActionForm action={addEducation} className="mt-3 grid gap-3 rounded-lg bg-wash p-4 sm:grid-cols-2" resetOnSuccess>
            <Input name="degree" label="Diplôme" required placeholder="ex. Master, BTS, Licence" />
            <Input name="field" label="Spécialité" />
            <Input name="school" label="Établissement" required />
            <Input name="year_end" label="Année d'obtention" type="number" />
            <div className="sm:col-span-2"><Submit>Ajouter la formation</Submit></div>
          </ActionForm>
        </details>
      </Block>

      <div className="grid gap-6 md:grid-cols-2">
        <Block title="Compétences">
          <ul className="flex flex-wrap gap-1.5">
            {data.skills.map((s) => (
              <li key={s.name} className="chip pr-1">
                {s.name}
                <form action={removeProfileItem}>
                  <input type="hidden" name="kind" value="skill" />
                  <input type="hidden" name="id" value={s.name} />
                  <button className="grid h-5 w-5 place-items-center rounded-full hover:bg-white" aria-label={`Retirer ${s.name}`}>×</button>
                </form>
              </li>
            ))}
          </ul>
          <ActionForm action={addSkill} className="mt-3 flex gap-2" resetOnSuccess>
            <input name="name" className="input" placeholder="ex. Excel, SYSCOHADA, Python" aria-label="Compétences, séparées par des virgules" />
            <Submit className="btn btn-ghost">Ajouter</Submit>
          </ActionForm>
        </Block>

        <Block title="Langues">
          <ul className="space-y-1">
            {data.languages.map((l) => (
              <li key={l.name} className="flex items-center justify-between text-sm">
                <span><strong>{l.name}</strong>, {l.level.toLowerCase()}</span>
                <RemoveButton kind="language" id={l.name} />
              </li>
            ))}
          </ul>
          <ActionForm action={addLanguage} className="mt-3 flex gap-2" resetOnSuccess>
            <select name="name" className="input" aria-label="Langue" defaultValue="">
              <option value="" disabled>Langue</option>
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
            <select name="level" className="input" aria-label="Niveau" defaultValue="">
              <option value="" disabled>Niveau</option>
              {LANGUAGE_LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
            <Submit className="btn btn-ghost">Ajouter</Submit>
          </ActionForm>
        </Block>
      </div>
    </div>
  );
}

function monthYear(d: string) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(d));
}

function Block({ title, children, hint, id }: { title: string; children: React.ReactNode; hint?: string; id?: string }) {
  return (
    <section id={id} className="card scroll-mt-24 p-5 sm:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {hint && <p className="mb-3 mt-1 text-sm text-ink-soft">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Input({ name, label, value, type = "text", required, placeholder, full }: { name: string; label: string; value?: string | number | null; type?: string; required?: boolean; placeholder?: string; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="label">{label}</span>
      <input name={name} type={type} defaultValue={value ?? ""} required={required} placeholder={placeholder} className="input" />
    </label>
  );
}

function RemoveButton({ kind, id, label = "Retirer" }: { kind: string; id: string; label?: string }) {
  return (
    <form action={removeProfileItem}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-danger btn-sm">{label}</button>
    </form>
  );
}
