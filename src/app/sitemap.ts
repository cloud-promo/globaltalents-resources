import type { MetadataRoute } from "next";
import { query } from "@/lib/db";
import { JOB_FROM, PUBLISHED } from "@/lib/jobs";
import { jobPath } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL || "https://globaltalents-resources.com";
  const [jobs, companies, articles] = await Promise.all([
    query<{ id: number; title: string; city: string; updated_at: string }>(`SELECT j.id,j.title,j.city,j.updated_at ${JOB_FROM} WHERE ${PUBLISHED}`),
    query<{ slug: string }>(`SELECT slug FROM companies WHERE status='verified'`),
    query<{ slug: string; published_at: string }>(`SELECT slug,published_at FROM articles WHERE published`),
  ]);
  const countries = ["SN", "CI", "ML", "BF", "NE", "GN"];
  return [
    { url: base, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/offres`, changeFrequency: "hourly", priority: 0.9 },
    ...countries.map((c) => ({ url: `${base}/offres?pays=${c}`, changeFrequency: "daily" as const, priority: 0.8 })),
    { url: `${base}/entreprises`, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/recruteurs`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/conseils`, changeFrequency: "weekly", priority: 0.5 },
    ...jobs.map((j) => ({ url: base + jobPath(j.id, j.title, j.city), lastModified: j.updated_at, changeFrequency: "daily" as const, priority: 0.8 })),
    ...companies.map((c) => ({ url: `${base}/entreprises/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...articles.map((a) => ({ url: `${base}/conseils/${a.slug}`, lastModified: a.published_at, priority: 0.4 })),
  ];
}
