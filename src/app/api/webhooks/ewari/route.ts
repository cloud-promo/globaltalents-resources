import { NextResponse } from "next/server";
import { one, query } from "@/lib/db";
import { verifyEwariSignature, getEwariPayment, type EwariPayment } from "@/lib/ewari";
import { reconcile } from "@/lib/payments";
import { audit } from "@/lib/notify";

export const dynamic = "force-dynamic";

type Event = { id?: string; type?: string; data?: Partial<EwariPayment> };

/*
 * Webhook e-Wari. Trois garde-fous :
 * 1. signature HMAC et horodatage récent, sinon 401 ;
 * 2. chaque événement n'est traité qu'une fois (table payment_events) ;
 * 3. le contenu du webhook n'est jamais cru tel quel : l'état est relu auprès de l'API e-Wari
 *    avant de créditer, et le montant, la devise et la référence doivent correspondre.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 64_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (!verifyEwariSignature(raw, req.headers.get("x-ewari-signature"))) {
    await audit(null, "webhook.ewari.bad_signature", "webhook", "", { ip: req.headers.get("x-forwarded-for") ?? "" });
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  let evt: Event;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const providerId = String(evt.data?.id ?? "");
  if (!evt.id || !evt.type || !providerId) return NextResponse.json({ error: "invalid_event" }, { status: 400 });

  const local = await one<{ id: string; amount: number; currency: string; reference: string; status: string }>(
    `SELECT id,amount,currency,reference,status FROM payments WHERE provider='ewari' AND provider_payment_id=$1`,
    [providerId],
  );
  const first = await query(
    `INSERT INTO payment_events(event_id,provider,payment_id,type) VALUES($1,'ewari',$2,$3) ON CONFLICT DO NOTHING RETURNING event_id`,
    [String(evt.id).slice(0, 120), local?.id ?? null, String(evt.type).slice(0, 60)],
  );
  if (!first.length) return NextResponse.json({ received: true, duplicate: true });
  if (!local) return NextResponse.json({ received: true, unknown_payment: true });

  try {
    const remote = await getEwariPayment(providerId);
    const status = await reconcile(local, remote);
    return NextResponse.json({ received: true, status });
  } catch (e) {
    // On libère l'événement pour qu'e-Wari puisse le renvoyer
    await query(`DELETE FROM payment_events WHERE event_id=$1`, [String(evt.id).slice(0, 120)]);
    await audit(null, "webhook.ewari.verify_failed", "payment", local.id, { error: String((e as Error).message) });
    return NextResponse.json({ error: "verification_failed" }, { status: 503 });
  }
}
