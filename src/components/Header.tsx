import Link from "next/link";
import { getUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { Logo } from "./Logo";
import { logout } from "@/app/actions/auth";

const NAV = [
  { href: "/offres", label: "Offres d'emploi" },
  { href: "/entreprises", label: "Entreprises" },
  { href: "/conseils", label: "Conseils" },
];

export async function Header() {
  const user = await getUser();
  const unread = user
    ? (await one<{ n: number }>(`SELECT count(*)::int n FROM notifications WHERE user_id=$1 AND read_at IS NULL`, [user.id]))?.n ?? 0
    : 0;
  const home =
    user?.role === "candidate" ? "/candidat" : user?.role === "recruiter" ? "/recruteur" : user ? "/admin" : null;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" aria-label="Accueil Global Talents Resources">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-5 text-[0.95rem] font-medium text-ink-soft md:flex" aria-label="Navigation principale">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-indigo">
              {n.label}
            </Link>
          ))}
          <Link href="/recruteurs" className="hover:text-indigo">
            Vous recrutez ?
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user && home ? (
            <>
              {user.role === "candidate" && (
                <Link href="/candidat/notifications" className="relative rounded-md px-2 py-1 text-sm text-ink-soft hover:text-indigo" aria-label={`Notifications, ${unread} non lues`}>
                  <BellIcon />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-saffron px-1 text-center text-[0.65rem] font-bold leading-4 text-ink">
                      {unread}
                    </span>
                  )}
                </Link>
              )}
              <details className="relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-sm font-medium">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo text-xs font-bold text-white">
                    {(user.first_name[0] || user.email[0]).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline">{user.first_name || "Mon compte"}</span>
                </summary>
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-white p-1 text-sm shadow-lg">
                  <Link href={home} className="block rounded-lg px-3 py-2 hover:bg-wash">
                    Mon espace
                  </Link>
                  {user.role === "candidate" && (
                    <>
                      <Link href="/candidat/profil" className="block rounded-lg px-3 py-2 hover:bg-wash">Mon profil</Link>
                      <Link href="/candidat/candidatures" className="block rounded-lg px-3 py-2 hover:bg-wash">Mes candidatures</Link>
                      <Link href="/candidat/parametres" className="block rounded-lg px-3 py-2 hover:bg-wash">Paramètres</Link>
                    </>
                  )}
                  <form action={logout}>
                    <button className="block w-full rounded-lg px-3 py-2 text-left text-clay hover:bg-clay-soft">Se déconnecter</button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/connexion" className="btn btn-ghost btn-sm">
                Se connecter
              </Link>
              <Link href="/inscription" className="btn btn-primary btn-sm hidden sm:inline-flex">
                Créer mon compte
              </Link>
            </>
          )}
          <details className="relative md:hidden">
            <summary className="list-none rounded-md p-2 text-ink-soft" aria-label="Menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-white p-1 text-sm shadow-lg">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-2 hover:bg-wash">{n.label}</Link>
              ))}
              <Link href="/recruteurs" className="block rounded-lg px-3 py-2 hover:bg-wash">Vous recrutez ?</Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
