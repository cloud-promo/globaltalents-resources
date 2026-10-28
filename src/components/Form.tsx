"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

export type FormState = { error?: string; ok?: string } | undefined;
type Action = (prev: FormState, data: FormData) => Promise<FormState>;

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  encType,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  encType?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className} encType={encType}>
      {state?.error && (
        <p role="alert" className="mb-4 rounded-lg border border-[#e9c3be] bg-clay-soft px-3 py-2 text-sm text-clay">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="mb-4 rounded-lg border border-[#bfe0cf] bg-leaf-soft px-3 py-2 text-sm text-leaf">
          {state.ok}
        </p>
      )}
      {children}
    </form>
  );
}

export function Submit({ children, className = "btn btn-primary", pendingLabel }: { children: React.ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel || "Enregistrement…" : children}
    </button>
  );
}
