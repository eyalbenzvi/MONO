/**
 * Your Countries: the countries you've been to, on an Equal Earth world map
 * (data/countries, Natural Earth), the count out of 195, your name and the
 * year it started. The countries travel as one bit each over COUNTRY_CODES
 * (fixed: alphabetical, and a country added later only ever at the end). Drawn
 * by lib/custom/templates/countries.
 */
import { FIRST_YEAR, LAST_YEAR, int, label, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The countries: a bit each over COUNTRY_CODES, base64url. */
  x: string;
  /** Whose (optional). */
  n?: string;
  /** Since (optional). */
  y?: number;
  cap?: Cap;
}

export const NAME = "Your Countries";
export const COUNTRIES_NAME_MAX = 14;
/** The United Nations' count of countries: what the map counts against. */
export const OF = 195;

/** Natural Earth's alpha-3 codes (data/countries), alphabetical, then those added since: bit i is COUNTRY_CODES[i]. */
export const COUNTRY_CODES = [
  "ABW", "AFG", "AGO", "AIA", "ALB", "ALD", "AND", "ARE", "ARG", "ARM", "ASM", "ATA", "ATF", "ATG", "AUS", "AUT", "AZE", "BDI", "BEL", "BEN",
  "BFA", "BGD", "BGR", "BHR", "BHS", "BIH", "BLM", "BLR", "BLZ", "BMU", "BOL", "BRA", "BRB", "BRN", "BTN", "BWA", "CAF", "CAN", "CHE", "CHL",
  "CHN", "CIV", "CMR", "COD", "COG", "COK", "COL", "COM", "CRI", "CUB", "CUW", "CYM", "CYN", "CYP", "CZE", "DEU", "DJI", "DMA", "DNK", "DOM",
  "DZA", "ECU", "EGY", "ERI", "ESP", "EST", "ETH", "FIN", "FJI", "FLK", "FRA", "FRO", "FSM", "GAB", "GBR", "GEO", "GGY", "GHA", "GIN", "GMB",
  "GNB", "GNQ", "GRC", "GRD", "GRL", "GTM", "GUM", "GUY", "HKG", "HND", "HRV", "HTI", "HUN", "IDN", "IMN", "IND", "IRL", "IRN", "IRQ", "ISL",
  "ISR", "ITA", "JAM", "JEY", "JOR", "JPN", "KAZ", "KEN", "KGZ", "KHM", "KIR", "KNA", "KOR", "KOS", "KWT", "LAO", "LBN", "LBR", "LBY", "LCA",
  "LIE", "LKA", "LSO", "LTU", "LUX", "LVA", "MAC", "MAF", "MAR", "MCO", "MDA", "MDG", "MDV", "MEX", "MHL", "MKD", "MLI", "MLT", "MMR", "MNE",
  "MNG", "MNP", "MOZ", "MRT", "MUS", "MWI", "MYS", "NAM", "NCL", "NER", "NGA", "NIC", "NIU", "NLD", "NOR", "NPL", "NRU", "NZL", "OMN", "PAK",
  "PAN", "PCN", "PER", "PHL", "PLW", "PNG", "POL", "PRI", "PRK", "PRT", "PRY", "PSX", "PYF", "QAT", "ROU", "RUS", "RWA", "SAH", "SAU", "SDN",
  "SDS", "SEN", "SGP", "SGS", "SHN", "SLB", "SLE", "SLV", "SMR", "SOL", "SOM", "SPM", "SRB", "STP", "SUR", "SVK", "SVN", "SWE", "SWZ", "SXM",
  "SYC", "SYR", "TCA", "TCD", "TGO", "THA", "TJK", "TKM", "TLS", "TON", "TTO", "TUN", "TUR", "TUV", "TWN", "TZA", "UGA", "UKR", "URY", "USA",
  "UZB", "VAT", "VCT", "VEN", "VGB", "VIR", "VNM", "VUT", "WLF", "WSM", "YEM", "ZAF", "ZMB", "ZWE",
  // Added since: Cabo Verde (a point, scripts/tools/buildCountries).
  "CPV",
] as const;

/**
 * The places on the map that aren't among the 195 (the United Nations' 193
 * members, the Holy See and Palestine): territories and dependencies, and a
 * few places not seated at the United Nations. They're drawn when chosen,
 * but not counted.
 */
export const NOT_COUNTED: readonly string[] = [
  "ABW", "AIA", "ALD", "ASM", "ATA", "ATF", "BLM", "BMU", "COK", "CUW", "CYM", "CYN", "FLK", "FRO", "GGY", "GRL", "GUM", "HKG", "IMN", "JEY",
  "KOS", "MAC", "MAF", "MNP", "NCL", "NIU", "PCN", "PRI", "PYF", "SAH", "SGS", "SHN", "SOL", "SPM", "SXM", "TCA", "TWN", "VGB", "VIR", "WLF",
];
/** How many of the chosen are among the 195. */
export const counted = (codes: readonly string[]) => codes.filter((c) => !NOT_COUNTED.includes(c)).length;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

const BYTES = Math.ceil(COUNTRY_CODES.length / 8);
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** The chosen codes packed: a bit each, base64url (no padding). */
export function packCountries(codes: readonly string[]): string {
  const bytes = new Uint8Array(BYTES);
  for (const c of codes) {
    const i = (COUNTRY_CODES as readonly string[]).indexOf(c);
    if (i >= 0) bytes[i >> 3] |= 1 << (i & 7);
  }
  let bits = 0, n = 0, out = "";
  for (const b of bytes) {
    bits = (bits << 8) | b;
    n += 8;
    while (n >= 6) out += B64[(bits >> (n -= 6)) & 63];
  }
  if (n) out += B64[(bits << (6 - n)) & 63];
  return out;
}

/** packCountries read back: the codes, or null when it isn't one (wrong length, a stray character or bit). */
export function unpackCountries(s: unknown): string[] | null {
  if (typeof s !== "string" || s.length !== Math.ceil((BYTES * 8) / 6)) return null;
  let bits = 0, n = 0;
  const bytes: number[] = [];
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    bits = ((bits << 6) | v) & 0xffff;
    n += 6;
    if (n >= 8) bytes.push((bits >> (n -= 8)) & 255);
  }
  const out: string[] = [];
  for (let i = 0; i < BYTES * 8; i++) {
    if (!(bytes[i >> 3] & (1 << (i & 7)))) continue;
    if (i >= COUNTRY_CODES.length) return null;
    out.push(COUNTRY_CODES[i]);
  }
  // One spelling only: the packing of what it reads.
  return packCountries(out) === s ? out : null;
}

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  const codes = unpackCountries(p.x);
  if (!codes || !codes.length) return null;
  if (p.n !== undefined && !label(p.n, COUNTRIES_NAME_MAX)) return null;
  if (p.y !== undefined && !int(p.y, FIRST_YEAR, LAST_YEAR)) return null;
  return { x: p.x as string, ...(p.n !== undefined ? { n: p.n as string } : {}), ...(p.y !== undefined ? { y: p.y as number } : {}) };
}

export const detail = (p: Params) => `${unpackCountries(p.x)!.length} countries`;

export const PRODUCT: ProductMeta<Params> = {
  line: "Every country you've been to, hatched on a map of the world.",
  from: "The countries you've been to",
  group: "travels",
  base: "contours",
  bases: ["contours", "celestial"],
  wordsHint: "Noa",
  hints: { dense: "Try fewer countries.", faint: "Try another country or two." },
  // Sixteen: Israel, the United Kingdom, France, Italy, Spain, the United States, Japan, Greece, the Netherlands, Germany, Portugal, Thailand, Cyprus, Turkey, Czechia, Austria.
  example: { x: "AIAAAAAA4ABBBAQAMAIAAAAAAAIAAgAAACAQCAAA", n: "Noa", y: 1990 },
};
