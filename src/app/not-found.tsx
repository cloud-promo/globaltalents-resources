import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-3xl font-bold">Cette page n&apos;existe pas ou n&apos;est plus en ligne</h1>
      <p className="mt-3 text-ink-soft">L&apos;offre a peut-être été pourvue ou clôturée par le recruteur.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/offres" className="btn btn-primary">Voir les offres en ligne</Link>
        <Link href="/" className="btn btn-ghost">Accueil</Link>
      </div>
    </div>
  );
}
