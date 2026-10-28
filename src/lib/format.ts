const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function date(d: Date | string | null | undefined) {
  if (!d) return "";
  return dateFmt.format(new Date(d));
}

export function shortDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return shortFmt.format(new Date(d));
}

export function since(d: Date | string | null | undefined) {
  if (!d) return "";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} jours`;
  const m = Math.floor(days / 30);
  return m === 1 ? "il y a 1 mois" : `il y a ${m} mois`;
}

export function money(n: number | null | undefined, currency = "XOF") {
  if (n === null || n === undefined) return "";
  const s = new Intl.NumberFormat("fr-FR").format(n);
  return `${s} ${currency === "XOF" ? "FCFA" : currency}`;
}

export function salaryRange(min: number | null, max: number | null, currency: string) {
  if (!min && !max) return "";
  if (min && max) return `${money(min, currency).replace(/ (FCFA|GNF)$/, "")} à ${money(max, currency)} par mois`;
  return `${money(min || max, currency)} par mois`;
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function jobPath(id: number, title: string, city?: string) {
  return `/offres/${id}-${slugify(title + (city ? " " + city : ""))}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
