import Link from "next/link";
import { requireRecruiter } from "@/lib/auth";
import { one } from "@/lib/db";
import { ActionForm, Submit } from "@/components/Form";
import { updateCompany } from "@/app/actions/recruiter";
import { COMPANY_STATUS_LABELS } from "@/lib/ref";

export const metadata = { title: "Page entreprise" };

export default async function CompanyEditPage() {
  const { company } = await requireRecruiter();
  const c = (await one<{ name: string; slug: string; city: string; description: string; culture: string; benefits: string; website: string; brand_color: string; status: string }>(
    `SELECT name,slug,city,description,culture,benefits,website,brand_color,status FROM companies WHERE id=$1`,
    [company.company_id],
  ))!;
  const readOnly = company.role !== "admin";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Page entreprise</h1>
          <p className="mt-1 text-ink-soft">Statut : {COMPANY_STATUS_LABELS[c.status]}. Cette page est visible par les candidats sur chacune de vos offres.</p>
        </div>
        {c.status === "verified" && <Link href={`/entreprises/${c.slug}`} className="btn btn-ghost btn-sm">Voir la page publique</Link>}
      </div>
      <ActionForm action={updateCompany} className="card grid gap-4 p-5 sm:grid-cols-2">
        <label className="block">
          <span className="label">Raison sociale</span>
          <input value={c.name} disabled className="input bg-wash" />
          <span className="hint">Pour la modifier, écrivez au support.</span>
        </label>
        <label className="block">
          <span className="label">Ville du siège</span>
          <input name="city" defaultValue={c.city} className="input" disabled={readOnly} />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Présentation</span>
          <textarea name="description" defaultValue={c.description} maxLength={3000} className="input min-h-32" disabled={readOnly} placeholder="Activité, chiffres clés, implantations." />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Culture et façon de travailler</span>
          <textarea name="culture" defaultValue={c.culture} maxLength={2000} className="input min-h-24" disabled={readOnly} />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Avantages proposés aux salariés</span>
          <textarea name="benefits" defaultValue={c.benefits} maxLength={2000} className="input min-h-20" disabled={readOnly} />
        </label>
        <label className="block">
          <span className="label">Site web</span>
          <input name="website" defaultValue={c.website} className="input" placeholder="https://" disabled={readOnly} />
        </label>
        <label className="block">
          <span className="label">Couleur de la marque</span>
          <input name="brand_color" type="color" defaultValue={c.brand_color} className="h-11 w-24 rounded-lg border border-line" disabled={readOnly} />
        </label>
        {!readOnly && <div className="sm:col-span-2"><Submit>Enregistrer la page</Submit></div>}
        {readOnly && <p className="text-sm text-ink-soft sm:col-span-2">Seul un administrateur de l&apos;entreprise peut modifier cette page.</p>}
      </ActionForm>
    </div>
  );
}
