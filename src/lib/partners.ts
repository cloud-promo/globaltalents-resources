// Référentiels de la gestion des partenaires (entreprises clientes)

export const VERIFICATION_CHECKS = [
  { code: "rccm", label: "Numéro RCCM ou d'immatriculation cohérent avec le pays", hint: "Format du registre du pays, raison sociale identique." },
  { code: "tax", label: "Identifiant fiscal (NINEA, NCC, NIF…) vérifié", hint: "Demander un justificatif si doute." },
  { code: "phone", label: "Appel de contrôle au standard de l'entreprise", hint: "Le contact existe et confirme l'inscription." },
  { code: "email", label: "Adresse e-mail professionnelle (domaine de l'entreprise)", hint: "Gmail, Yahoo… : exiger un justificatif supplémentaire." },
  { code: "web", label: "Présence en ligne vérifiée (site, LinkedIn, Google Maps)", hint: "Activité réelle et cohérente avec le secteur déclaré." },
  { code: "fraud", label: "Aucun signal de fraude (frais demandés aux candidats, offre irréaliste)", hint: "Une offre qui fait payer les candidats = refus immédiat." },
] as const;

export const TICKET_CATEGORIES = [
  { code: "compte", label: "Compte et vérification" },
  { code: "offre", label: "Publication d'une offre" },
  { code: "paiement", label: "Paiement e-Wari et facturation" },
  { code: "cvtheque", label: "CVthèque et crédits" },
  { code: "candidats", label: "Candidatures et présélection" },
  { code: "mise_en_avant", label: "Mise en avant et visibilité" },
  { code: "technique", label: "Problème technique" },
  { code: "autre", label: "Autre demande" },
] as const;

export const TICKET_STATUS: Record<string, { label: string; tone: string; staff?: string }> = {
  ouvert: { label: "Ouvert", tone: "bg-saffron-soft text-ochre" },
  en_cours: { label: "En cours", tone: "bg-wash text-indigo" },
  attente_client: { label: "En attente de votre réponse", tone: "bg-wash text-ink-soft", staff: "En attente du client" },
  resolu: { label: "Résolu", tone: "bg-leaf-soft text-leaf" },
  ferme: { label: "Fermé", tone: "bg-wash text-muted" },
};

export const TICKET_PRIORITY: Record<string, string> = { basse: "Basse", normale: "Normale", haute: "Haute", urgente: "Urgente" };

// Délai de première réponse visé, en heures
export const SLA_HOURS: Record<string, number> = { urgente: 4, haute: 8, normale: 24, basse: 48 };

export const NOTE_KINDS: Record<string, string> = {
  note: "Note",
  appel: "Appel",
  email: "E-mail",
  visite: "Visite",
  relance: "Relance commerciale",
  geste: "Geste commercial",
};

export const FEATURE_DURATIONS = [7, 15, 30, 60, 90] as const;

export function categoryLabel(code: string) {
  return TICKET_CATEGORIES.find((c) => c.code === code)?.label ?? code;
}

export function staffStatus(code: string) {
  const s = TICKET_STATUS[code];
  return { label: s?.staff ?? s?.label ?? code, tone: s?.tone ?? "" };
}
