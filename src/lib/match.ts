import { EXPERIENCE_LEVELS, STUDY_LEVELS } from "./ref";

export type MatchProfile = {
  desired_function_ids: number[];
  current_function_id: number | null;
  experience_level: string;
  study_level: string;
  search_countries: string[];
  city: string;
  skills: string[];
};

export type MatchJob = {
  function_id: number | null;
  experience_level: string;
  study_level: string;
  country_code: string;
  city: string;
  skills: string[];
};

export type MatchResult = { score: number; reasons: { label: string; ok: boolean }[] };

const rank = (list: readonly { code: string; rank: number }[], code: string) => list.find((x) => x.code === code)?.rank;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Score de correspondance explicable (0 à 100). Chaque critère affiche sa raison.
export function matchScore(p: MatchProfile, j: MatchJob): MatchResult {
  const reasons: MatchResult["reasons"] = [];
  let score = 0;

  // Fonction : 30 points
  if (j.function_id && p.desired_function_ids.includes(j.function_id)) {
    score += 30;
    reasons.push({ label: "Fonction recherchée", ok: true });
  } else if (j.function_id && p.current_function_id === j.function_id) {
    score += 22;
    reasons.push({ label: "Même fonction que votre poste actuel", ok: true });
  } else {
    reasons.push({ label: "Fonction différente de vos souhaits", ok: false });
  }

  // Expérience : 20 points
  const pe = rank(EXPERIENCE_LEVELS, p.experience_level);
  const je = rank(EXPERIENCE_LEVELS, j.experience_level);
  if (pe !== undefined && je !== undefined) {
    const d = pe - je;
    if (d === 0 || d === 1) {
      score += 20;
      reasons.push({ label: "Expérience au niveau demandé", ok: true });
    } else if (d > 1) {
      score += 12;
      reasons.push({ label: "Expérience supérieure au niveau demandé", ok: true });
    } else if (d === -1) {
      score += 8;
      reasons.push({ label: "Expérience un peu en dessous du niveau demandé", ok: false });
    } else {
      reasons.push({ label: "Expérience insuffisante", ok: false });
    }
  }

  // Études : 15 points
  const ps = rank(STUDY_LEVELS, p.study_level);
  const js = rank(STUDY_LEVELS, j.study_level);
  if (ps !== undefined && js !== undefined) {
    if (ps >= js) {
      score += 15;
      reasons.push({ label: "Niveau d'études suffisant", ok: true });
    } else if (ps === js - 1) {
      score += 7;
      reasons.push({ label: "Niveau d'études légèrement inférieur", ok: false });
    } else {
      reasons.push({ label: "Niveau d'études inférieur", ok: false });
    }
  }

  // Localisation : 15 points
  if (p.city && norm(p.city) === norm(j.city)) {
    score += 15;
    reasons.push({ label: "Poste dans votre ville", ok: true });
  } else if (p.search_countries.includes(j.country_code)) {
    score += 10;
    reasons.push({ label: "Pays de recherche", ok: true });
  } else {
    reasons.push({ label: "Hors de vos pays de recherche", ok: false });
  }

  // Compétences : 20 points
  if (j.skills.length) {
    const mine = new Set(p.skills.map(norm));
    const hit = j.skills.filter((s) => mine.has(norm(s)));
    score += Math.round((20 * hit.length) / j.skills.length);
    reasons.push({
      label: hit.length ? `Compétences communes : ${hit.join(", ")}` : "Aucune compétence demandée dans votre profil",
      ok: hit.length > 0,
    });
  } else {
    score += 10;
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}
