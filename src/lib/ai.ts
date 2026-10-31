import "server-only";
import type { Motivation, ScreenJob, ScreenQuery } from "./screening";

// IA facultative : activée si ANTHROPIC_API_KEY est défini. Sans clé, la plateforme utilise l'analyse par règles.
// Données envoyées : intitulé du poste, nom de l'entreprise, compétences demandées et texte de la lettre.
// Jamais le nom, les coordonnées, l'âge, la photo ou le CV du candidat.

const API = "https://api.anthropic.com/v1/messages";

export function aiEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function aiModel() {
  return process.env.AI_MODEL || "claude-haiku-5-5";
}

async function complete(system: string, user: string, maxTokens = 500): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(API, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: aiModel(), max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`IA indisponible (${res.status})`);
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
  } finally {
    clearTimeout(timer);
  }
}

function json<T>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

const MOTIVATION_SYSTEM = `Tu es chargé de présélection dans un cabinet de recrutement d'Afrique de l'Ouest.
Tu évalues UNIQUEMENT la motivation et la pertinence de la lettre pour le poste : personnalisation, compréhension du poste et de l'entreprise, arguments concrets, réalisations, clarté.
Tu ignores tout élément personnel (âge, sexe, origine, religion, situation familiale, santé, nom) et tu ne le mentionnes jamais.
Tu ne sanctionnes pas les fautes de langue mineures.
Réponds uniquement en JSON : {"score": entier 0-100, "resume": "une phrase en français", "points_forts": ["…"], "reserves": ["…"]} (3 éléments maximum par liste, 12 mots maximum chacun).`;

export async function aiMotivation(job: ScreenJob, letter: string, answers: { q: string; a: string }[]): Promise<Motivation | null> {
  if (!aiEnabled()) return null;
  const text = letter.trim().slice(0, 3500);
  const user = `Poste : ${job.title}
Entreprise : ${job.company_name}
Compétences demandées : ${job.skills.join(", ") || "non précisées"}
Réponses aux questions de présélection : ${answers.map((x) => `${x.q} → ${x.a}`).join(" ; ") || "aucune"}

Lettre de motivation :
"""
${text || "(aucune lettre)"}
"""`;
  try {
    const out = json<{ score: number; resume: string; points_forts?: string[]; reserves?: string[] }>(await complete(MOTIVATION_SYSTEM, user));
    if (!out || typeof out.score !== "number") return null;
    return {
      score: Math.max(0, Math.min(100, Math.round(out.score))),
      summary: String(out.resume ?? "").slice(0, 200),
      strengths: (out.points_forts ?? []).map(String).slice(0, 3),
      concerns: (out.reserves ?? []).map(String).slice(0, 3),
      source: "ia",
      model: aiModel(),
    };
  } catch {
    return null;
  }
}

const QUERY_SYSTEM = `Tu traduis la demande d'un recruteur en filtres JSON pour classer ses candidats.
Champs possibles : {"limit": 1-50, "city": "ville exacte de la liste ou absent", "maxSalary": montant mensuel en unités, "availability": "immediate" ou "month", "needTest": booléen, "skills": ["compétences exactes de la liste"], "onlyNew": booléen, "minScore": 0-100}.
N'invente aucun filtre absent de la demande. limit vaut 10 par défaut. Réponds uniquement avec l'objet JSON.`;

export async function aiParseQuery(text: string, ctx: { cities: string[]; skills: string[] }): Promise<ScreenQuery | null> {
  if (!aiEnabled() || !text.trim()) return null;
  try {
    const out = json<ScreenQuery>(await complete(QUERY_SYSTEM, `Villes : ${ctx.cities.join(", ")}\nCompétences : ${ctx.skills.join(", ")}\nDemande : ${text.slice(0, 300)}`, 200));
    if (!out) return null;
    const q: ScreenQuery = { limit: Math.max(1, Math.min(50, Number(out.limit) || 10)) };
    if (out.city && ctx.cities.includes(out.city)) q.city = out.city;
    if (Number(out.maxSalary) > 1000) q.maxSalary = Math.round(Number(out.maxSalary));
    if (out.availability === "immediate" || out.availability === "month") q.availability = out.availability;
    if (out.needTest === true) q.needTest = true;
    if (Array.isArray(out.skills)) {
      const s = out.skills.map(String).filter((x) => ctx.skills.includes(x));
      if (s.length) q.skills = s;
    }
    if (out.onlyNew === true) q.onlyNew = true;
    if (Number(out.minScore) > 0) q.minScore = Math.min(100, Math.round(Number(out.minScore)));
    return q;
  } catch {
    return null;
  }
}
