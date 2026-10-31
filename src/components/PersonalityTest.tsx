"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ITEMS, PAGE_SIZE } from "@/lib/personality";

const POSITIONS = [
  { v: -2, label: "Tout à fait d'accord avec l'affirmation de gauche" },
  { v: -1, label: "Plutôt d'accord avec l'affirmation de gauche" },
  { v: 0, label: "Sans préférence" },
  { v: 1, label: "Plutôt d'accord avec l'affirmation de droite" },
  { v: 2, label: "Tout à fait d'accord avec l'affirmation de droite" },
];

export function PersonalityTest({ action }: { action: (data: FormData) => void | Promise<void> }) {
  const pages = Math.ceil(ITEMS.length / PAGE_SIZE);
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => ITEMS.map(() => null));
  const slice = ITEMS.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const done = answers.filter((a) => a !== null).length;
  const pageDone = slice.every((_, i) => answers[page * PAGE_SIZE + i] !== null);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="answers" value={JSON.stringify(answers.map((a) => a ?? 0))} />
      <div>
        <div className="flex items-center justify-between text-sm text-ink-soft">
          <span>Page {page + 1} sur {pages}</span>
          <span>{done} / {ITEMS.length} réponses</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-wash" role="progressbar" aria-valuemin={0} aria-valuemax={ITEMS.length} aria-valuenow={done} aria-label="Progression du test">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo to-saffron transition-all" style={{ width: `${(done / ITEMS.length) * 100}%` }} />
        </div>
      </div>

      <ol className="space-y-4" start={page * PAGE_SIZE + 1}>
        {slice.map(([, left, right], k) => {
          const i = page * PAGE_SIZE + k;
          return (
            <li key={i} className="card p-4 sm:p-5">
              <fieldset>
                <legend className="sr-only">Paire {i + 1} : {left} ou {right}</legend>
                <div className="grid grid-cols-2 gap-4 text-sm font-medium sm:text-base">
                  <p className={`rounded-lg p-3 ${answers[i] !== null && answers[i]! < 0 ? "bg-wash text-indigo" : ""}`}>{left}</p>
                  <p className={`rounded-lg p-3 text-right ${answers[i] !== null && answers[i]! > 0 ? "bg-wash text-indigo" : ""}`}>{right}</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-1 px-1 sm:px-6">
                  {POSITIONS.map((p) => (
                    <label key={p.v} className="group grid cursor-pointer place-items-center">
                      <input
                        type="radio"
                        name={`q${i}`}
                        value={p.v}
                        checked={answers[i] === p.v}
                        onChange={() => setAnswers((a) => a.map((x, j) => (j === i ? p.v : x)))}
                        className="peer sr-only"
                        aria-label={p.label}
                      />
                      <span
                        className={`grid place-items-center rounded-full border-2 transition peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-saffron ${
                          Math.abs(p.v) === 2 ? "h-9 w-9" : Math.abs(p.v) === 1 ? "h-7 w-7" : "h-5 w-5"
                        } ${answers[i] === p.v ? "border-indigo bg-indigo" : "border-line bg-white group-hover:border-indigo"}`}
                        aria-hidden="true"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between gap-3">
        <button type="button" className="btn btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Précédent
        </button>
        {page < pages - 1 ? (
          <button type="button" className="btn btn-primary" disabled={!pageDone} onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0 }); }}>
            Suivant
          </button>
        ) : (
          <SubmitTest disabled={done < ITEMS.length} />
        )}
      </div>
      {!pageDone && <p className="text-center text-sm text-muted">Répondez aux {slice.length} paires pour continuer.</p>}
    </form>
  );
}

function SubmitTest({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={disabled || pending}>
      {pending ? "Calcul de vos résultats…" : "Voir mes résultats"}
    </button>
  );
}
