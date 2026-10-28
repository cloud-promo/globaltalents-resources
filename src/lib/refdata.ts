import "server-only";
import { unstable_cache } from "next/cache";
import { query } from "./db";

export type Country = { code: string; name: string; currency: string; phone_prefix: string; dpa: string };
export type City = { id: number; country_code: string; name: string };
export type Named = { id: number; name: string };

export const getRefs = unstable_cache(
  async () => {
    const [countries, cities, functions, sectors] = await Promise.all([
      query<Country>(`SELECT code,name,currency,phone_prefix,dpa FROM countries ORDER BY sort`),
      query<City>(`SELECT id,country_code,name FROM cities ORDER BY name`),
      query<Named>(`SELECT id,name FROM functions ORDER BY name`),
      query<Named>(`SELECT id,name FROM sectors ORDER BY name`),
    ]);
    return { countries, cities, functions, sectors };
  },
  ["refs-v1"],
  { revalidate: 3600 },
);

export function countryName(countries: Country[], code: string | null | undefined) {
  return countries.find((c) => c.code === code)?.name ?? "";
}
