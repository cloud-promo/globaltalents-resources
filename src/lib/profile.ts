import "server-only";
import { one, query } from "./db";

export type Profile = {
  user_id: string;
  title: string;
  summary: string;
  city: string;
  birth_date: string | null;
  nationality: string;
  experience_level: string;
  study_level: string;
  current_function_id: number | null;
  desired_function_ids: number[];
  search_countries: string[];
  current_salary: string;
  desired_salary: string;
  availability: string;
  linkedin_url: string;
  visible_cvtheque: boolean;
  public_profile: boolean;
  show_photo: boolean;
  share_test: boolean;
  notify_cv_viewed: boolean;
  newsletter: boolean;
  newsletter_frequency: string;
  partner_offers: boolean;
  whatsapp_alerts: boolean;
};

export async function loadProfile(userId: string) {
  const [profile, experiences, educations, skills, languages, documents] = await Promise.all([
    one<Profile>(`SELECT * FROM candidate_profiles WHERE user_id=$1`, [userId]),
    query<{ id: string; title: string; company: string; city: string; start_date: string; end_date: string | null; description: string }>(
      `SELECT id,title,company,city,start_date,end_date,description FROM experiences WHERE user_id=$1 ORDER BY start_date DESC`,
      [userId],
    ),
    query<{ id: string; degree: string; school: string; field: string; year_end: number | null }>(
      `SELECT id,degree,school,field,year_end FROM educations WHERE user_id=$1 ORDER BY year_end DESC NULLS LAST`,
      [userId],
    ),
    query<{ name: string }>(`SELECT name FROM candidate_skills WHERE user_id=$1 ORDER BY name`, [userId]),
    query<{ name: string; level: string }>(`SELECT name,level FROM candidate_languages WHERE user_id=$1 ORDER BY name`, [userId]),
    query<{ id: string; kind: string; filename: string; size: number; is_primary: boolean; created_at: string }>(
      `SELECT id,kind,filename,size,is_primary,created_at FROM documents WHERE user_id=$1 ORDER BY is_primary DESC, created_at DESC`,
      [userId],
    ),
  ]);
  return { profile, experiences, educations, skills, languages, documents };
}

export type Loaded = Awaited<ReturnType<typeof loadProfile>>;

// Taux de complétude : chaque bloc rempli compte, le CV compte double.
export function completeness(p: Loaded) {
  const pr = p.profile;
  const checks: [string, boolean, number][] = [
    ["Titre du profil", !!pr?.title, 1],
    ["Ville", !!pr?.city, 1],
    ["Résumé", (pr?.summary.length ?? 0) >= 40, 1],
    ["Niveau d'expérience", !!pr?.experience_level, 1],
    ["Niveau d'études", !!pr?.study_level, 1],
    ["Fonctions recherchées", (pr?.desired_function_ids.length ?? 0) > 0, 1],
    ["Une expérience", p.experiences.length > 0, 1],
    ["Une formation", p.educations.length > 0, 1],
    ["Trois compétences", p.skills.length >= 3, 1],
    ["Une langue", p.languages.length > 0, 1],
    ["CV", p.documents.some((d) => d.kind === "cv"), 2],
  ];
  const total = checks.reduce((s, c) => s + c[2], 0);
  const done = checks.reduce((s, c) => s + (c[1] ? c[2] : 0), 0);
  return { percent: Math.round((100 * done) / total), missing: checks.filter((c) => !c[1]).map((c) => c[0]) };
}
