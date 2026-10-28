import { NextResponse } from "next/server";
import { getUser, getMembership } from "@/lib/auth";
import { query, one } from "@/lib/db";
import { stageOf } from "@/lib/ref";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s; // évite l'injection de formules dans Excel
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await getUser();
  if (!u || u.role !== "recruiter") return new NextResponse("Accès refusé", { status: 403 });
  const m = await getMembership(u.id);
  const job = m ? await one<{ id: number; title: string }>(`SELECT id,title FROM jobs WHERE id=$1 AND company_id=$2`, [Number(id) || 0, m.company_id]) : null;
  if (!job) return new NextResponse("Introuvable", { status: 404 });
  const rows = await query<{ first_name: string; last_name: string; email: string; phone: string; anonymous: boolean; score: number; stage: string; created_at: string; failed_screening: boolean }>(
    `SELECT u.first_name,u.last_name,u.email,u.phone,a.anonymous,a.score,a.stage,a.created_at,a.failed_screening
     FROM applications a JOIN users u ON u.id=a.candidate_id WHERE a.job_id=$1 ORDER BY a.score DESC`,
    [job.id],
  );
  const lines = [
    ["Nom", "Prénom", "E-mail", "Téléphone", "Score", "Étape", "Présélection", "Reçue le"].map(cell).join(";"),
    ...rows.map((r) => {
      const hide = r.anonymous && !["entretien_rh", "entretien_manager", "offre", "embauche"].includes(r.stage);
      return [hide ? "Anonyme" : r.last_name, hide ? "" : r.first_name, hide ? "" : r.email, hide ? "" : r.phone, r.score, stageOf(r.stage).label,
        r.failed_screening ? "Non validée" : "Validée", new Date(r.created_at).toLocaleDateString("fr-FR")].map(cell).join(";");
    }),
  ];
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="candidatures-${job.id}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
