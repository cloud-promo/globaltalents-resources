import Link from "next/link";
import { query, one } from "@/lib/db";
import { shortDate } from "@/lib/format";
import { ARTICLE_CATEGORIES } from "@/lib/ref";
import { ActionForm, Submit } from "@/components/Form";
import { saveArticle } from "@/app/actions/admin";

export const metadata = { title: "Articles" };
export const dynamic = "force-dynamic";

export default async function AdminArticles({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const articles = await query<{ id: number; slug: string; title: string; category: string; published: boolean; views: number; published_at: string }>(
    `SELECT id,slug,title,category,published,views,published_at FROM articles ORDER BY published_at DESC`,
  );
  const current = edit ? await one<{ id: number; title: string; excerpt: string; body: string; category: string; published: boolean }>(`SELECT id,title,excerpt,body,category,published FROM articles WHERE id=$1`, [Number(edit) || 0]) : null;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Articles</h1>
      <ActionForm action={saveArticle} className="card space-y-3 p-5" key={current?.id ?? "new"}>
        <h2 className="text-lg font-bold">{current ? "Modifier l'article" : "Nouvel article"}</h2>
        {current && <input type="hidden" name="id" value={current.id} />}
        <input name="title" defaultValue={current?.title} className="input" placeholder="Titre" aria-label="Titre" required />
        <input name="excerpt" defaultValue={current?.excerpt} className="input" placeholder="Chapeau (une ou deux phrases)" aria-label="Chapeau" required maxLength={300} />
        <select name="category" defaultValue={current?.category ?? ""} className="input" aria-label="Catégorie" required>
          <option value="" disabled>Catégorie</option>
          {ARTICLE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <textarea name="body" defaultValue={current?.body} className="input min-h-64" placeholder="Texte. Une ligne vide sépare deux paragraphes." aria-label="Texte" required />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={current?.published ?? true} /> Publié</label>
        <div className="flex gap-2">
          <Submit>{current ? "Enregistrer" : "Créer l'article"}</Submit>
          {current && <Link href="/admin/articles" className="btn btn-ghost">Nouvel article</Link>}
        </div>
      </ActionForm>
      <ul className="card divide-y divide-line">
        {articles.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span><span className="block font-semibold">{a.title}</span><span className="text-ink-soft">{a.category}, {shortDate(a.published_at)}, {a.views} lecture(s){!a.published && ", non publié"}</span></span>
            <span className="flex gap-2">
              <Link href={`/conseils/${a.slug}`} className="btn btn-ghost btn-sm">Voir</Link>
              <Link href={`/admin/articles?edit=${a.id}`} className="btn btn-ghost btn-sm">Modifier</Link>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
