import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL || "https://globaltalents-resources.com";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/candidat", "/recruteur", "/admin", "/api"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
