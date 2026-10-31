import { requirePartnerStaff } from "@/lib/auth";
import { SideNav } from "@/components/SideNav";

export default async function PartnersLayout({ children }: { children: React.ReactNode }) {
  await requirePartnerStaff();
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[210px_1fr]">
      <div className="space-y-4">
        <div className="hidden rounded-xl bg-gradient-to-br from-indigo-strong to-indigo p-4 text-white lg:block">
          <p className="font-display font-bold">Gestion des partenaires</p>
          <p className="mt-1 text-sm text-white/75">Inscriptions, comptes, support et visibilité des entreprises clientes.</p>
        </div>
        <SideNav
          label="Gestion des partenaires"
          items={[
            { href: "/partenaires", label: "Tableau de bord" },
            { href: "/partenaires/inscriptions", label: "Inscriptions à vérifier" },
            { href: "/partenaires/entreprises", label: "Portefeuille entreprises" },
            { href: "/partenaires/support", label: "Support et SAV" },
            { href: "/partenaires/mises-en-avant", label: "Mises en avant" },
            { href: "/partenaires/mon-compte", label: "Mon compte" },
          ]}
        />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
