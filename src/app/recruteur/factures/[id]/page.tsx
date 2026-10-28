import { notFound } from "next/navigation";
import { requireRecruiter } from "@/lib/auth";
import { one } from "@/lib/db";
import { date, money } from "@/lib/format";
import { PAYMENT_PROVIDERS } from "@/lib/ref";
import { LogoMark } from "@/components/Logo";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Facture" };

const VAT = 0.18; // TVA UEMOA et Guinée : 18 %, à confirmer pays par pays

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { company } = await requireRecruiter();
  const inv = await one<{ invoice_number: string; paid_at: string; amount: number; provider: string; reference: string; plan: string; description: string; name: string; city: string; country: string; registration_number: string }>(
    `SELECT p.invoice_number,p.paid_at,p.amount,p.provider,p.reference,pl.name plan,pl.description,c.name,c.city,co.name country,c.registration_number
     FROM payments p JOIN plans pl ON pl.code=p.plan_code JOIN companies c ON c.id=p.company_id JOIN countries co ON co.code=c.country_code
     WHERE p.id=$1 AND p.company_id=$2 AND p.status='paid'`,
    [id, company.company_id],
  );
  if (!inv) notFound();
  const vat = Math.round(inv.amount * VAT);
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <article className="card p-8">
        <header className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-2">
            <LogoMark size={36} />
            <div>
              <p className="font-display text-lg font-bold">Global Talents Resources</p>
              <p className="text-xs text-ink-soft">Dakar, Sénégal (coordonnées légales à compléter)</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold">Facture {inv.invoice_number}</p>
            <p className="text-sm text-ink-soft">Du {date(inv.paid_at)}</p>
          </div>
        </header>
        <section className="mt-8 text-sm">
          <p className="text-ink-soft">Facturé à</p>
          <p className="font-semibold">{inv.name}</p>
          <p>{inv.city}, {inv.country}</p>
          {inv.registration_number && <p>RCCM / NINEA : {inv.registration_number}</p>}
        </section>
        <table className="mt-8 w-full text-sm">
          <thead className="border-b border-line text-left text-ink-soft">
            <tr><th className="py-2">Désignation</th><th className="py-2 text-right">Montant</th></tr>
          </thead>
          <tbody>
            <tr className="border-b border-line"><td className="py-3"><strong>{inv.plan}</strong><br /><span className="text-ink-soft">{inv.description}</span></td><td className="py-3 text-right">{money(inv.amount)}</td></tr>
          </tbody>
          <tfoot>
            <tr><td className="pt-3 text-right text-ink-soft">Total HT</td><td className="pt-3 text-right">{money(inv.amount)}</td></tr>
            <tr><td className="text-right text-ink-soft">TVA 18 %</td><td className="text-right">{money(vat)}</td></tr>
            <tr><td className="pt-1 text-right font-semibold">Total TTC</td><td className="pt-1 text-right font-semibold">{money(inv.amount + vat)}</td></tr>
          </tfoot>
        </table>
        <p className="mt-8 text-xs text-ink-soft">
          Réglé par {PAYMENT_PROVIDERS.find((p) => p.code === inv.provider)?.label}, référence {inv.reference}. Mentions légales et régime de TVA à valider avec l&apos;expert-comptable avant la mise en production.
        </p>
      </article>
    </div>
  );
}
