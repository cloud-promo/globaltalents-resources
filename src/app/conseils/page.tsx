import Link from "next/link";
import { query } from "@/lib/db";
import { date } from "@/lib/format";
import { ARTICLE_CATEGORIES } from "@/lib/ref";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conseils carrière et recrutement" };

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<{ categorie?: string }> }) {
  const { categorie } = await searchParams;
  const articles = await query<{ slug: string; title: string; excerpt: string; category: string; published_at: string; views: number }>(
    `SELECT slug,title,excerpt,category,published_at,views FROM articles WHERE published AND ($1::text IS NULL OR category=$1) ORDER BY published_at DESC`,
    [categorie ?? null],
  );
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold">Conseils carrière</h1>
      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Catégories">
        <Link href="/conseils" className={`chip ${!categorie ? "bg-indigo text-white" : ""}`}>Tous</Link>
        {ARTICLE_CATEGORIES.map((c) => (
          <Link key={c} href={`/conseils?categorie=${encodeURIComponent(c)}`} className={`chip ${categorie === c ? "bg-indigo text-white" : ""}`}>{c}</Link>
        ))}
      </nav>
      <div className="mt-6 space-y-3">
        {articles.map((a) => (
          <Link key={a.slug} href={`/conseils/${a.slug}`} className="card block p-5 hover:border-indigo">
            <span className="text-xs font-semibold text-ochre">{a.category}</span>
            <h2 className="mt-1 text-xl font-semibold">{a.title}</h2>
            <p className="mt-2 text-ink-soft">{a.excerpt}</p>
            <p className="mt-3 text-xs text-muted">{date(a.published_at)}, {a.views} lecture{a.views > 1 ? "s" : ""}</p>
          </Link>
        ))}
        {!articles.length && <p className="card p-6 text-ink-soft">Aucun article dans cette catégorie.</p>}
      </div>
    </div>
  );
}
