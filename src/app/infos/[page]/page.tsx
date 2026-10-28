import { notFound } from "next/navigation";

type Params = Promise<{ page: string }>;

const PAGES: Record<string, { title: string; body: string[] }> = {
  "a-propos": {
    title: "À propos de Global Talents Resources",
    body: [
      "Global Talents Resources est une plateforme de recrutement et de gestion des ressources humaines pour le Sénégal, la Côte d'Ivoire, le Mali, le Burkina Faso, le Niger et la Guinée.",
      "Elle réunit un portail d'offres d'emploi vérifiées, un outil de suivi des candidatures pour les recruteurs et, prochainement, un SIRH avec la paie de chaque pays.",
      "Global Talents Resources fait partie du groupe Global, aux côtés de Global Cyberock et de Global Finance, Immo et Négoce.",
    ],
  },
  faq: {
    title: "Questions fréquentes",
    body: [
      "Le service est-il gratuit pour les candidats ? Oui. La création de compte, la recherche, les candidatures et les alertes sont gratuites.",
      "Combien de temps une offre reste-t-elle en ligne ? 8 semaines par défaut. Le recruteur peut la fermer plus tôt ou la prolonger.",
      "Qui peut voir mon CV ? Les recruteurs des offres auxquelles vous postulez. Si vous l'activez dans vos paramètres, les recruteurs abonnés peuvent aussi trouver votre profil dans la CVthèque. Vos coordonnées restent masquées tant qu'ils ne l'ont pas débloqué.",
      "Comment est calculé le score de correspondance ? Il compare l'offre à votre profil : fonction, expérience, études, localisation et compétences. Le détail s'affiche sur chaque offre.",
      "Un recruteur me demande de payer pour un entretien. Que faire ? Ne payez jamais. Signalez l'offre avec le lien « Signaler une offre suspecte » : notre équipe la vérifiera.",
      "Comment payer en tant que recruteur ? Par Wave, Orange Money, Moov Money, MTN MoMo, Free Money ou carte bancaire. Les grands comptes peuvent payer par virement sur facture.",
    ],
  },
  cgu: {
    title: "Conditions générales d'utilisation",
    body: [
      "Version de travail à faire valider par un juriste avant la mise en production.",
      "Global Talents Resources met en relation des candidats et des employeurs. La plateforme ne garantit ni l'embauche d'un candidat ni la réponse d'un recruteur.",
      "Les recruteurs s'engagent à publier des offres réelles, conformes au droit du travail du pays concerné, sans discrimination et sans demander de paiement aux candidats.",
      "Les candidats s'engagent à fournir des informations exactes. Tout compte frauduleux peut être suspendu.",
      "Les contenus publiés restent sous la responsabilité de leurs auteurs. L'équipe de modération peut refuser ou retirer une offre à tout moment.",
    ],
  },
  confidentialite: {
    title: "Protection des données personnelles",
    body: [
      "Version de travail à faire valider par un juriste et à déclarer auprès des autorités de protection des données de chaque pays (CDP au Sénégal, ARTCI en Côte d'Ivoire, APDP au Mali, CIL au Burkina Faso, HAPDP au Niger, autorité compétente en Guinée).",
      "Données collectées : identité, coordonnées, parcours, CV et documents, candidatures, préférences. Elles servent uniquement à la recherche d'emploi, au recrutement et au fonctionnement du service.",
      "Destinataires : les recruteurs des offres auxquelles vous postulez et, si vous l'avez accepté, les recruteurs abonnés à la CVthèque. Aucune donnée n'est vendue.",
      "Vos droits : accès, rectification, export et suppression, directement depuis vos paramètres ou en écrivant à dpo@globaltalents-resources.com.",
      "Conservation : un profil inactif pendant 24 mois est anonymisé.",
    ],
  },
  contact: {
    title: "Contact",
    body: [
      "Candidats : support@globaltalents-resources.com",
      "Recruteurs et entreprises : entreprises@globaltalents-resources.com",
      "Protection des données : dpo@globaltalents-resources.com",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((page) => ({ page }));
}

export async function generateMetadata({ params }: { params: Params }) {
  const p = PAGES[(await params).page];
  return { title: p?.title ?? "Page introuvable" };
}

export default async function InfoPage({ params }: { params: Params }) {
  const p = PAGES[(await params).page];
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold">{p.title}</h1>
      <div className="mt-6 space-y-4 text-[1.02rem] leading-relaxed text-ink">
        {p.body.map((b, i) => <p key={i}>{b}</p>)}
      </div>
    </div>
  );
}
