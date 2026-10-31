// Test de personnalité « Boussole Talents ».
// Modèle : 5 traits professionnels inspirés du modèle des Big Five (modèle scientifique libre de droits).
// Format : 25 paires d'affirmations opposées, curseur à 5 positions. Questions originales de Global Talents.

export type TraitCode = "ouverture" | "rigueur" | "extraversion" | "cooperation" | "stabilite";

export const TRAITS: {
  code: TraitCode;
  label: string;
  low: string;
  high: string;
  profile: string;
  strengths: string;
  watch: string;
  thrive: string;
  lowText: string;
}[] = [
  {
    code: "ouverture",
    label: "Curiosité et innovation",
    low: "Pragmatique",
    high: "Innovant",
    profile: "Innovateur",
    strengths: "Vous aimez apprendre, proposer des idées nouvelles et vous adapter aux changements.",
    watch: "Attention à ne pas vous disperser : finir un projet compte autant que l'imaginer.",
    thrive: "Les structures qui se transforment : start-up, projets de digitalisation, innovation, marketing.",
    lowText: "Vous privilégiez les méthodes éprouvées et l'efficacité concrète.",
  },
  {
    code: "rigueur",
    label: "Organisation et rigueur",
    low: "Spontané",
    high: "Rigoureux",
    profile: "Organisateur",
    strengths: "Vous planifiez, vérifiez et tenez vos engagements. On peut compter sur vous.",
    watch: "Laissez-vous un peu de souplesse quand les priorités changent vite.",
    thrive: "Les environnements structurés : banque, audit, finance, qualité, logistique, administration.",
    lowText: "Vous gérez bien l'imprévu et préférez la souplesse aux procédures.",
  },
  {
    code: "extraversion",
    label: "Énergie relationnelle",
    low: "Réfléchi",
    high: "Communicant",
    profile: "Ambassadeur",
    strengths: "Vous allez facilement vers les autres, convainquez et animez un groupe.",
    watch: "Prenez le temps d'écouter avant de convaincre.",
    thrive: "Les métiers de contact : vente, relation client, communication, management d'équipe.",
    lowText: "Vous êtes à l'aise dans le travail de fond, concentré et autonome.",
  },
  {
    code: "cooperation",
    label: "Esprit d'équipe",
    low: "Indépendant",
    high: "Coopératif",
    profile: "Fédérateur",
    strengths: "Vous recherchez l'accord, aidez vos collègues et créez un bon climat de travail.",
    watch: "Osez aussi défendre votre point de vue quand c'est nécessaire.",
    thrive: "Les équipes soudées : ONG, santé, ressources humaines, projets transverses, enseignement.",
    lowText: "Vous êtes direct, autonome et à l'aise pour défendre vos positions.",
  },
  {
    code: "stabilite",
    label: "Calme sous pression",
    low: "Sensible",
    high: "Serein",
    profile: "Pilier",
    strengths: "Vous gardez votre calme dans l'urgence et rassurez votre entourage.",
    watch: "Restez attentif aux signaux de stress de votre équipe, même quand vous allez bien.",
    thrive: "Les postes exposés : opérations, chantiers, mines, centres d'appels, gestion de crise.",
    lowText: "Vous êtes attentif aux risques et aux détails, ce qui vous rend prudent.",
  },
];

// [trait, affirmation de gauche, affirmation de droite, inversé]
// Non inversé : la droite correspond au pôle « élevé » du trait. Inversé : la gauche.
export const ITEMS: [TraitCode, string, string, boolean][] = [
  ["ouverture", "Je préfère les méthodes qui ont fait leurs preuves.", "J'aime essayer de nouvelles façons de faire.", false],
  ["rigueur", "Je travaille mieux dans l'urgence, au dernier moment.", "Je planifie mon travail longtemps à l'avance.", false],
  ["extraversion", "Après une longue réunion, j'ai besoin de calme pour récupérer.", "Les réunions et les échanges me donnent de l'énergie.", false],
  ["cooperation", "Je défends mon point de vue jusqu'au bout.", "Je cherche d'abord un accord qui convienne à tous.", false],
  ["stabilite", "Les critiques sur mon travail me touchent longtemps.", "J'accepte les critiques et je passe vite à autre chose.", false],

  ["ouverture", "Je m'intéresse à des sujets très éloignés de mon métier.", "Je me concentre sur ce qui est utile à mon travail.", true],
  ["rigueur", "Je vérifie toujours mon travail avant de le rendre.", "Je préfère rendre vite, quitte à corriger ensuite.", true],
  ["extraversion", "Je prends facilement la parole devant un groupe.", "Je préfère écouter et intervenir quand on me le demande.", true],
  ["cooperation", "J'aide volontiers un collègue, même si cela retarde mon travail.", "Je termine d'abord mes tâches avant d'aider les autres.", true],
  ["stabilite", "Je reste calme quand tout s'accélère.", "La pression me rend nerveux et je perds mes moyens.", true],

  ["ouverture", "Un travail répétitif ne me dérange pas s'il est bien défini.", "Je m'ennuie vite si le travail ne change jamais.", false],
  ["rigueur", "Mes documents et mes fichiers sont souvent en désordre.", "Je range et classe mes documents au fur et à mesure.", false],
  ["extraversion", "Je préfère travailler seul sur un dossier.", "Je préfère travailler au contact des clients ou des collègues.", false],
  ["cooperation", "Je préfère être évalué sur mes résultats personnels.", "Je préfère être évalué sur les résultats de l'équipe.", false],
  ["stabilite", "Je m'inquiète souvent de ce qui pourrait mal tourner.", "Je fais confiance à la suite des événements.", false],

  ["ouverture", "J'aime imaginer comment l'entreprise pourrait fonctionner autrement.", "Je préfère améliorer ce qui existe déjà, pas à pas.", true],
  ["rigueur", "Je respecte les délais, même quand c'est difficile.", "Je demande souvent des délais supplémentaires.", true],
  ["extraversion", "Je crée facilement des contacts dans un nouvel environnement.", "Il me faut du temps pour être à l'aise avec de nouvelles personnes.", true],
  ["cooperation", "Je fais facilement confiance à mes collègues.", "J'attends que les gens fassent leurs preuves avant de leur faire confiance.", true],
  ["stabilite", "Je décide sereinement, même avec peu d'informations.", "J'hésite longtemps quand je n'ai pas toutes les informations.", true],

  ["ouverture", "Je me méfie des idées trop nouvelles.", "Les idées nouvelles me donnent de l'énergie.", false],
  ["rigueur", "Je change facilement de priorité selon l'inspiration du moment.", "Je termine ce que j'ai commencé avant de passer à autre chose.", false],
  ["extraversion", "Appeler un inconnu pour lui présenter un projet me met mal à l'aise.", "Aller vers des inconnus ne me pose aucun problème.", false],
  ["cooperation", "Quand un collègue se trompe, je le lui dis sans détour.", "Quand un collègue se trompe, je cherche une façon délicate de le lui dire.", false],
  ["stabilite", "Un imprévu peut gâcher ma journée.", "Je m'adapte rapidement aux imprévus.", false],
];

export const PAGE_SIZE = 5;
export type Scores = Record<TraitCode, number>;

// Réponses : une valeur de -2 (affirmation de gauche) à +2 (affirmation de droite) par paire.
export function scoreAnswers(answers: number[]): Scores {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  ITEMS.forEach(([t, , , reverse], i) => {
    const v = Math.max(-2, Math.min(2, Math.round(Number(answers[i]) || 0)));
    sums[t] = (sums[t] ?? 0) + (reverse ? -v : v);
    counts[t] = (counts[t] ?? 0) + 1;
  });
  const out = {} as Scores;
  for (const t of TRAITS) {
    const n = counts[t.code] ?? 1;
    out[t.code] = Math.round(((sums[t.code] ?? 0) + 2 * n) / (4 * n) * 100);
  }
  return out;
}

export function dominant(scores: Scores) {
  const sorted = [...TRAITS].sort((a, b) => scores[b.code] - scores[a.code]);
  return { first: sorted[0], second: sorted[1], lowest: sorted[sorted.length - 1] };
}

export function profileName(scores: Scores) {
  const d = dominant(scores);
  return `${d.first.profile}`;
}

export function traitLabel(code: string) {
  return TRAITS.find((t) => t.code === code)?.label ?? code;
}

// Règle de nouvelle passation : illimitée pendant 48 h, puis tous les 6 mois.
export function canRetake(firstAt: Date | null, lastAt: Date | null, now = new Date()) {
  if (!firstAt || !lastAt) return { ok: true, next: null as Date | null };
  if (now.getTime() - firstAt.getTime() < 48 * 3600_000) return { ok: true, next: null };
  const next = new Date(lastAt.getTime() + 182 * 86400_000);
  return { ok: now >= next, next };
}

// Adéquation de personnalité à une offre : moyenne des scores sur les traits recherchés (null si aucun trait demandé).
export function traitFit(scores: Scores | null | undefined, wanted: string[] | null | undefined) {
  const w = (wanted ?? []).filter((c): c is TraitCode => TRAITS.some((t) => t.code === c));
  if (!scores || !w.length) return null;
  return Math.round(w.reduce((s, c) => s + scores[c], 0) / w.length);
}

export function band(v: number) {
  return v >= 70 ? "marqué" : v >= 55 ? "plutôt présent" : v > 45 ? "équilibré" : v > 30 ? "plutôt faible" : "peu marqué";
}
