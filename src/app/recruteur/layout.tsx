import { requireRecruiter } from "@/lib/auth";
import { one } from "@/lib/db";
import { SideNav } from "@/components/SideNav";

export default async function RecruiterLayout({ children }: { children: React.ReactNode }) {
  const { company } = await requireRecruiter();
  const c = await one<{ job_credits: number; cv_credits: number; cv_unlimited: boolean }>(
    `SELECT job_credits,cv_credits,(cv_unlimited_until>now()) cv_unlimited FROM companies WHERE id=$1`,
    [company.company_id],
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {company.status !== "verified" && (
        <p className="mb-6 rounded-lg border border-[#efd8a6] bg-saffron-soft p-3 text-sm">
          {company.status === "pending"
            ? "Votre entreprise est en cours de vérification. Vous pouvez déjà préparer vos offres : elles seront publiées dès la validation."
            : "Votre entreprise n'a pas été validée. Contactez entreprises@globaltalents-resources.com."}
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <div className="space-y-4">
          <div className="hidden rounded-xl bg-indigo p-4 text-white lg:block">
            <p className="font-display font-bold">{company.name}</p>
            <p className="mt-2 text-sm text-white/80">
              {c?.job_credits ?? 0} crédit{(c?.job_credits ?? 0) > 1 ? "s" : ""} d&apos;annonce
              <br />
              {c?.cv_unlimited ? "CVthèque illimitée" : `${c?.cv_credits ?? 0} profil${(c?.cv_credits ?? 0) > 1 ? "s" : ""} CVthèque`}
            </p>
          </div>
          <SideNav
            label="Espace recruteur"
            items={[
              { href: "/recruteur", label: "Tableau de bord" },
              { href: "/recruteur/offres", label: "Mes offres" },
              { href: "/recruteur/offres/nouvelle", label: "Publier une offre" },
              { href: "/recruteur/cvtheque", label: "CVthèque" },
              { href: "/recruteur/entreprise", label: "Page entreprise" },
              { href: "/recruteur/equipe", label: "Équipe" },
              { href: "/recruteur/abonnement", label: "Abonnement et factures" },
            ]}
          />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
