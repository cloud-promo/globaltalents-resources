import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const APP_URL = process.env.APP_URL || "https://globaltalents-resources.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Global Talents Resources : offres d'emploi et recrutement en Afrique de l'Ouest",
    template: "%s | Global Talents Resources",
  },
  description:
    "Offres d'emploi au Sénégal, en Côte d'Ivoire, au Mali, au Burkina Faso, au Niger et en Guinée. Déposez votre CV, postulez et suivez vos candidatures. Recruteurs : publiez vos offres et gérez vos candidats.",
  openGraph: { siteName: "Global Talents Resources", locale: "fr_FR", type: "website" },
};

export const viewport: Viewport = { themeColor: "#23317A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@500;600;700&family=Public+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen antialiased">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Aller au contenu
        </a>
        <Header />
        <main id="contenu">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
