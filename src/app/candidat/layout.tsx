import { requireUser } from "@/lib/auth";
import { SideNav } from "@/components/SideNav";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["candidate"]);
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[220px_1fr]">
      <SideNav
        label="Espace candidat"
        items={[
          { href: "/candidat", label: "Mon espace" },
          { href: "/candidat/profil", label: "Mon profil et CV" },
          { href: "/candidat/candidatures", label: "Mes candidatures" },
          { href: "/candidat/sauvegardees", label: "Offres sauvegardées" },
          { href: "/candidat/test/resultats", label: "Test de personnalité" },
          { href: "/candidat/alertes", label: "Mes alertes" },
          { href: "/candidat/entreprises", label: "Entreprises suivies" },
          { href: "/candidat/notifications", label: "Notifications" },
          { href: "/candidat/parametres", label: "Paramètres" },
        ]}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
