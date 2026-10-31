# Global Talents Resources

Plateforme de recrutement et de gestion RH pour le Sénégal, la Côte d'Ivoire, le Mali, le Burkina Faso, le Niger et la Guinée.
Site : globaltalents-resources.com

Ce dépôt contient le **lot MVP** du cahier des charges : portail emploi, espace candidat, espace recruteur avec ATS et CVthèque, back-office d'administration et paiements (en mode démonstration).

## Ce qui est livré

| Espace | Fonctions |
| --- | --- |
| Public | Accueil avec recherche, offres avec 11 filtres, fiche offre (score de correspondance, partage WhatsApp, LinkedIn, Facebook, e-mail, signalement), entreprises, conseils carrière, pages légales, sitemap et balisage Google for Jobs |
| Candidat | Inscription, profil complet (identité, résumé, souhaits, expériences, formations, compétences, langues, documents), CV en PDF / Word / photo, candidature avec questions de présélection, candidature anonyme, suivi détaillé avec « Vos chances de succès », offres sauvegardées, alertes, entreprises suivies et masquées, notifications, paramètres de visibilité, export et suppression des données |
| Recruteur | Compte entreprise vérifié, tableau de bord, création et modification d'offres avec modération, questions éliminatoires, pipeline en colonnes ou en liste, actions groupées, fiche candidat (score, réponses, notes d'équipe, messages, CV), export CSV, CVthèque avec crédits, page entreprise, équipe, abonnement, paiement Mobile Money, factures |
| Administration | Vue d'ensemble par pays, modération des offres et des signalements, validation des entreprises, crédits offerts, utilisateurs et comptes d'équipe, paiements, articles, journal d'audit |
| Gestion des partenaires | Rôle dédié : inscriptions à vérifier (6 contrôles obligatoires), portefeuille avec chargé de compte, dossier entreprise (contacts, offres, paiements, historique d'appels), support et service après-vente (délais par priorité, notes internes, satisfaction), mises en avant datées, gestes commerciaux tracés, renouvellements à venir |
| Présélection automatique | « Affiche-moi les 10 candidats à interviewer » : classement expliqué, 70 % critères de l'offre (compétences, expérience, diplôme, métier, langues) puis 30 % motivation, zone d'habitat, salaire, disponibilité, test de personnalité ; demande en langage naturel, critères obligatoires, réglages par offre ; IA facultative pour l'analyse des lettres |
| Test de personnalité Boussole | 25 paires d'affirmations (questions originales, modèle des cinq grands traits), rapport forces et environnements, passation libre 48 h puis tous les 6 mois, adéquation affichée sur chaque offre, partage au choix du candidat |

## Lancer en local

Prérequis : Node.js 20 ou plus.

```bash
npm install
npm run db:local          # PostgreSQL local embarqué (laisser tourner)
cp .env.example .env.local
set -a; . ./.env.local; set +a
npm run migrate           # schéma, référentiels, données de démonstration
npm run dev               # http://localhost:3000
```

Tests de bout en bout (Python 3 et Playwright) : `npm test` (parcours généraux, en mode démonstration) et `python3 tests/partenaires.py` (gestion des partenaires, présélection, test de personnalité).

Paiement e-Wari en local : lancez le simulateur `node scripts/mock-ewari.mjs`, démarrez l'application avec `PAYMENTS_MODE=ewari`, `EWARI_API_URL=http://localhost:4010`, `EWARI_SECRET_KEY=sk_test_local`, `EWARI_WEBHOOK_SECRET=whsec_local`, puis `python3 tests/ewari.py`.

## Comptes de démonstration

Créés quand `SEED_DEMO=1`. Mot de passe : la valeur de `DEMO_PASSWORD` (par défaut `Demo-GTR-2026`).

- Candidat : `candidat@demo.globaltalents-resources.com` (14 autres candidats `candidat.<prénom>.<nom>@demo…` ont postulé à l'offre « Ingénieur cybersécurité (SOC) » pour la démonstration de la présélection)
- Gestion des partenaires : `gestion@demo.globaltalents-resources.com`
- Recruteurs : `recruteur.<entreprise>@demo.globaltalents-resources.com`, par exemple `recruteur.lagune-banque@demo.globaltalents-resources.com`
- Administrateur : `ADMIN_EMAIL` et `ADMIN_PASSWORD`, définis dans les variables d'environnement

En production réelle, mettez `SEED_DEMO=0` avant d'ouvrir le service au public, puis supprimez les entreprises de démonstration depuis la base.

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Connexion PostgreSQL |
| `APP_URL` | Adresse publique, par exemple `https://globaltalents-resources.com` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Compte administrateur créé au premier démarrage |
| `SEED_DEMO` | `1` pour charger les données de démonstration |
| `DEMO_PASSWORD` | Mot de passe des comptes de démonstration |
| `PAYMENTS_MODE` | `demo` (par défaut, aucun encaissement) ou `ewari` |
| `EWARI_API_URL`, `EWARI_SECRET_KEY`, `EWARI_WEBHOOK_SECRET` | Accès à l'API marchand e-Wari (voir `docs/EWARI.md`) |
| `ANTHROPIC_API_KEY` | Facultatif : active l'analyse IA des lettres de motivation et des demandes de présélection (sans clé : analyse par règles) |
| `AI_MODEL` | Facultatif : modèle utilisé (par défaut `claude-haiku-5-5`) |

## Architecture

- Next.js 15 (App Router, rendu serveur, actions serveur), TypeScript, Tailwind CSS 4
- PostgreSQL : schéma dans `db/schema.sql`, rejoué à chaque démarrage par `scripts/migrate.mjs`
- Sessions par cookie httpOnly, mots de passe hachés en Argon2, limitation des tentatives de connexion
- Cloisonnement : chaque requête recruteur est filtrée par l'entreprise de l'utilisateur
- Fichiers (CV) stockés en base, vérifiés par signature, 5 Mo maximum, téléchargement contrôlé

## Ce qui reste pour les lots suivants

- **V1** : encaissement e-Wari (fait côté Global Talents, en attente de l'API marchand e-Wari, voir `docs/EWARI.md`), IA (extraction de CV, rédaction d'offres), envoi réel des e-mails, SMS et WhatsApp, API publique, application Android
- **V2** : SIRH (dossiers, congés, temps, portail employé) et paie Sénégal et Côte d'Ivoire, labels employeur
- **V3** : paie des 4 autres pays, entretiens annuels, formation, SSO, marketplace de plugins

Points à faire valider avant l'ouverture au public : CGU et politique de confidentialité (juriste), déclarations auprès des autorités de protection des données de chaque pays, mentions légales des factures et TVA (expert-comptable), test d'intrusion.
