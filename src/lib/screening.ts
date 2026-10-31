// Présélection automatique « Top N à interviewer ».
// 1. Critères définis dans l'offre (70 % de la note) : compétences, expérience, diplôme, fonction, langues.
// 2. Critères complémentaires (30 %) : motivation, zone d'habitat, salaire, disponibilité, test de personnalité.
// Chaque critère est expliqué. Aucun critère personnel (âge, sexe, origine, religion, situation familiale, photo) n'est utilisé.

import { EXPERIENCE_LEVELS, STUDY_LEVELS, labelOf } from "./ref";
import { traitFit, traitLabel, type Scores } from "./personality";

export type Importance = 0 | 1 | 2;
export type SecondaryKey = "motivation" | "location" | "salary" | "availability" | "personality";

export type ScreeningSettings = {
  weights: Record<SecondaryKey, Importance>;
  exclude_failed: boolean;
  require_study: boolean;
  require_experience: boolean;
  same_country: boolean;
};

export const DEFAULT_SETTINGS: ScreeningSettings = {
  weights: { motivation: 1, location: 1, salary: 1, availability: 1, personality: 1 },
  exclude_failed: true,
  require_study: false,
  require_experience: false,
  same_country: false,
};

export const SECONDARY: { key: SecondaryKey; label: string; base: number }[] = [
  { key: "motivation", label: "Motivation", base: 30 },
  { key: "location", label: "Zone d'habitat", base: 25 },
  { key: "salary", label: "Prétentions salariales", base: 20 },
  { key: "availability", label: "Disponibilité", base: 15 },
  { key: "personality", label: "Test de personnalité", base: 10 },
];

const PRIMARY: { key: string; label: string; weight: number }[] = [
  { key: "skills", label: "Compétences demandées", weight: 35 },
  { key: "experience", label: "Expérience", weight: 25 },
  { key: "study", label: "Diplôme", weight: 20 },
  { key: "function", label: "Métier", weight: 10 },
  { key: "languages", label: "Langues", weight: 10 },
];

export const OFFER_SHARE = 0.7;

export function normalizeSettings(raw: unknown): ScreeningSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<ScreeningSettings>;
  const w = { ...DEFAULT_SETTINGS.weights };
  for (const s of SECONDARY) {
    const v = Number((r.weights as Record<string, unknown> | undefined)?.[s.key]);
    if (v === 0 || v === 1 || v === 2) w[s.key] = v;
  }
  const b = (k: keyof Omit<ScreeningSettings, "weights">) => (typeof r[k] === "boolean" ? (r[k] as boolean) : DEFAULT_SETTINGS[k]);
  return { weights: w, exclude_failed: b("exclude_failed"), require_study: b("require_study"), require_experience: b("require_experience"), same_country: b("same_country") };
}

export type Motivation = { score: number; summary: string; strengths: string[]; concerns: string[]; source: "ia" | "regles"; model?: string };

export type ScreenJob = {
  id: number;
  title: string;
  company_name: string;
  function_id: number | null;
  experience_level: string;
  study_level: string;
  skills: string[];
  languages: string[];
  city: string;
  country_code: string;
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  personality_traits: string[];
};

export type ScreenCandidate = {
  application_id: string;
  candidate_id: string;
  name: string;
  anonymous: boolean;
  stage: string;
  created_at: string;
  headline: string;
  experience_level: string;
  study_level: string;
  current_function_id: number | null;
  desired_function_ids: number[];
  city: string;
  country_code: string | null;
  search_countries: string[];
  desired_salary: string;
  availability: string;
  skills: string[];
  languages: { name: string; level: string }[];
  degrees: string[];
  cover_letter: string;
  failed_screening: boolean;
  personality: Scores | null;
  ai_motivation: Motivation | null;
};

export type Criterion = { key: string; label: string; group: "offre" | "complement"; value: number | null; weight: number; detail: string };

export type Ranked = {
  c: ScreenCandidate;
  score: number;
  offer: number;
  extra: number | null;
  criteria: Criterion[];
  motivation: Motivation;
  excluded: string | null;
  highlights: string[];
  concerns: string[];
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
const rank = (list: readonly { code: string; rank: number }[], code: string) => list.find((x) => x.code === code)?.rank;
const pct = (v: number) => Math.round(v * 100);

export function skillHit(have: string[], want: string) {
  const w = norm(want);
  return have.some((h) => {
    const n = norm(h);
    return n === w || (w.length >= 3 && (n.includes(w) || (n.length >= 3 && w.includes(n))));
  });
}

// « 1 200 000 à 2 000 000 FCFA », « 900k », « 1,5 million » → premier montant en unités
export function parseAmount(text: string): number | null {
  const t = text.toLowerCase().replace(/[\u202f\u00a0]/g, " ");
  const m = t.match(/(\d+(?:[ .,]\d+)*)\s*(millions?|m\b|k\b|mille)?/);
  if (!m) return null;
  const unit = m[2] ?? "";
  const big = unit.startsWith("million") || unit === "m";
  // « 1,5 million » : virgule décimale ; « 1 200 000 » ou « 1.200.000 » : séparateurs de milliers
  const raw = big && /^\d+[.,]\d{1,2}$/.test(m[1]) ? m[1].replace(",", ".") : m[1].replace(/[ .,]/g, "");
  let n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (big) n *= 1_000_000;
  else if (unit === "k" || unit === "mille") n *= 1_000;
  return n > 0 ? Math.round(n) : null;
}

const AVAILABILITY: Record<string, number> = { "immédiate": 1, "sous 1 mois": 0.85, "sous 3 mois": 0.5, "en veille": 0.3 };
const LEVELS_OK = ["intermédiaire", "courant", "langue maternelle"];

// ---------- Motivation : analyse par règles (sans IA) ----------
const MOTIVATION_WORDS = ["motiv", "passion", "rejoindre", "contribuer", "apporter", "ambition", "enthousias", "interess", "envie", "projet", "valeurs", "mission", "evoluer", "challenge", "defi"];
const ACHIEVEMENT = /(\d+\s?%|\d[\d\s]{2,}\s?(fcfa|clients|personnes|agents)|j'ai (mis en place|pilote|dirige|reduit|augmente|gere|cree|lance|developpe|forme|encadre))/;

export function ruleMotivation(letter: string, job: ScreenJob): Motivation {
  const text = norm(letter);
  const words = text ? text.split(" ").length : 0;
  const strengths: string[] = [];
  const concerns: string[] = [];
  let s: number;
  if (words < 15) {
    s = 0.15;
    concerns.push(words ? "Lettre très courte" : "Pas de lettre de motivation");
  } else if (words < 60) {
    s = 0.4;
    concerns.push("Lettre brève");
  } else s = words > 450 ? 0.6 : 0.65;

  if (words >= 15) {
    const company = norm(job.company_name);
    if (company && text.includes(company.split(" ")[0])) { s += 0.12; strengths.push("Cite l'entreprise"); }
    const titleWords = norm(job.title).split(" ").filter((w) => w.length >= 4);
    if (titleWords.some((w) => text.includes(w))) { s += 0.06; strengths.push("Parle du poste visé"); }
    const sk = job.skills.filter((k) => text.includes(norm(k)));
    if (sk.length) { s += Math.min(0.1, sk.length * 0.04); strengths.push(`Met en avant : ${sk.slice(0, 3).join(", ")}`); }
    if (MOTIVATION_WORDS.filter((w) => text.includes(w)).length >= 2) { s += 0.07; strengths.push("Exprime une motivation claire"); }
    if (ACHIEVEMENT.test(text)) { s += 0.1; strengths.push("Donne des réalisations concrètes"); }
    if (/\[|xxx|nom de l.?entreprise|votre entreprise\b.*votre entreprise/.test(text)) { s -= 0.15; concerns.push("Ressemble à une lettre type"); }
  }
  const score = Math.max(0, Math.min(1, s));
  const summary = words < 15
    ? "Pas d'élément de motivation exploitable."
    : strengths.length >= 3 ? "Lettre personnalisée et argumentée." : strengths.length ? "Lettre correcte, peu personnalisée." : "Lettre générique.";
  return { score: pct(score), summary, strengths, concerns, source: "regles" };
}

// ---------- Classement ----------
export function screen(job: ScreenJob, candidates: ScreenCandidate[], settings: ScreeningSettings): Ranked[] {
  const jobExp = rank(EXPERIENCE_LEVELS, job.experience_level);
  const jobStudy = rank(STUDY_LEVELS, job.study_level);

  const out = candidates.map((c): Ranked => {
    const criteria: Criterion[] = [];
    const highlights: string[] = [];
    const concerns: string[] = [];
    const add = (key: string, group: Criterion["group"], value: number | null, detail: string, weight: number) => {
      const label = PRIMARY.find((p) => p.key === key)?.label ?? SECONDARY.find((s) => s.key === key)?.label ?? key;
      criteria.push({ key, label, group, value, weight, detail });
    };
    const pw = (k: string) => PRIMARY.find((p) => p.key === k)!.weight;

    // --- Critères de l'offre
    if (job.skills.length) {
      const hit = job.skills.filter((k) => skillHit(c.skills, k));
      add("skills", "offre", hit.length / job.skills.length, hit.length ? `${hit.length}/${job.skills.length} : ${hit.join(", ")}` : `0/${job.skills.length}`, pw("skills"));
      const miss = job.skills.filter((k) => !hit.includes(k));
      if (hit.length === job.skills.length) highlights.push("Toutes les compétences demandées");
      else if (miss.length && hit.length) concerns.push(`Compétences manquantes : ${miss.slice(0, 3).join(", ")}`);
    }
    const ce = rank(EXPERIENCE_LEVELS, c.experience_level);
    if (jobExp !== undefined) {
      let v: number | null = null;
      if (ce !== undefined) {
        const d = ce - jobExp;
        v = d === 0 || d === 1 ? 1 : d >= 2 ? 0.8 : d === -1 ? 0.5 : 0;
        if (d >= 2) concerns.push("Profil plus senior que le poste");
        if (d < 0) concerns.push("Expérience en dessous du niveau demandé");
      }
      add("experience", "offre", v, ce !== undefined ? labelOf(EXPERIENCE_LEVELS, c.experience_level) : "non renseignée", pw("experience"));
    }
    const cs = rank(STUDY_LEVELS, c.study_level);
    if (jobStudy !== undefined) {
      const v = cs === undefined ? null : cs >= jobStudy ? 1 : cs === jobStudy - 1 ? 0.5 : 0;
      add("study", "offre", v, `${cs !== undefined ? labelOf(STUDY_LEVELS, c.study_level) : "non renseigné"}${c.degrees[0] ? `, ${c.degrees[0]}` : ""}`, pw("study"));
      if (v === 0) concerns.push("Diplôme inférieur au niveau demandé");
    }
    if (job.function_id) {
      const v = c.desired_function_ids.includes(job.function_id) ? 1 : c.current_function_id === job.function_id ? 0.8 : 0;
      add("function", "offre", v, v === 1 ? "Métier recherché par le candidat" : v ? "Métier actuel du candidat" : "Autre métier", pw("function"));
    }
    if (job.languages.length) {
      const ok = job.languages.filter((l) => c.languages.some((x) => norm(x.name) === norm(l) && LEVELS_OK.includes(x.level.toLowerCase())));
      add("languages", "offre", ok.length / job.languages.length, `${ok.length}/${job.languages.length}${ok.length ? ` : ${ok.join(", ")}` : ""}`, pw("languages"));
    }

    // --- Critères complémentaires
    const sw = (k: SecondaryKey) => SECONDARY.find((s) => s.key === k)!.base * settings.weights[k];
    const motivation = c.ai_motivation ?? ruleMotivation(c.cover_letter, job);
    if (settings.weights.motivation) {
      add("motivation", "complement", motivation.score / 100, `${motivation.score}/100${motivation.source === "ia" ? " (analyse IA)" : ""} : ${motivation.summary}`, sw("motivation"));
      if (motivation.score >= 75) highlights.push("Motivation très argumentée");
    }
    if (settings.weights.location) {
      const sameCity = c.city && norm(c.city) === norm(job.city);
      const country = c.country_code === job.country_code || c.search_countries.includes(job.country_code);
      const v = !c.city ? 0.4 : sameCity ? 1 : country ? 0.6 : 0.2;
      add("location", "complement", v, !c.city ? "Ville non renseignée" : sameCity ? `Habite ${c.city}` : `Habite ${c.city}${country ? ", même pays" : ", autre pays"}`, sw("location"));
      if (sameCity) highlights.push(`Habite ${c.city}`);
      else if (c.city && !country) concerns.push("Réside dans un autre pays");
    }
    if (settings.weights.salary && job.salary_max) {
      const want = parseAmount(c.desired_salary);
      const v = want === null ? null : want <= job.salary_max ? 1 : want <= job.salary_max * 1.15 ? 0.5 : 0;
      add("salary", "complement", v, want === null ? "Non renseignées" : `Souhaite ${c.desired_salary}`, sw("salary"));
      if (v === 0) concerns.push("Prétentions au-dessus du budget");
      if (v === 1) highlights.push("Dans le budget");
    }
    if (settings.weights.availability) {
      const v = AVAILABILITY[c.availability.toLowerCase()] ?? null;
      add("availability", "complement", v, c.availability || "Non renseignée", sw("availability"));
      if (v === 1) highlights.push("Disponible immédiatement");
    }
    if (settings.weights.personality && job.personality_traits.length) {
      const fit = traitFit(c.personality, job.personality_traits);
      add("personality", "complement", fit === null ? null : fit / 100,
        fit === null ? "Résultats non partagés (pas de pénalité)" : `${fit} % sur ${job.personality_traits.map(traitLabel).join(", ").toLowerCase()}`, sw("personality"));
      if (fit !== null && fit >= 70) highlights.push("Personnalité en phase avec le poste");
    }

    const avg = (g: Criterion["group"]) => {
      const list = criteria.filter((k) => k.group === g && k.value !== null && k.weight > 0);
      const w = list.reduce((s, k) => s + k.weight, 0);
      return w ? list.reduce((s, k) => s + (k.value as number) * k.weight, 0) / w : null;
    };
    const offer = avg("offre") ?? 0.5;
    const extra = avg("complement");
    const score = extra === null ? offer : OFFER_SHARE * offer + (1 - OFFER_SHARE) * extra;

    let excluded: string | null = null;
    if (c.stage === "refuse") excluded = "Déjà refusé";
    else if (settings.exclude_failed && c.failed_screening) excluded = "Réponse éliminatoire aux questions de présélection";
    else if (settings.require_study && jobStudy !== undefined && (cs === undefined || cs < jobStudy)) excluded = "Diplôme inférieur au minimum exigé";
    else if (settings.require_experience && jobExp !== undefined && (ce === undefined || ce < jobExp)) excluded = "Expérience inférieure au minimum exigé";
    else if (settings.same_country && c.country_code !== job.country_code && !c.search_countries.includes(job.country_code)) excluded = "Ne réside pas dans le pays du poste";

    return { c, score: pct(score), offer: pct(offer), extra: extra === null ? null : pct(extra), criteria, motivation, excluded, highlights, concerns: [...concerns, ...motivation.concerns.slice(0, 1)] };
  });

  return out.sort((a, b) => b.score - a.score || b.offer - a.offer || a.c.created_at.localeCompare(b.c.created_at));
}

// ---------- Demande en langage naturel ----------
export type ScreenQuery = {
  limit: number;
  city?: string;
  maxSalary?: number;
  availability?: "immediate" | "month";
  needTest?: boolean;
  skills?: string[];
  onlyNew?: boolean;
  minScore?: number;
};

const WORD_NUMBERS: Record<string, number> = { trois: 3, cinq: 5, dix: 10, quinze: 15, vingt: 20, douze: 12, huit: 8, six: 6, quatre: 4, sept: 7 };

export function parseQuery(text: string, ctx: { cities: string[]; skills: string[] }): ScreenQuery {
  const t = norm(text);
  // Version qui garde la ponctuation des montants (« 1,5 million », « 1.200.000 »)
  const loose = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\u202f\u00a0]/g, " ").replace(/['’]/g, " ");
  const q: ScreenQuery = { limit: 10 };
  // On retire les montants avant de chercher le nombre de candidats voulu
  const bare = loose.replace(/\d+(?:[ .,]\d{3})+|\d+(?:[.,]\d+)?\s*(millions?|m\b|k\b|mille|fcfa|f\b|xof|gnf|%|ans|mois|jours|heures)/g, " ");
  const n = bare.match(/\btop\s*(\d{1,2})\b/) ?? bare.match(/\b(\d{1,2})\s*(meilleur|candidat|profil|premier|personne|a interviewer|a recevoir)/) ?? bare.match(/\b(\d{1,2})\b/);
  const wn = Object.entries(WORD_NUMBERS).find(([w]) => new RegExp(`\\b(top )?${w}\\b`).test(t));
  if (n) q.limit = Number(n[1]);
  else if (wn) q.limit = wn[1];
  q.limit = Math.max(1, Math.min(50, q.limit));

  const city = ctx.cities.find((c) => new RegExp(`\\b${norm(c).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t));
  if (city) q.city = city;

  const sal = loose.match(/(moins de|maximum|max|sous|jusqu a|budget de|budget|inferieur a|pas plus de|<|≤)\s*((\d+(?:[ .,]\d+)*)\s*(millions?|m\b|k\b|mille)?)/);
  if (sal) {
    const v = parseAmount(sal[2]);
    if (v && v >= 1000) q.maxSalary = v;
  }
  if (/(immediat|tout de suite|des maintenant|disponibles? maintenant|sans preavis)/.test(t)) q.availability = "immediate";
  else if (/(sous (un|1) mois|dans le mois|30 jours|d ici un mois)/.test(t)) q.availability = "month";
  if (/(test|boussole|personnalite)/.test(t)) q.needTest = true;
  if (/(nouvelles?|pas encore (vu|traite)|non traite)/.test(t)) q.onlyNew = true;
  const min = t.match(/(score|note)\s*(minimum|min|superieur a|au moins|>)?\s*(de\s*)?(\d{2})/);
  if (min) q.minScore = Number(min[4]);
  const sk = ctx.skills.filter((s) => s.length >= 2 && new RegExp(`\\b${norm(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t));
  if (sk.length) q.skills = sk;
  return q;
}

export function describeQuery(q: ScreenQuery, currency: string) {
  const parts = [`Top ${q.limit}`];
  if (q.city) parts.push(`habitant ${q.city}`);
  if (q.maxSalary) parts.push(`prétentions ≤ ${new Intl.NumberFormat("fr-FR").format(q.maxSalary)} ${currency === "XOF" ? "FCFA" : currency}`);
  if (q.availability) parts.push(q.availability === "immediate" ? "disponibles immédiatement" : "disponibles sous 1 mois");
  if (q.needTest) parts.push("test de personnalité partagé");
  if (q.skills?.length) parts.push(`maîtrisant ${q.skills.join(", ")}`);
  if (q.onlyNew) parts.push("candidatures non traitées");
  if (q.minScore) parts.push(`score ≥ ${q.minScore}`);
  return parts;
}

// Applique la demande : renvoie la liste retenue et les candidats écartés par la demande (avec la raison)
export function applyQuery(ranked: Ranked[], q: ScreenQuery) {
  const kept: Ranked[] = [];
  const filtered: { r: Ranked; reason: string }[] = [];
  for (const r of ranked) {
    if (r.excluded) continue;
    let reason = "";
    if (q.city && norm(r.c.city) !== norm(q.city)) reason = `N'habite pas ${q.city}`;
    else if (q.maxSalary) {
      const want = parseAmount(r.c.desired_salary);
      if (want !== null && want > q.maxSalary) reason = "Prétentions au-dessus du plafond demandé";
    }
    if (!reason && q.availability) {
      const a = r.c.availability.toLowerCase();
      if (q.availability === "immediate" ? a !== "immédiate" : !["immédiate", "sous 1 mois"].includes(a)) reason = "Disponibilité plus tardive";
    }
    if (!reason && q.needTest && !r.c.personality) reason = "Test de personnalité non partagé";
    if (!reason && q.skills?.length && !q.skills.every((s) => skillHit(r.c.skills, s))) reason = `Ne maîtrise pas ${q.skills.filter((s) => !skillHit(r.c.skills, s)).join(", ")}`;
    if (!reason && q.onlyNew && r.c.stage !== "nouvelle") reason = "Candidature déjà traitée";
    if (!reason && q.minScore && r.score < q.minScore) reason = "Score inférieur au minimum demandé";
    if (reason) filtered.push({ r, reason });
    else kept.push(r);
  }
  return { top: kept.slice(0, q.limit), rest: kept.slice(q.limit), filtered };
}
