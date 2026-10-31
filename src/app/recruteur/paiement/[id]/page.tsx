import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireRecruiter } from "@/lib/auth";
import { one } from "@/lib/db";
import { money } from "@/lib/format";
import { confirmDemoPayment, cancelPayment } from "@/app/actions/recruiter";
import { PaymentWatcher } from "@/components/PaymentWatcher";
import { refreshFromEwari } from "@/lib/payments";

export const metadata = { title: "Paiement" };
export const dynamic = "force-dynamic";

type P = {
  id: string; amount: number; provider: string; status: string; reference: string; plan: string; invoice_number: string | null;
  pay_url: string; qr_payload: string; expires_at: string | null; failure_reason: string; payer: string;
};

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { company } = await requireRecruiter();
  const load = () =>
    one<P>(
      `SELECT p.id,p.amount,p.provider,p.status,p.reference,pl.name plan,p.invoice_number,p.pay_url,p.qr_payload,p.expires_at,p.failure_reason,p.payer
       FROM payments p JOIN plans pl ON pl.code=p.plan_code WHERE p.id=$1 AND p.company_id=$2`,
      [id, company.company_id],
    );
  let p = await load();
  if (!p) notFound();
  // Au retour depuis e-Wari, on vérifie tout de suite l'état réel
  if (p.status === "pending" && p.provider === "ewari") {
    try {
      await refreshFromEwari(p.id);
      p = (await load())!;
    } catch { /* la surveillance prendra le relais */ }
  }
  const qr = p.status === "pending" && p.qr_payload ? await QRCode.toString(p.qr_payload, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#141B3D", light: "#FFFFFF" } }) : "";
  const deeplink = p.qr_payload.startsWith("ewari://") ? p.qr_payload : p.pay_url;

  return (
    <div className="mx-auto max-w-lg">
      <div className="card overflow-hidden">
        <div className="weave h-1.5" aria-hidden="true" />
        <div className="p-6">
          <h1 className="text-2xl font-bold">
            {p.status === "paid" ? "Paiement reçu" : p.status === "pending" ? "Payer avec e-Wari" : "Paiement non abouti"}
          </h1>
          <dl className="mt-4 space-y-1.5 text-sm">
            <Row k="Formule" v={p.plan} />
            <Row k="Montant HT" v={money(p.amount)} />
            <Row k="Référence" v={p.reference} mono />
            {p.payer && p.status === "paid" && <Row k="Réglé par" v={p.payer} />}
          </dl>

          {p.status === "pending" && p.provider === "ewari" && (
            <>
              <div className="mt-6 grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
                <div className="mx-auto w-44 rounded-xl border border-line bg-white p-2" aria-label="QR code de paiement e-Wari" role="img" dangerouslySetInnerHTML={{ __html: qr }} />
                <ol className="space-y-2 text-sm">
                  <li><strong>Sur ordinateur :</strong> ouvrez e-Wari sur votre téléphone, touchez Scanner et visez ce code.</li>
                  <li><strong>Sur téléphone :</strong> utilisez le bouton ci-dessous.</li>
                  <li>Validez avec votre code e-Wari. Cette page se met à jour toute seule.</li>
                </ol>
              </div>
              <div className="mt-5 grid gap-2">
                <a href={deeplink} className="btn btn-primary w-full">Ouvrir l&apos;application e-Wari</a>
                {p.pay_url && <a href={p.pay_url} className="btn btn-ghost w-full">Payer par Mobile Money ou carte via e-Wari</a>}
              </div>
              <PaymentWatcher id={p.id} />
              {p.expires_at && <p className="mt-1 text-xs text-muted">Ce code expire à {new Date(p.expires_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" })} (heure de Dakar).</p>}
              <form action={cancelPayment} className="mt-4 border-t border-line pt-4">
                <input type="hidden" name="id" value={p.id} />
                <button className="text-sm text-muted hover:text-clay">Annuler ce paiement</button>
              </form>
            </>
          )}

          {p.status === "pending" && p.provider === "demo" && (
            <div className="mt-5 rounded-lg border border-[#efd8a6] bg-saffron-soft p-4 text-sm">
              <p className="font-semibold">Mode démonstration</p>
              <p className="mt-1">Aucun argent n&apos;est prélevé. Le paiement réel passe par e-Wari dès que les clés marchand sont configurées.</p>
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

          {p.status === "paid" && (
            <div className="mt-5 space-y-3">
              <p className="rounded-lg bg-leaf-soft p-3 text-sm text-leaf">Vos crédits ont été ajoutés à votre compte.</p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/recruteur/factures/${p.id}`} className="btn btn-ghost">Voir la facture {p.invoice_number}</Link>
                <Link href="/recruteur/offres/nouvelle" className="btn btn-primary">Publier une offre</Link>
              </div>
            </div>
          )}

          {["failed", "cancelled", "expired"].includes(p.status) && (
            <div className="mt-5">
              <p className="text-sm text-ink-soft">
                {p.status === "expired"
                  ? "Le délai de paiement est dépassé. Aucun montant n'a été débité."
                  : p.status === "cancelled"
                    ? "Ce paiement a été annulé. Aucun montant n'a été débité."
                    : "Le paiement a été refusé. Aucun montant n'a été débité. Vérifiez votre solde e-Wari et réessayez."}
              </p>
              <Link href="/recruteur/abonnement" className="btn btn-primary mt-3">Recommencer</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-soft">{k}</dt>
      <dd className={`text-right font-semibold ${mono ? "font-mono text-xs" : ""}`}>{v}</dd>
    </div>
  );
}
