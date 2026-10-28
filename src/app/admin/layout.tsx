import { requireUser } from "@/lib/auth";
import { SideNav } from "@/components/SideNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["admin", "moderator"]);
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[200px_1fr]">
      <SideNav
        label="Administration"
        items={[
          { href: "/admin", label: "Vue d'ensemble" },
          { href: "/admin/offres", label: "Modération des offres" },
          { href: "/admin/entreprises", label: "Entreprises" },
          { href: "/admin/utilisateurs", label: "Utilisateurs" },
          { href: "/admin/paiements", label: "Paiements" },
          { href: "/admin/articles", label: "Articles" },
          { href: "/admin/audit", label: "Journal d'audit" },
        ]}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
