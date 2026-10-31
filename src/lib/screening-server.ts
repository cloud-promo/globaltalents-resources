import "server-only";
import { one, query } from "./db";
import { normalizeSettings, type Motivation, type ScreenCandidate, type ScreenJob } from "./screening";
import type { Scores } from "./personality";

const VISIBLE_STAGES = ["entretien_rh", "entretien_manager", "offre", "embauche"];

export async function loadScreening(jobId: number, companyId: string) {
  const job = await one<ScreenJob & { screening_settings: unknown; status: string }>(
    `SELECT j.id,j.title,c.name company_name,j.function_id,j.experience_level,j.study_level,j.skills,j.languages,j.city,j.country_code,
       j.salary_min,j.salary_max,co.currency,j.personality_traits,j.screening_settings,j.status
     FROM jobs j JOIN companies c ON c.id=j.company_id JOIN countries co ON co.code=j.country_code WHERE j.id=$1 AND j.company_id=$2`,
    [jobId, companyId],
  );
  if (!job) return null;

  type Row = Omit<ScreenCandidate, "skills" | "languages" | "degrees" | "personality" | "name"> & {
    first_name: string; last_name: string; answers: { question: string; answer: string }[];
  };
  const rows = await query<Row>(
    `SELECT a.id application_id,a.candidate_id,a.anonymous,a.stage,a.created_at::text created_at,a.cover_letter,a.failed_screening,a.ai_motivation,a.answers,a.share_test,
       u.first_name,u.last_name,u.country_code,
       coalesce(p.title,'') headline,coalesce(p.experience_level,'') experience_level,coalesce(p.study_level,'') study_level,
       p.current_function_id,coalesce(p.desired_function_ids,'{}') desired_function_ids,coalesce(p.city,'') city,
       coalesce(p.search_countries,'{}') search_countries,coalesce(p.desired_salary,'') desired_salary,coalesce(p.availability,'') availability
     FROM applications a JOIN users u ON u.id=a.candidate_id LEFT JOIN candidate_profiles p ON p.user_id=a.candidate_id
     WHERE a.job_id=$1`,
    [jobId],
  );
  const ids = rows.map((r) => r.candidate_id);
  const shared = rows.filter((r) => (r as unknown as { share_test: boolean }).share_test).map((r) => r.candidate_id);
  const [skills, langs, degrees, tests] = ids.length
    ? await Promise.all([
        query<{ user_id: string; name: string }>(`SELECT user_id,name FROM candidate_skills WHERE user_id=ANY($1)`, [ids]),
        query<{ user_id: string; name: string; level: string }>(`SELECT user_id,name,level FROM candidate_languages WHERE user_id=ANY($1)`, [ids]),
        query<{ user_id: string; label: string }>(
          `SELECT user_id,degree||CASE WHEN field<>'' THEN ' '||field ELSE '' END label FROM educations WHERE user_id=ANY($1) ORDER BY year_end DESC NULLS LAST`,
          [ids],
        ),
        shared.length
          ? query<{ user_id: string; scores: Scores }>(
              `SELECT DISTINCT ON (user_id) user_id,scores FROM personality_results WHERE user_id=ANY($1) ORDER BY user_id,created_at DESC`,
              [shared],
            )
          : Promise.resolve([] as { user_id: string; scores: Scores }[]),
      ])
    : [[], [], [], []];

  const by = <T extends { user_id: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of list) m.set(x.user_id, [...(m.get(x.user_id) ?? []), x]);
    return m;
  };
  const S = by(skills), L = by(langs), D = by(degrees), T = by(tests);

  const candidates: (ScreenCandidate & { answers: { q: string; a: string }[] })[] = rows.map((r) => {
    const masked = r.anonymous && !VISIBLE_STAGES.includes(r.stage);
    return {
      ...r,
      name: masked ? `Candidat anonyme n° ${r.application_id.slice(0, 4).toUpperCase()}` : `${r.first_name} ${r.last_name}`,
      skills: (S.get(r.candidate_id) ?? []).map((x) => x.name),
      languages: (L.get(r.candidate_id) ?? []).map((x) => ({ name: x.name, level: x.level })),
      degrees: (D.get(r.candidate_id) ?? []).map((x) => x.label),
      personality: T.get(r.candidate_id)?.[0]?.scores ?? null,
      ai_motivation: (r.ai_motivation as Motivation | null) ?? null,
      answers: (r.answers ?? []).map((x) => ({ q: x.question, a: x.answer })),
    };
  });

  const cities = (await query<{ name: string }>(`SELECT DISTINCT name FROM cities WHERE country_code=$1 ORDER BY name`, [job.country_code])).map((c) => c.name);
  if (!cities.includes(job.city)) cities.push(job.city);
  for (const c of candidates) if (c.city && !cities.includes(c.city)) cities.push(c.city);

  return { job, settings: normalizeSettings(job.screening_settings), candidates, cities };
}
