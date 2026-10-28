// Données de référence et données de démonstration.

export const COUNTRIES = [
  { code: "SN", name: "Sénégal", currency: "XOF", phone: "+221", dpa: "CDP", sort: 1 },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", phone: "+225", dpa: "ARTCI", sort: 2 },
  { code: "ML", name: "Mali", currency: "XOF", phone: "+223", dpa: "APDP", sort: 3 },
  { code: "BF", name: "Burkina Faso", currency: "XOF", phone: "+226", dpa: "CIL", sort: 4 },
  { code: "NE", name: "Niger", currency: "XOF", phone: "+227", dpa: "HAPDP", sort: 5 },
  { code: "GN", name: "Guinée", currency: "GNF", phone: "+224", dpa: "APDP Guinée", sort: 6 },
];

export const CITIES = {
  SN: ["Dakar", "Thiès", "Saint-Louis", "Ziguinchor", "Kaolack", "Touba", "Mbour", "Diamniadio"],
  CI: ["Abidjan", "Bouaké", "Yamoussoukro", "San-Pédro", "Korhogo", "Daloa", "Man"],
  ML: ["Bamako", "Sikasso", "Kayes", "Ségou", "Mopti", "Koutiala"],
  BF: ["Ouagadougou", "Bobo-Dioulasso", "Koudougou", "Ouahigouya", "Banfora"],
  NE: ["Niamey", "Zinder", "Maradi", "Agadez", "Tahoua", "Dosso"],
  GN: ["Conakry", "Kankan", "Nzérékoré", "Kindia", "Labé", "Boké", "Kamsar"],
};

export const FUNCTIONS = [
  "Achats / Supply chain",
  "Administration des ventes / Service client",
  "Agriculture / Agronomie",
  "Assistanat / Services généraux",
  "Assurance",
  "Audit / Conseil",
  "Banque / Microfinance",
  "BTP / Travaux / Chantiers",
  "Centre d'appels / Relation client",
  "Commercial / Vente / Export",
  "Communication / Marketing",
  "Comptabilité / Finance / Contrôle de gestion",
  "Cybersécurité",
  "Data / Intelligence artificielle",
  "Droit / Juridique / Fiscalité",
  "Électricité / Énergie",
  "Enseignement / Formation",
  "Environnement / HSE",
  "Gestion de projet / Programmes",
  "Hôtellerie / Restauration / Tourisme",
  "Humanitaire / Développement",
  "Immobilier",
  "Informatique / Développement",
  "Ingénierie / Maintenance industrielle",
  "Journalisme / Traduction",
  "Logistique / Transport",
  "Mines / Géologie",
  "Production / Qualité",
  "Ressources humaines / Paie",
  "Santé / Médical / Paramédical",
  "Sécurité / Gardiennage",
  "Suivi-évaluation",
  "Télécoms / Réseaux",
  "Direction générale / Management",
];

export const SECTORS = [
  "Agriculture / Agro-industrie",
  "Agroalimentaire",
  "Assurance",
  "Audiovisuel / Médias",
  "Automobile",
  "Banque / Finance",
  "BTP / Génie civil",
  "Centres d'appels",
  "Chimie / Pharmacie",
  "Commerce / Distribution",
  "Conseil / Audit",
  "Éducation / Formation",
  "Énergie / Électricité",
  "Hôtellerie / Tourisme",
  "Immobilier",
  "Industrie",
  "Informatique / Services numériques",
  "Institutions internationales",
  "Logistique / Transport",
  "Microfinance",
  "Mines / Pétrole / Gaz",
  "ONG / Associations",
  "Recrutement / Intérim",
  "Santé",
  "Secteur public",
  "Sécurité",
  "Télécoms",
  "Textile",
];

export const PLANS = [
  { code: "annonce", name: "Annonce unique", description: "1 offre en ligne pendant 30 jours, mise en avant 7 jours", price: 35000, period: "once", jobs: 1, cv: 0, unlimited: false, days: 30, sort: 1 },
  { code: "pack5", name: "Pack 5 annonces", description: "5 offres à publier dans les 6 mois", price: 150000, period: "once", jobs: 5, cv: 0, unlimited: false, days: 180, sort: 2 },
  { code: "cvtheque1", name: "CVthèque 1 mois", description: "Coordonnées illimitées dans la CVthèque pendant 30 jours", price: 75000, period: "once", jobs: 0, cv: 0, unlimited: true, days: 30, sort: 3 },
  { code: "cvtheque3", name: "CVthèque 3 mois", description: "Coordonnées illimitées dans la CVthèque pendant 90 jours", price: 180000, period: "once", jobs: 0, cv: 0, unlimited: true, days: 90, sort: 4 },
  { code: "essentiel", name: "Recrutement Essentiel", description: "3 offres actives, suivi des candidatures, 20 profils CVthèque par mois", price: 60000, period: "month", jobs: 3, cv: 20, unlimited: false, days: 30, sort: 5 },
  { code: "pro", name: "Recrutement Pro", description: "Offres illimitées, CVthèque illimitée, page entreprise mise en avant", price: 150000, period: "month", jobs: 100, cv: 0, unlimited: true, days: 30, sort: 6 },
];

export const ARTICLES = [
  {
    slug: "cv-qui-se-fait-lire-en-30-secondes",
    title: "Un CV qui se fait lire en 30 secondes",
    category: "Conseils",
    excerpt: "Un recruteur parcourt un CV en moins d'une minute. Voici comment placer l'essentiel là où son regard se pose.",
    body: `Un recruteur qui reçoit 200 candidatures pour un poste lit chaque CV en moins d'une minute. Votre CV doit donc répondre à trois questions dès le premier coup d'œil : quel poste visez-vous, qu'avez-vous déjà accompli, et où êtes-vous disponible.

Commencez par un titre clair qui reprend l'intitulé du poste visé, par exemple « Comptable confirmé, maîtrise de SYSCOHADA ». Juste en dessous, trois lignes de résumé suffisent : vos années d'expérience, votre spécialité et un résultat chiffré.

Pour chaque expérience, remplacez les listes de tâches par des réalisations. « Réduit les délais de clôture mensuelle de 10 à 6 jours » parle davantage que « Chargé de la clôture mensuelle ».

Enfin, gardez une mise en page sobre et enregistrez votre CV en PDF. Sur Global Talents Resources, votre profil complet sert aussi de CV : plus il est rempli, plus le score de correspondance avec les offres est précis.`,
  },
  {
    slug: "preparer-un-entretien-a-distance",
    title: "Réussir un entretien à distance avec une connexion moyenne",
    category: "Conseils",
    excerpt: "Visioconférence instable, bruit, coupure : comment préparer un entretien en ligne quand le réseau n'est pas garanti.",
    body: `De plus en plus d'entreprises de la région organisent le premier entretien en visioconférence. Une coupure de réseau n'est pas éliminatoire si vous l'avez anticipée.

La veille, testez l'outil indiqué dans l'invitation (Google Meet, Zoom ou Teams) avec un proche. Prévoyez un forfait de données suffisant et, si possible, une seconde connexion en partage de connexion depuis un autre téléphone.

Le jour J, coupez la vidéo si l'image se fige et proposez de continuer en audio. Gardez le numéro du recruteur sous la main pour le rappeler en cas de coupure prolongée.

Préparez trois exemples concrets de réalisations, et une question sur les premiers mois dans le poste. Ce sont souvent ces réponses qui font la différence, bien plus que la qualité de l'image.`,
  },
  {
    slug: "rediger-une-offre-qui-attire-les-bons-profils",
    title: "Rédiger une offre d'emploi qui attire les bons profils",
    category: "Outils recruteurs",
    excerpt: "Un intitulé clair, un salaire indiqué et des critères réalistes : trois leviers simples pour recevoir moins de candidatures, mais de meilleure qualité.",
    body: `Une offre vague attire des centaines de candidatures hors sujet. Une offre précise en attire moins, mais elles correspondent au poste.

Utilisez un intitulé que les candidats recherchent vraiment : « Chargé de recouvrement » plutôt que « Gestionnaire portefeuille clients niveau 2 ». Indiquez la ville et le type de contrat dès le titre.

Affichez une fourchette de salaire quand vous le pouvez. Les offres avec salaire reçoivent des candidatures plus ciblées et évitent des entretiens qui échouent sur la rémunération.

Séparez les critères indispensables des critères souhaités. Sur Global Talents Resources, vous pouvez ajouter des questions de présélection éliminatoires, par exemple la disponibilité immédiate ou la possession d'un permis.`,
  },
  {
    slug: "marche-emploi-afrique-ouest-2026",
    title: "Emploi en Afrique de l'Ouest : les métiers qui recrutent en 2026",
    category: "Actualité de l'emploi",
    excerpt: "Mines, télécoms, banque et numérique continuent de porter les recrutements de cadres dans la région.",
    body: `Les offres publiées sur la plateforme montrent une demande soutenue dans quatre familles de métiers.

Les mines et l'énergie recrutent des ingénieurs, des techniciens de maintenance et des responsables HSE, en Guinée, au Mali, au Burkina Faso et au Niger.

Les télécoms et le numérique cherchent des profils en cybersécurité, en données et en développement, surtout à Dakar et à Abidjan.

La banque et la microfinance recrutent des chargés de clientèle, des analystes crédit et des contrôleurs internes.

Enfin, les ONG et les organisations internationales restent de grands employeurs pour la gestion de projet et le suivi-évaluation.`,
  },
];

// Entreprises fictives pour la démonstration.
export const DEMO_COMPANIES = [
  { name: "Teranga Télécom", slug: "teranga-telecom", country: "SN", city: "Dakar", sector: "Télécoms", size: "251 à 1 000", color: "#1F6F8B", featured: true,
    description: "Opérateur de services numériques au Sénégal : fibre, données mobiles et solutions pour les entreprises.",
    culture: "Des équipes jeunes, des projets livrés en mode agile et une forte culture du service client.",
    benefits: "Assurance maladie famille, forfait mobile, formation certifiante chaque année." },
  { name: "Lagune Banque", slug: "lagune-banque", country: "CI", city: "Abidjan", sector: "Banque / Finance", size: "Plus de 1 000", color: "#2B3A8C", featured: true,
    description: "Banque universelle présente en Côte d'Ivoire et dans trois pays de l'UEMOA.",
    culture: "Rigueur, conformité et proximité avec les clients, PME comme particuliers.",
    benefits: "13e mois, prêts à taux préférentiel, mutuelle santé." },
  { name: "Kaïdara Mines", slug: "kaidara-mines", country: "GN", city: "Boké", sector: "Mines / Pétrole / Gaz", size: "251 à 1 000", color: "#8A5A1F", featured: true,
    description: "Société d'exploitation de bauxite et de services miniers dans la région de Boké.",
    culture: "La sécurité avant tout, avec un programme de promotion interne des techniciens guinéens.",
    benefits: "Logement sur site, transport, prime de rotation." },
  { name: "Djoliba Logistique", slug: "djoliba-logistique", country: "ML", city: "Bamako", sector: "Logistique / Transport", size: "51 à 250", color: "#2F7D5B", featured: false,
    description: "Transport routier et entreposage entre les ports de Dakar, d'Abidjan et le Mali.",
    culture: "Une entreprise familiale qui se modernise, avec des outils numériques de suivi de flotte.",
    benefits: "Prime de rendement, couverture santé." },
  { name: "Faso Énergie Solaire", slug: "faso-energie-solaire", country: "BF", city: "Ouagadougou", sector: "Énergie / Électricité", size: "51 à 250", color: "#C2861A", featured: true,
    description: "Installation et maintenance de centrales solaires pour les entreprises et les collectivités.",
    culture: "Des projets à impact, des équipes terrain soudées et beaucoup d'autonomie.",
    benefits: "Véhicule de service, formation technique continue." },
  { name: "Sahel Santé ONG", slug: "sahel-sante-ong", country: "NE", city: "Niamey", sector: "ONG / Associations", size: "51 à 250", color: "#A23B4F", featured: false,
    description: "ONG de santé communautaire qui intervient dans les régions de Tillabéri, Dosso et Maradi.",
    culture: "Engagement, travail de terrain et redevabilité envers les communautés.",
    benefits: "Grille salariale ONG, assurance, congés de récupération." },
];

// [entreprise, titre, fonction, secteur, ville, contrat, expérience, études, salaire min, max, compétences]
export const DEMO_JOBS = [
  ["teranga-telecom", "Ingénieur cybersécurité (SOC)", "Cybersécurité", "Télécoms", "Dakar", "CDI", "confirme", "bac5", 900000, 1400000, ["SIEM", "SOC", "ISO 27001", "Linux", "Firewall"]],
  ["teranga-telecom", "Développeur full-stack JavaScript", "Informatique / Développement", "Télécoms", "Dakar", "CDI", "intermediaire", "bac4", 600000, 950000, ["JavaScript", "React", "Node.js", "PostgreSQL"]],
  ["teranga-telecom", "Conseiller client bilingue (centre d'appels)", "Centre d'appels / Relation client", "Télécoms", "Dakar", "CDD", "debutant", "bac", 180000, 250000, ["Anglais", "Relation client", "Wolof"]],
  ["teranga-telecom", "Stagiaire data analyst", "Data / Intelligence artificielle", "Télécoms", "Dakar", "Stage", "debutant", "bac4", 100000, 150000, ["SQL", "Python", "Power BI"]],
  ["lagune-banque", "Chargé de clientèle entreprises", "Banque / Microfinance", "Banque / Finance", "Abidjan", "CDI", "confirme", "bac5", 800000, 1200000, ["Crédit", "PME", "Analyse financière"]],
  ["lagune-banque", "Contrôleur interne", "Audit / Conseil", "Banque / Finance", "Abidjan", "CDI", "intermediaire", "bac5", 700000, 1000000, ["Contrôle interne", "Conformité", "BCEAO"]],
  ["lagune-banque", "Analyste risque de crédit", "Comptabilité / Finance / Contrôle de gestion", "Banque / Finance", "Abidjan", "CDI", "junior", "bac5", 550000, 800000, ["Excel", "Analyse financière", "SYSCOHADA"]],
  ["lagune-banque", "Responsable paie et administration du personnel", "Ressources humaines / Paie", "Banque / Finance", "Abidjan", "CDI", "confirme", "bac4", 750000, 1100000, ["Paie", "CNPS", "Sage Paie", "Droit du travail"]],
  ["lagune-banque", "Chargé de recouvrement", "Banque / Microfinance", "Banque / Finance", "Bouaké", "CDD", "junior", "bac3", 350000, 500000, ["Recouvrement", "Négociation"]],
  ["kaidara-mines", "Superviseur HSE", "Environnement / HSE", "Mines / Pétrole / Gaz", "Boké", "CDI", "confirme", "bac4", 8000000, 12000000, ["HSE", "ISO 45001", "Audit sécurité"]],
  ["kaidara-mines", "Mécanicien engins lourds", "Ingénierie / Maintenance industrielle", "Mines / Pétrole / Gaz", "Kamsar", "CDI", "intermediaire", "bac2", 5000000, 7500000, ["Caterpillar", "Hydraulique", "Diagnostic"]],
  ["kaidara-mines", "Géologue d'exploration", "Mines / Géologie", "Mines / Pétrole / Gaz", "Boké", "CDD", "junior", "bac5", 9000000, 13000000, ["Géologie", "SIG", "Forage"]],
  ["kaidara-mines", "Responsable des achats", "Achats / Supply chain", "Mines / Pétrole / Gaz", "Conakry", "CDI", "expert", "bac5", 15000000, 22000000, ["Achats", "Appels d'offres", "SAP"]],
  ["djoliba-logistique", "Responsable d'exploitation transport", "Logistique / Transport", "Logistique / Transport", "Bamako", "CDI", "confirme", "bac3", 600000, 900000, ["Gestion de flotte", "Transit", "Douane"]],
  ["djoliba-logistique", "Comptable", "Comptabilité / Finance / Contrôle de gestion", "Logistique / Transport", "Bamako", "CDI", "intermediaire", "bac3", 400000, 600000, ["SYSCOHADA", "Sage", "Fiscalité"]],
  ["djoliba-logistique", "Chauffeur poids lourd longue distance", "Logistique / Transport", "Logistique / Transport", "Kayes", "CDD", "intermediaire", "sans", 200000, 300000, ["Permis C", "Permis E"]],
  ["faso-energie-solaire", "Ingénieur électricien photovoltaïque", "Électricité / Énergie", "Énergie / Électricité", "Ouagadougou", "CDI", "intermediaire", "bac5", 650000, 900000, ["Photovoltaïque", "AutoCAD", "Dimensionnement"]],
  ["faso-energie-solaire", "Technicien de maintenance solaire", "Ingénierie / Maintenance industrielle", "Énergie / Électricité", "Bobo-Dioulasso", "CDI", "junior", "bac2", 250000, 380000, ["Électricité", "Onduleurs", "Batteries"]],
  ["faso-energie-solaire", "Commercial B2B énergie", "Commercial / Vente / Export", "Énergie / Électricité", "Ouagadougou", "CDI", "confirme", "bac3", 500000, 800000, ["Vente B2B", "Négociation", "Prospection"]],
  ["sahel-sante-ong", "Chef de projet santé communautaire", "Gestion de projet / Programmes", "ONG / Associations", "Niamey", "CDD", "confirme", "bac5", 1100000, 1600000, ["Gestion de projet", "Santé publique", "Bailleurs"]],
  ["sahel-sante-ong", "Chargé de suivi-évaluation", "Suivi-évaluation", "ONG / Associations", "Maradi", "CDD", "intermediaire", "bac4", 700000, 950000, ["Suivi-évaluation", "KoboToolbox", "Excel"]],
  ["sahel-sante-ong", "Infirmier superviseur", "Santé / Médical / Paramédical", "ONG / Associations", "Dosso", "CDD", "intermediaire", "bac3", 450000, 650000, ["Soins infirmiers", "Supervision", "Haoussa"]],
  ["sahel-sante-ong", "Assistant administratif et financier", "Assistanat / Services généraux", "ONG / Associations", "Niamey", "CDD", "junior", "bac2", 300000, 420000, ["Comptabilité", "Logistique", "Excel"]],
  ["teranga-telecom", "Chef de projet déploiement fibre", "Télécoms / Réseaux", "Télécoms", "Thiès", "CDI", "confirme", "bac5", 950000, 1300000, ["FTTH", "Gestion de projet", "Sous-traitance"]],
];
