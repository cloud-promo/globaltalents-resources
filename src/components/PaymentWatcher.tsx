"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Interroge l'état du paiement et recharge la page dès qu'il change.
export function PaymentWatcher({ id }: { id: string }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let stop = false;
    let n = 0;
    const tick = async () => {
      if (stop) return;
      n++;
      setTries(n);
      try {
        const r = await fetch(`/api/paiements/${id}/statut`, { cache: "no-store" });
        const j = await r.json();
        if (j.status && j.status !== "pending") {
          router.refresh();
          return;
        }
      } catch {
        /* réseau instable : on réessaie */
      }
      setTimeout(tick, n < 20 ? 3000 : 8000);
    };
    const t = setTimeout(tick, 3000);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [id, router]);
  return (
    <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft" role="status" aria-live="polite">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-saffron" aria-hidden="true" />
      En attente de la confirmation e-Wari{tries > 20 ? ". Si vous avez déjà payé, la confirmation peut prendre une minute." : "…"}
    </p>
  );
}
