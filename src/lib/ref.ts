// Référentiels fixes de la plateforme (les pays, villes, fonctions et secteurs sont en base).

export const CONTRACT_TYPES = [
  "CDI",
  "CDD",
  "Stage",
  "Consultance",
  "Freelance",
  "Intérim",
  "Temps partiel",
] as const;

export const EXPERIENCE_LEVELS = [
  { code: "debutant", label: "Débutant (moins d'1 an)", rank: 0 },
  { code: "junior", label: "Junior (1 à 3 ans)", rank: 1 },
  { code: "intermediaire", label: "Intermédiaire (3 à 5 ans)", rank: 2 },
  { code: "confirme", label: "Confirmé (5 à 10 ans)", rank: 3 },
  { code: "expert", label: "Expert (10 à 20 ans)", rank: 4 },
  { code: "senior", label: "Très senior (plus de 20 ans)", rank: 5 },
] as const;

export const STUDY_LEVELS = [
  { code: "sans", label: "Sans diplôme", rank: 0 },
  { code: "bac", label: "Bac", rank: 1 },
  { code: "bac2", label: "Bac +2", rank: 2 },
  { code: "bac3", label: "Bac +3", rank: 3 },
  { code: "bac4", label: "Bac +4", rank: 4 },
  { code: "bac5", label: "Bac +5 et plus", rank: 5 },
] as const;

export const REMOTE_OPTIONS = [
  { code: "non", label: "Sur site" },
  { code: "hybride", label: "Hybride" },
  { code: "total", label: "Télétravail complet" },
] as const;

export const LANGUAGES = ["Français", "Anglais", "Arabe", "Portugais", "Wolof", "Bambara", "Dioula", "Peul", "Haoussa", "Soussou"] as const;
export const LANGUAGE_LEVELS = ["Notions", "Intermédiaire", "Courant", "Langue maternelle"] as const;

export const SALARY_BANDS = [
  "Moins de 150 000 FCFA",
  "150 000 à 300 000 FCFA",
  "300 000 à 500 000 FCFA",
  "500 000 à 800 000 FCFA",
  "800 000 à 1 200 000 FCFA",
  "1 200 000 à 2 000 000 FCFA",
  "Plus de 2 000 000 FCFA",
] as const;

export const COMPANY_SIZES = ["1 à 10", "11 à 50", "51 à 250", "251 à 1 000", "Plus de 1 000"] as const;

// Étapes du pipeline ATS, dans l'ordre. `candidate` = ce que voit le candidat.
export const STAGES = [
  { code: "nouvelle", label: "Nouvelles", candidate: "Envoyée" },
  { code: "preselection", label: "Présélection", candidate: "Présélectionnée" },
  { code: "test", label: "Test", candidate: "Test à passer" },
  { code: "entretien_rh", label: "Entretien RH", candidate: "Entretien" },
  { code: "entretien_manager", label: "Entretien manager", candidate: "Entretien" },
  { code: "offre", label: "Offre", candidate: "Offre en cours" },
  { code: "embauche", label: "Embauché", candidate: "Retenue" },
  { code: "refuse", label: "Refusé", candidate: "Non retenue" },
] as const;
export type StageCode = (typeof STAGES)[number]["code"];

export const PAYMENT_PROVIDERS = [
  { code: "wave", label: "Wave" },
  { code: "orange_money", label: "Orange Money" },
  { code: "moov", label: "Moov Money" },
  { code: "mtn", label: "MTN MoMo" },
  { code: "free_money", label: "Free Money" },
  { code: "card", label: "Carte bancaire" },
] as const;

export const ARTICLE_CATEGORIES = ["Conseils", "Actualité de l'emploi", "Outils recruteurs", "Enquêtes"] as const;

export const JOB_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending: "En modération",
  published: "Publiée",
  rejected: "Refusée",
  expired: "Expirée",
  archived: "Archivée",
};

export const COMPANY_STATUS_LABELS: Record<string, string> = {
  pending: "À vérifier",
  verified: "Vérifiée",
  rejected: "Refusée",
  suspended: "Suspendue",
};

export function labelOf<T extends { code: string; label: string }>(list: readonly T[], code: string | null | undefined) {
  return list.find((x) => x.code === code)?.label ?? "";
}

export function stageOf(code: string) {
  return STAGES.find((s) => s.code === code) ?? STAGES[0];
}
