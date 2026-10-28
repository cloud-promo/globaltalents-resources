import Link from "next/link";
import { notFound } from "next/navigation";
import { one, query } from "@/lib/db";
import { date } from "@/lib/format";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;
type Article = { id: number; slug: string; title: string; category: string; excerpt: string; body: string; published_at: string };

async function load(slug: string) {
  return one<Article>(`SELECT id,slug,title,category,excerpt,body,published_at FROM articles WHERE slug=$1 AND published`, [slug]);
}

export async function generateMetadata({ params }: { params: Params }) {
  const a = await load((await params).slug);
  return a ? { title: a.title, description: a.excerpt } : { title: "Article introuvable" };
}

export default async function ArticlePage({ params }: { params: Params }) {
  const a = await load((await params).slug);
  if (!a) notFound();
  await query(`UPDATE articles SET views=views+1 WHERE id=$1`, [a.id]);
  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/conseils" className="text-sm text-ink-soft hover:text-indigo">Conseils carrière</Link>
      <p className="mt-6 text-sm font-semibold text-ochre">{a.category}</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{a.title}</h1>
      <p className="mt-3 text-sm text-muted">Publié le {date(a.published_at)}</p>
      <div className="prose-gtr mt-8 text-[1.05rem] leading-relaxed">
        {a.body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <div className="card mt-10 p-5">
        <p className="font-semibold">Prêt à postuler ?</p>
        <p className="mt-1 text-sm text-ink-soft">Des offres vérifiées dans six pays d&apos;Afrique de l&apos;Ouest.</p>
        <Link href="/offres" className="btn btn-primary mt-3">Voir les offres</Link>
      </div>
    </article>
  );
}
