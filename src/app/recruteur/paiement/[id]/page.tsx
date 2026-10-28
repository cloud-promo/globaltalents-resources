import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "@/lib/auth";
import { one } from "@/lib/db";
import { money } from "@/lib/format";
import { PAYMENT_PROVIDERS } from "@/lib/ref";
import { confirmDemoPayment } from "@/app/actions/recruiter";

export const metadata = { title: "Paiement" };

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { company } = await requireRecruiter();
  const p = await one<{ id: string; amount: number; provider: string; phone: string; status: string; reference: string; plan: string; invoice_number: string | null }>(
    `SELECT p.id,p.amount,p.provider,p.phone,p.status,p.reference,pl.name plan,p.invoice_number FROM payments p JOIN plans pl ON pl.code=p.plan_code
     WHERE p.id=$1 AND p.company_id=$2`,
    [id, company.company_id],
  );
  if (!p) notFound();
  const provider = PAYMENT_PROVIDERS.find((x) => x.code === p.provider)?.label ?? p.provider;
  const demo = process.env.PAYMENTS_MODE !== "live";

  return (
    <div className="mx-auto max-w-lg">
      <div className="card overflow-hidden">
        <div className="weave h-1.5" aria-hidden="true" />
        <div className="p-6">
          <h1 className="text-2xl font-bold">
            {p.status === "paid" ? "Paiement reçu" : p.status === "failed" ? "Paiement non abouti" : `Payer avec ${provider}`}
          </h1>
          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Formule</dt><dd className="font-semibold">{p.plan}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Montant HT</dt><dd className="font-semibold">{money(p.amount)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Référence</dt><dd className="font-mono">{p.reference}</dd></div>
            {p.phone && <div className="flex justify-between"><dt className="text-ink-soft">Numéro</dt><dd>{p.phone}</dd></div>}
          </dl>

          {p.status === "pending" && (
            <>
              <p className="mt-5 rounded-lg bg-wash p-3 text-sm">
                {p.provider === "card"
                  ? "Vous allez être redirigé vers la page sécurisée de paiement par carte."
                  : `Une demande de paiement va s'afficher sur le téléphone ${p.phone}. Validez-la avec votre code secret ${provider}.`}
              </p>
              {demo && (
                <div className="mt-5 rounded-lg border border-[#efd8a6] bg-saffron-soft p-4 text-sm">
                  <p className="font-semibold">Mode démonstration</p>
                  <p className="mt-1">Aucun argent n&apos;est prélevé. Le paiement réel sera activé avec le compte marchand de l&apos;agrégateur (CinetPay, PayDunya ou équivalent).</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={confirmDemoPayment}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="outcome" value="paid" />
                      <button className="btn btn-primary btn-sm">Simuler un paiement réussi</button>
                    </form>
                    <form action={confirmDemoPayment}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="outcome" value="failed" />
                      <button className="btn btn-ghost btn-sm">Simuler un échec</button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
          {p.status === "paid" && (
            <div className="mt-5 space-y-3">
              <p className="rounded-lg bg-leaf-soft p-3 text-sm text-leaf">Vos crédits ont été ajoutés à votre compte.</p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/recruteur/factures/${p.id}`} className="btn btn-ghost">Voir la facture {p.invoice_number}</Link>
                <Link href="/recruteur/offres/nouvelle" className="btn btn-primary">Publier une offre</Link>
              </div>
            </div>
          )}
          {p.status === "failed" && (
            <div className="mt-5">
              <p className="text-sm text-ink-soft">Le paiement a été refusé ou annulé. Aucun montant n&apos;a été débité. Vérifiez le solde du compte et réessayez.</p>
              <Link href="/recruteur/abonnement" className="btn btn-primary mt-3">Réessayer</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
