import { toggleSaveJob } from "@/app/actions/candidate";

export function SaveButton({ jobId, saved }: { jobId: number; saved: boolean }) {
  return (
    <form action={toggleSaveJob}>
      <input type="hidden" name="job_id" value={jobId} />
      <button
        className={`grid h-9 w-9 place-items-center rounded-full border ${saved ? "border-saffron bg-saffron-soft text-ochre" : "border-line bg-white text-muted hover:text-indigo"}`}
        aria-label={saved ? "Retirer des offres sauvegardées" : "Sauvegarder l'offre"}
        aria-pressed={saved}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </form>
  );
}
