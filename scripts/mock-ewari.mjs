// Simulateur de l'API marchand e-Wari, conforme à docs/EWARI.md. Pour le développement et les tests uniquement.
// Usage : EWARI_SECRET_KEY=sk_test_x EWARI_WEBHOOK_SECRET=whsec_x node scripts/mock-ewari.mjs   (port 4010)
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.MOCK_EWARI_PORT || 4010);
const KEY = process.env.EWARI_SECRET_KEY || "sk_test_local";
const WHSEC = process.env.EWARI_WEBHOOK_SECRET || "whsec_local";
const MERCHANT = "GTR001";
const payments = new Map();
const idem = new Map();

const send = (res, code, obj) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
};
const err = (res, code, c, m) => send(res, code, { error: { code: c, message: m } });

async function body(req) {
  let s = "";
  for await (const ch of req) s += ch;
  try { return s ? JSON.parse(s) : {}; } catch { return null; }
}

export function sign(raw, t = Math.floor(Date.now() / 1000), secret = WHSEC) {
  return `t=${t},v1=${crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex")}`;
}

async function webhook(p, type, opts = {}) {
  const evt = { id: "evt_" + crypto.randomBytes(8).toString("hex"), type, created: new Date().toISOString(), data: { ...p, _callback: undefined } };
  delete evt.data._callback;
  const raw = JSON.stringify(evt);
  const sig = opts.badSignature ? sign(raw, undefined, "mauvais_secret") : sign(raw);
  const r = await fetch(p._callback, { method: "POST", headers: { "Content-Type": "application/json", "X-Ewari-Signature": sig, "X-Ewari-Event": type }, body: raw }).catch((e) => ({ status: 0, text: async () => String(e) }));
  return { event: evt, status: r.status, body: await r.text(), raw, signature: sig };
}

const pub = (p) => { const { _callback, ...rest } = p; return rest; };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const parts = url.pathname.split("/").filter(Boolean);
  if (req.headers.authorization !== `Bearer ${KEY}`) return err(res, 401, "unauthorized", "Clé API invalide");

  // POST /payments
  if (req.method === "POST" && parts.length === 1 && parts[0] === "payments") {
    const b = await body(req);
    if (!b) return err(res, 400, "invalid_json", "JSON invalide");
    const k = req.headers["idempotency-key"];
    if (k && idem.has(k)) return send(res, 200, pub(payments.get(idem.get(k))));
    if (!Number.isInteger(b.amount) || b.amount < 100) return err(res, 422, "invalid_amount", "Montant invalide");
    if (!["XOF", "GNF"].includes(b.currency)) return err(res, 422, "invalid_currency", "Devise non prise en charge");
    if (!b.reference || !b.callback_url) return err(res, 422, "missing_field", "reference et callback_url sont obligatoires");
    const id = "pay_" + crypto.randomBytes(10).toString("hex");
    const p = {
      id, status: "pending", amount: b.amount, currency: b.currency, reference: b.reference, description: b.description || "",
      merchant_code: MERCHANT,
      pay_url: `https://app.ewari.net/app#p=${MERCHANT}&a=${b.amount}&r=${id}`,
      qr_payload: `ewari://pay?p=${MERCHANT}&a=${b.amount}&r=${id}`,
      deeplink: `ewari://pay?p=${MERCHANT}&a=${b.amount}&r=${id}`,
      expires_at: new Date(Date.now() + (b.expires_in || 1800) * 1000).toISOString(),
      paid_at: null, fee: null, payer: null, failure_reason: null, metadata: b.metadata || {},
      created_at: new Date().toISOString(), _callback: b.callback_url,
    };
    payments.set(id, p);
    if (k) idem.set(k, id);
    return send(res, 201, pub(p));
  }

  const p = parts[0] === "payments" && parts[1] ? payments.get(parts[1]) : null;
  if (parts[0] === "payments" && parts[1] && !p) return err(res, 404, "not_found", "Paiement introuvable");

  // GET /payments/:id
  if (req.method === "GET" && parts.length === 2) return send(res, 200, pub(p));

  // POST /payments/:id/cancel
  if (req.method === "POST" && parts[2] === "cancel") {
    if (p.status === "pending") { p.status = "cancelled"; await webhook(p, "payment.cancelled"); }
    return send(res, 200, pub(p));
  }

  // POST /payments/:id/simulate  (bac à sable uniquement)
  // { outcome: "succeeded"|"failed"|"expired", webhook: true|false, bad_signature, tamper_amount, replay }
  if (req.method === "POST" && parts[2] === "simulate") {
    if (!KEY.startsWith("sk_test_")) return err(res, 403, "forbidden", "Simulation réservée au bac à sable");
    const b = (await body(req)) || {};
    if (p.status !== "pending") return err(res, 409, "not_pending", "Paiement déjà finalisé");
    p.status = b.outcome || "succeeded";
    if (p.status === "succeeded") { p.paid_at = new Date().toISOString(); p.fee = Math.round(p.amount * 0.01); p.payer = { method: "e-Wari", phone: "+221 77 *** ** 67" }; }
    if (p.status === "failed") p.failure_reason = "Solde insuffisant";
    if (b.tamper_amount) p.amount = b.tamper_amount;
    const out = { payment: pub(p) };
    if (b.webhook !== false) {
      out.webhook = await webhook(p, `payment.${p.status}`, { badSignature: !!b.bad_signature });
      if (b.replay) {
        // Renvoie exactement le même événement (même id, même signature)
        const r = await fetch(p._callback, { method: "POST", headers: { "Content-Type": "application/json", "X-Ewari-Signature": out.webhook.signature }, body: out.webhook.raw });
        out.replay = { status: r.status, body: await r.text() };
      }
    }
    return send(res, 200, out);
  }

  err(res, 404, "not_found", "Route inconnue");
}).listen(PORT, () => console.log(`Simulateur e-Wari sur http://localhost:${PORT}`));
