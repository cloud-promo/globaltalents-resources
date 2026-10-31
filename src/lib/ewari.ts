import "server-only";
import crypto from "node:crypto";

/*
 * Client de l'API marchand e-Wari (GLOFIN).
 * Contrat décrit dans docs/EWARI.md : création d'un paiement, consultation, annulation,
 * webhooks signés HMAC-SHA256. Seul ce fichier dépend du format exact de l'API e-Wari.
 */

export type EwariStatus = "pending" | "succeeded" | "failed" | "cancelled" | "expired";

export type EwariPayment = {
  id: string;
  status: EwariStatus;
  amount: number;
  currency: string;
  reference: string;
  merchant_code: string;
  pay_url: string;
  qr_payload: string;
  deeplink: string;
  expires_at: string;
  paid_at?: string | null;
  fee?: number | null;
  payer?: { phone?: string; name?: string; method?: string } | null;
  failure_reason?: string | null;
};

export class EwariError extends Error {
  constructor(message: string, public status = 0, public code = "") {
    super(message);
  }
}

export function ewariConfig() {
  const url = (process.env.EWARI_API_URL || "").replace(/\/+$/, "");
  const key = process.env.EWARI_SECRET_KEY || "";
  const webhookSecret = process.env.EWARI_WEBHOOK_SECRET || "";
  return { url, key, webhookSecret, enabled: process.env.PAYMENTS_MODE === "ewari" && !!url && !!key, test: key.startsWith("sk_test_") };
}

async function call<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const { url, key } = ewariConfig();
  if (!url || !key) throw new EwariError("e-Wari n'est pas configuré (EWARI_API_URL, EWARI_SECRET_KEY).");
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, Accept: "application/json", "User-Agent": "GlobalTalentsResources/1.0" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  let last: unknown;
  // Les lectures sont relancées en cas d'erreur réseau ; la création l'est aussi grâce à la clé d'idempotence.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000), cache: "no-store" });
      const text = await res.text();
      let json: Record<string, unknown> = {};
      try { json = text ? JSON.parse(text) : {}; } catch { /* réponse non JSON */ }
      if (res.ok) return json as T;
      const err = (json.error as { message?: string; code?: string }) || {};
      if (res.status >= 500 && attempt < 2) { last = new EwariError(err.message || `HTTP ${res.status}`, res.status, err.code); await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); continue; }
      throw new EwariError(err.message || `e-Wari a répondu ${res.status}`, res.status, err.code || "");
    } catch (e) {
      if (e instanceof EwariError) throw e;
      last = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw last instanceof Error ? new EwariError(`e-Wari injoignable : ${last.message}`) : new EwariError("e-Wari injoignable");
}

export function createEwariPayment(input: {
  amount: number;
  currency: string;
  reference: string;
  description: string;
  customer: { name?: string; email?: string; phone?: string };
  callback_url: string;
  return_url: string;
  metadata?: Record<string, string>;
}) {
  return call<EwariPayment>("POST", "/payments", { ...input, expires_in: 1800 }, input.reference);
}

export function getEwariPayment(id: string) {
  return call<EwariPayment>("GET", `/payments/${encodeURIComponent(id)}`);
}

export function cancelEwariPayment(id: string) {
  return call<EwariPayment>("POST", `/payments/${encodeURIComponent(id)}/cancel`, {});
}

/* Signature des webhooks : en-tête « X-Ewari-Signature: t=<horodatage>,v1=<hex> »
   avec v1 = HMAC-SHA256(secret, `${t}.${corps brut}`). Tolérance : 5 minutes. */
export function verifyEwariSignature(rawBody: string, header: string | null, now = Date.now()) {
  const { webhookSecret } = ewariConfig();
  if (!webhookSecret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.trim().split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(now / 1000 - t) > 300) return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parts.v1, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
