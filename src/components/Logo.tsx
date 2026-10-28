export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="6" fill="#23317A" />
      <rect x="5" y="5" width="5" height="18" rx="1.5" fill="#fff" />
      <rect x="11.5" y="5" width="5" height="18" rx="1.5" fill="#E2A32B" />
      <rect x="18" y="5" width="5" height="18" rx="1.5" fill="#fff" fillOpacity="0.55" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className={`font-display text-[1.05rem] font-bold leading-none ${light ? "text-white" : "text-ink"}`}>
        Global Talents
        <span className={`block text-[0.72rem] font-medium tracking-wide ${light ? "text-white/70" : "text-muted"}`}>Resources</span>
      </span>
    </span>
  );
}
