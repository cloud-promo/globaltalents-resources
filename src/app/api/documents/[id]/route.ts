import { NextResponse } from "next/server";
import { getUser, getMembership } from "@/lib/auth";
import { one, query } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return new NextResponse("Connexion requise", { status: 401 });
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Introuvable", { status: 404 });

  const doc = await one<{ user_id: string; filename: string; mime: string; data: Buffer }>(
    `SELECT user_id,filename,mime,data FROM documents WHERE id=$1`,
    [id],
  );
  if (!doc) return new NextResponse("Introuvable", { status: 404 });

  let allowed = doc.user_id === user.id || user.role === "admin";
  if (!allowed && user.role === "recruiter") {
    const m = await getMembership(user.id);
    if (m) {
      const viaApplication = await one(
        `SELECT 1 FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.document_id=$1 AND j.company_id=$2
           AND (NOT a.anonymous OR a.stage IN ('entretien_rh','entretien_manager','offre','embauche'))`,
        [id, m.company_id],
      );
      const viaUnlock = await one(
        `SELECT 1 FROM cv_unlocks u JOIN candidate_profiles p ON p.user_id=u.candidate_id
          WHERE u.company_id=$1 AND u.candidate_id=$2 AND p.visible_cvtheque`,
        [m.company_id, doc.user_id],
      );
      allowed = !!viaApplication || !!viaUnlock;
      if (allowed) {
        // Le candidat est prévenu quand son CV est consulté (s'il l'a demandé)
        await query(
          `INSERT INTO notifications(user_id,title,body,link)
           SELECT $1, 'Votre CV a été consulté', $2, '/candidat/candidatures'
           FROM candidate_profiles WHERE user_id=$1 AND notify_cv_viewed
             AND NOT EXISTS (SELECT 1 FROM notifications WHERE user_id=$1 AND title='Votre CV a été consulté' AND body=$2 AND created_at > now() - interval '1 day')`,
          [doc.user_id, `${m.name} a ouvert votre CV.`],
        );
      }
    }
  }
  if (!allowed) return new NextResponse("Accès refusé", { status: 403 });

  return new NextResponse(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
