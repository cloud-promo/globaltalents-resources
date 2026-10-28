import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getRefs } from "@/lib/refdata";
import { shortDate } from "@/lib/format";
import { EXPERIENCE_LEVELS, STUDY_LEVELS, labelOf } from "@/lib/ref";
import { updateAlert } from "@/app/actions/candidate";

export const metadata = { title: "Mes alertes" };

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ cree?: string }> }) {
  const { cree } = await searchParams;
  const u = await requireUser(["candidate"]);
  const alerts = await query<{ id: number; name: string; query: Record<string, string>; email: boolean; whatsapp: boolean; created_at: string }>(
    `SELECT id,name,query,email,whatsapp,created_at FROM alerts WHERE user_id=$1 ORDER BY created_at DESC`,
    [u.id],
  );
  const { countries, functions, sectors } = await getRefs();
  const describe = (q: Record<string, string>) =>
    [
      q.q && `« ${q.q} »`,
      q.pays && countries.find((c) => c.code === q.pays)?.name,
      q.ville,
      q.fonction && functions.find((f) => String(f.id) === q.fonction)?.name,
      q.secteur && sectors.find((s) => String(s.id) === q.secteur)?.name,
      q.contrat,
      q.experience && labelOf(EXPERIENCE_LEVELS, q.experience),
      q.etudes && labelOf(STUDY_LEVELS, q.etudes),
    ].filter(Boolean).join(", ") || "Toutes les offres";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Mes alertes</h1>
        <p className="mt-1 text-ink-soft">Deux types d&apos;alertes vous préviennent des nouvelles offres.</p>
      </div>
      {cree && <p className="rounded-lg border border-[#bfe0cf] bg-leaf-soft p-3 text-sm text-leaf">Alerte créée. Vous recevrez les nouvelles offres de cette recherche.</p>}

      <section className="card p-5">
        <h2 className="font-semibold">Alerte automatique selon votre profil</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Chaque soir, les nouvelles offres dont la correspondance avec votre profil dépasse 60 %. Pour l&apos;ajuster, mettez à jour vos souhaits dans votre profil.
        </p>
        <Link href="/candidat/profil" className="btn btn-ghost btn-sm mt-3">Modifier mes souhaits</Link>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Alertes personnalisées</h2>
        <p className="mt-1 text-sm text-ink-soft">Lancez une recherche, ajoutez des filtres, puis cliquez sur « Créer l&apos;alerte » dans la colonne des filtres.</p>
        <ul className="mt-4 divide-y divide-line">
          {alerts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <form action={updateAlert} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="op" value="rename" />
                  <input name="name" defaultValue={a.name} className="input w-56 py-1 font-semibold" aria-label="Nom de l'alerte" maxLength={80} />
                  <button className="text-sm text-indigo hover:underline">Renommer</button>
                </form>
                <p className="mt-1 text-sm text-ink-soft">{describe(a.query)}</p>
                <p className="text-xs text-muted">Créée le {shortDate(a.created_at)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/offres?${new URLSearchParams(a.query).toString()}`} className="btn btn-ghost btn-sm">Voir les offres</Link>
                <Toggle id={a.id} op="toggle_email" on={a.email} label="E-mail" />
                <Toggle id={a.id} op="toggle_whatsapp" on={a.whatsapp} label="WhatsApp" />
                <form action={updateAlert}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="op" value="delete" />
                  <button className="btn btn-danger btn-sm">Supprimer</button>
                </form>
              </div>
            </li>
          ))}
          {!alerts.length && <li className="py-4 text-sm text-ink-soft">Aucune alerte personnalisée.</li>}
        </ul>
      </section>
    </div>
  );
}

function Toggle({ id, op, on, label }: { id: number; op: string; on: boolean; label: string }) {
  return (
    <form action={updateAlert}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <button className={`btn btn-sm ${on ? "btn-primary" : "btn-ghost"}`} aria-pressed={on}>
        {label} {on ? "activé" : "désactivé"}
      </button>
    </form>
  );
}
