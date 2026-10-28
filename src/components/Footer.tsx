import Link from "next/link";
import { Logo } from "./Logo";

const COUNTRIES = [
  ["SN", "au Sénégal"],
  ["CI", "en Côte d'Ivoire"],
  ["ML", "au Mali"],
  ["BF", "au Burkina Faso"],
  ["NE", "au Niger"],
  ["GN", "en Guinée"],
];

export function Footer() {
  return (
    <footer className="mt-20 bg-indigo-strong text-white/80">
      <div className="weave h-2" aria-hidden="true" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm">
            Recrutement et gestion RH pour le Sénégal, la Côte d&apos;Ivoire, le Mali, le Burkina Faso, le Niger et la Guinée.
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">Emploi par pays</h2>
          <ul className="space-y-1.5 text-sm">
            {COUNTRIES.map(([code, name]) => (
              <li key={code}>
                <Link href={`/offres?pays=${code}`} className="hover:text-white">
                  Emploi {name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">Candidats et recruteurs</h2>
          <ul className="space-y-1.5 text-sm">
            <li><Link href="/inscription" className="hover:text-white">Créer un compte candidat</Link></li>
            <li><Link href="/recruteurs" className="hover:text-white">Publier une offre</Link></li>
            <li><Link href="/recruteurs#tarifs" className="hover:text-white">Tarifs recruteurs</Link></li>
            <li><Link href="/entreprises" className="hover:text-white">Entreprises qui recrutent</Link></li>
            <li><Link href="/conseils" className="hover:text-white">Conseils carrière</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">Informations</h2>
          <ul className="space-y-1.5 text-sm">
            <li><Link href="/infos/a-propos" className="hover:text-white">À propos</Link></li>
            <li><Link href="/infos/faq" className="hover:text-white">Questions fréquentes</Link></li>
            <li><Link href="/infos/cgu" className="hover:text-white">Conditions d&apos;utilisation</Link></li>
            <li><Link href="/infos/confidentialite" className="hover:text-white">Protection des données</Link></li>
            <li><Link href="/infos/contact" className="hover:text-white">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-white/60">
          © {new Date().getFullYear()} Global Talents Resources. Une société du groupe Global, aux côtés de Global Cyberock et de Global Finance, Immo et Négoce.
        </p>
      </div>
    </footer>
  );
}
