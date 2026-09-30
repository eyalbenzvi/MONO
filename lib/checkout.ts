import { STORE_POLICY } from "@/lib/store-policy";

/**
 * The delivery country, guessed and checked. A guess never overrides what
 * the shopper typed: the time zone first (its biggest city, as Make finds a
 * place), then the browser's language region ("he-IL" → Israel), else none
 * (the form asks). Once a city or postcode is typed, a country that can't
 * go with it is flagged ("Check your country"), never silently kept.
 */
export type CountryCode = (typeof STORE_POLICY.countries)[number][0];

const OFFERED = new Set<string>(STORE_POLICY.countries.map(([code]) => code));
const CODE_BY_NAME = new Map<string, CountryCode>(STORE_POLICY.countries.map(([code, name]) => [name.toLowerCase(), code]));

/** An offered country's code from a place list's country name ("The Netherlands" → "NL"), or null. */
export const codeOfCountry = (name: string | undefined): CountryCode | null => (name ? (CODE_BY_NAME.get(name.replace(/^The /i, "").toLowerCase()) ?? null) : null);

/** The first offered country among the browser's languages' regions ("en-GB" → "GB"). */
export function countryFromLanguages(languages: readonly string[]): CountryCode | null {
  for (const tag of languages) {
    const region = tag.split(/[-_]/)[1]?.toUpperCase();
    if (region && OFFERED.has(region)) return region as CountryCode;
  }
  return null;
}

/** Each offered country's postcode shape. */
const POSTCODES: Record<CountryCode, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  GB: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/,
  CA: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/,
  IL: /^\d{7}$/,
  DE: /^\d{5}$/,
  FR: /^\d{5}$/,
  NL: /^\d{4} ?[A-Z]{2}$/,
  AU: /^\d{4}$/,
};

/** The offered countries a postcode could belong to (none when it fits no shape). */
export function postcodeCountries(zip: string): CountryCode[] {
  const z = zip.trim().toUpperCase();
  if (!z) return [];
  return (Object.keys(POSTCODES) as CountryCode[]).filter((c) => POSTCODES[c].test(z));
}

/**
 * Does the chosen country contradict what was typed? The postcode, when it
 * fits some country's shape but not this one's; the city, when it's a place
 * the list knows only in other offered countries.
 */
export function countryConflicts(country: string, zip: string, cityCountries: readonly CountryCode[]): boolean {
  if (!country) return false;
  const byZip = postcodeCountries(zip);
  if (byZip.length && !byZip.includes(country as CountryCode)) return true;
  return cityCountries.length > 0 && !cityCountries.includes(country as CountryCode);
}
