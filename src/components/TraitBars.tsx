import { TRAITS, band, type Scores } from "@/lib/personality";

// Barres bipolaires des 5 traits : pôle faible à gauche, pôle élevé à droite.
export function TraitBars({ scores, highlight = [] }: { scores: Scores; highlight?: string[] }) {
  return (
    <ul className="space-y-4">
      {TRAITS.map((t) => {
        const v = scores[t.code] ?? 50;
        const hl = highlight.includes(t.code);
        return (
          <li key={t.code}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold">
                {t.label}
                {hl && <span className="chip ml-2 bg-saffron-soft text-ochre">Recherché pour ce poste</span>}
              </span>
              <span className="text-ink-soft">{v} / 100, {band(v)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
              <span className="w-20 shrink-0 text-right">{t.low}</span>
              <div className="relative h-2.5 flex-1 rounded-full bg-wash" role="img" aria-label={`${t.label} : ${v} sur 100`}>
                <div className="absolute inset-y-0 left-1/2 w-px bg-line" aria-hidden="true" />
                <div
                  className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${hl ? "bg-saffron" : "bg-indigo"}`}
                  style={{ left: `${v}%` }}
                />
                <div className={`h-full rounded-full ${hl ? "bg-saffron/40" : "bg-indigo/25"}`} style={{ width: `${v}%` }} />
              </div>
              <span className="w-20 shrink-0">{t.high}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
