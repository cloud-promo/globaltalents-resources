import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { query, one } from "@/lib/db";

// Export des données personnelles (droit d'accès et de portabilité)
export async function GET() {
  const u = await getUser();
  if (!u) return new NextResponse("Connexion requise", { status: 401 });
  const [profile, experiences, educations, skills, languages, documents, applications, alerts, saved] = await Promise.all([
    one(`SELECT * FROM candidate_profiles WHERE user_id=$1`, [u.id]),
    query(`SELECT title,company,city,start_date,end_date,description FROM experiences WHERE user_id=$1`, [u.id]),
    query(`SELECT degree,school,field,year_end FROM educations WHERE user_id=$1`, [u.id]),
    query(`SELECT name FROM candidate_skills WHERE user_id=$1`, [u.id]),
    query(`SELECT name,level FROM candidate_languages WHERE user_id=$1`, [u.id]),
    query(`SELECT filename,kind,size,created_at FROM documents WHERE user_id=$1`, [u.id]),
    query(
      `SELECT j.title,a.stage,a.score,a.created_at,a.cover_letter,a.answers FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=$1`,
      [u.id],
    ),
    query(`SELECT name,query,created_at FROM alerts WHERE user_id=$1`, [u.id]),
    query(`SELECT j.title,s.created_at FROM saved_jobs s JOIN jobs j ON j.id=s.job_id WHERE s.user_id=$1`, [u.id]),
  ]);
  const body = JSON.stringify(
    { exported_at: new Date().toISOString(), account: u, profile, experiences, educations, skills, languages, documents, applications, alerts, saved },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mes-donnees-globaltalents.json"`,
      "Cache-Control": "no-store",
    },
  });
}
