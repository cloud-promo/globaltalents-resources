"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn btn-ghost">
      Imprimer ou enregistrer en PDF
    </button>
  );
}
