import "server-only";
import { one, query } from "./db";

export type JobRow = {
  id: number;
  title: string;
  city: string;
  country_code: string;
  country_name: string;
  currency: string;
  contract_type: string;
  experience_level: string;
  study_level: string;
  remote: string;
  salary_min: number | null;
  salary_max: number | null;
  show_salary: boolean;
  positions: number;
  published_at: string;
  expires_at: string;
  featured: boolean;
  confidential: boolean;
  function_id: number | null;
  function_name: string | null;
  sector_name: string | null;
  skills: string[];
  company_id: string;
  company_name: string;
  company_slug: string;
  brand_color: string;
};

export type JobFilters = {
  q?: string;
  pays?: string;
  ville?: string;
  fonction?: string;
  secteur?: string;
  contrat?: string;
  experience?: string;
  etudes?: string;
  teletravail?: string;
  management?: string;
  entreprise?: string;
  langue?: string;
  page?: string;
};

export const JOB_SELECT = `
  j.id,j.title,j.city,j.country_code,co.name country_name,co.currency,j.contract_type,j.experience_level,j.study_level,j.remote,
  j.salary_min,j.salary_max,j.show_salary,j.positions,j.published_at,j.expires_at,(j.featured AND (j.featured_until IS NULL OR j.featured_until > now())) featured,j.confidential,j.function_id,
  f.name function_name,s.name sector_name,j.skills,c.id company_id,
  CASE WHEN j.confidential THEN 'Entreprise confidentielle' ELSE c.name END company_name,
  CASE WHEN j.confidential THEN '' ELSE c.slug END company_slug, c.brand_color`;

export const JOB_FROM = `
  FROM jobs j
  JOIN companies c ON c.id=j.company_id
  JOIN countries co ON co.code=j.country_code
  LEFT JOIN functions f ON f.id=j.function_id
  LEFT JOIN sectors s ON s.id=j.sector_id`;

export const PUBLISHED = `j.status='published' AND j.expires_at>now() AND c.status='verified'`;

export const PAGE_SIZE = 15;

export async function searchJobs(f: JobFilters, userId?: string | null) {
  const where: string[] = [PUBLISHED];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.q?.trim()) {
    const v = f.q.trim().slice(0, 100);
    where.push(`(to_tsvector('french', j.title || ' ' || j.description || ' ' || j.profile) @@ websearch_to_tsquery('french', ${p(v)}) OR j.title ILIKE ${p(`%${v}%`)} OR c.name ILIKE ${p(`%${v}%`)})`);
  }
  if (f.pays) where.push(`j.country_code=${p(f.pays)}`);
  if (f.ville) where.push(`j.city=${p(f.ville)}`);
  if (f.fonction) where.push(`j.function_id=${p(Number(f.fonction) || 0)}`);
  if (f.secteur) where.push(`j.sector_id=${p(Number(f.secteur) || 0)}`);
  if (f.contrat) where.push(`j.contract_type=${p(f.contrat)}`);
  if (f.experience) where.push(`j.experience_level=${p(f.experience)}`);
  if (f.etudes) where.push(`j.study_level=${p(f.etudes)}`);
  if (f.teletravail) where.push(`j.remote=${p(f.teletravail)}`);
  if (f.management === "1") where.push(`j.management`);
  if (f.langue) where.push(`${p(f.langue)}=ANY(j.languages)`);
  if (f.entreprise) where.push(`c.slug=${p(f.entreprise)} AND NOT j.confidential`);
  // Entreprises masquées : exclues, sauf recherche directe par leur nom
  if (userId && !f.entreprise && !f.q) {
    where.push(`NOT EXISTS (SELECT 1 FROM hidden_companies h WHERE h.user_id=${p(userId)} AND h.company_id=j.company_id)`);
  }
  const page = Math.max(1, Number(f.page) || 1);
  const sql = `SELECT ${JOB_SELECT}, count(*) OVER()::int total ${JOB_FROM} WHERE ${where.join(" AND ")}
    ORDER BY (j.featured AND (j.featured_until IS NULL OR j.featured_until > now())) DESC, j.published_at DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`;
  const rows = await query<JobRow & { total: number }>(sql, params);
  return { jobs: rows, total: rows[0]?.total ?? 0, page, pages: Math.max(1, Math.ceil((rows[0]?.total ?? 0) / PAGE_SIZE)) };
}

export type JobDetail = JobRow & {
  description: string;
  profile: string;
  benefits: string;
  languages: string[];
  management: boolean;
  status: string;
  views: number;
  sector_id: number | null;
  company_description: string;
  company_culture: string;
  company_city: string;
};

export async function getJob(id: number, includeUnpublished = false) {
  return one<JobDetail>(
    `SELECT ${JOB_SELECT}, j.description,j.profile,j.benefits,j.languages,j.management,j.status,j.views,j.sector_id,
       CASE WHEN j.confidential THEN '' ELSE c.description END company_description,
       CASE WHEN j.confidential THEN '' ELSE c.culture END company_culture, c.city company_city
     ${JOB_FROM} WHERE j.id=$1 ${includeUnpublished ? "" : `AND ${PUBLISHED}`}`,
    [id],
  );
}

export async function getQuestions(jobId: number) {
  return query<{ id: number; question: string; eliminatory: boolean; expected: string }>(
    `SELECT id,question,eliminatory,expected FROM job_questions WHERE job_id=$1 ORDER BY sort,id`,
    [jobId],
  );
}

export async function getMatchProfile(userId: string) {
  const p = await one<{
    desired_function_ids: number[];
    current_function_id: number | null;
    experience_level: string;
    study_level: string;
    search_countries: string[];
    city: string;
  }>(
    `SELECT desired_function_ids,current_function_id,experience_level,study_level,search_countries,city FROM candidate_profiles WHERE user_id=$1`,
    [userId],
  );
  if (!p) return null;
  const skills = (await query<{ name: string }>(`SELECT name FROM candidate_skills WHERE user_id=$1`, [userId])).map((r) => r.name);
  return { ...p, skills };
}
