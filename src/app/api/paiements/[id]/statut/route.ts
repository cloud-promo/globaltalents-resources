import { NextResponse } from "next/server";
import { getUser, getMembership } from "@/lib/auth";
import { one } from "@/lib/db";
import { refreshFromEwari } from "@/lib/payments";

export const dynamic = "force-dynamic";

// Interrogé toutes les quelques secondes par la page de paiement.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const u = await getUser();
  const m = u?.role === "recruiter" ? await getMembership(u.id) : null;
  if (!m) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const p = await one<{ status: string; provider: string; expires_at: string | null }>(
    `SELECT status,provider,expires_at FROM payments WHERE id=$1 AND company_id=$2`,
    [id, m.company_id],
  );
  if (!p) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let status = p.status;
  if (status === "pending" && p.provider === "ewari") {
    try {
      status = (await refreshFromEwari(id)) ?? status;
    } catch {
      /* e-Wari momentanément injoignable : on réessaiera au prochain appel */
    }
  }
  return NextResponse.json({ status }, { headers: { "Cache-Control": "no-store" } });
}
