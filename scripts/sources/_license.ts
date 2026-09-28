/**
 * Licences, per source: what a record says, normalized, and whether it may
 * go on a tee. Allowed: public domain, CC0, the Public Domain Mark, works of
 * the US government (NASA, NOAA, USGS; unless the record names a third
 * party), and the Library of Congress's "no known restrictions on
 * publication". Everything else is refused, with the reason. CC BY only when
 * the owner allows it for a wave (with a credit on the site).
 */
import type { SourceId } from "./ranges";

export type License = "CC0" | "PDM" | "PD" | "US-Gov" | "NKR" | "CC-BY";
/** How the licence reads on the product page. */
export const LICENSE_LABEL: Record<License, string> = {
  CC0: "CC0",
  PDM: "Public Domain Mark",
  PD: "Public domain",
  "US-Gov": "Public domain (US government work)",
  NKR: "No known restrictions on publication",
  "CC-BY": "CC BY",
};

export interface LicenseFields {
  /** A licence name or URL ("CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/", "pdm"). */
  license?: string | null;
  /** A rights statement ("No known restrictions on publication", "Public domain"). */
  rights?: string | null;
  /** The museum's own public-domain flag (Met isPublicDomain, AIC is_public_domain, Cleveland CC0 status). */
  publicDomain?: boolean | null;
  /** Credit or description text, read for third-party rights ("courtesy of", "©"). */
  credit?: string | null;
}

export type LicenseDecision = { ok: true; license: License } | { ok: false; reason: string };

/** Sites that only find pictures: the licence is always checked on the source's own record. */
export const AGGREGATORS = new Set(["openverse", "flickr"]);
/** Sources whose own works are US government works. */
const US_GOV = new Set<string>(["nasa", "noaa", "usgs"]);
/** Museums that release their public-domain works as CC0 when the record says public domain. */
const CC0_WHEN_PD = new Set<string>(["met", "artic", "cleveland", "smithsonian", "rijksmuseum"]);

const DENY: [RegExp, string][] = [
  [/\b(?:by-)?nc\b|non-?commercial/i, "non-commercial"],
  [/\bnd\b|no-?deriv/i, "no derivatives"],
  [/all rights reserved/i, "all rights reserved"],
  [/not (?:been )?evaluated|undetermined|unknown/i, "rights not evaluated"],
  [/in copyright|copyrighted|©/i, "in copyright"],
];
const THIRD_PARTY = /©|copyright|courtesy of|used with permission|permission required|licensed from|getty|reuters|associated press|\bAP\b/i;

export function judgeLicense(source: SourceId | string, f: LicenseFields, { allowBy = false } = {}): LicenseDecision {
  if (AGGREGATORS.has(source)) return { ok: false, reason: "aggregator: verify on the source record" };
  const text = [f.license, f.rights].filter(Boolean).join(" | ");
  for (const [re, reason] of DENY) if (re.test(text)) return { ok: false, reason };
  if (/publicdomain\/zero|\bcc-?0\b|\bcc ?zero\b|creative commons zero/i.test(text)) return { ok: true, license: "CC0" };
  if (/publicdomain\/mark|public domain mark|\bpdm\b|\bpd-?m\b/i.test(text)) return { ok: true, license: "PDM" };
  if (/no known restrictions/i.test(text)) return source === "loc" ? { ok: true, license: "NKR" } : { ok: false, reason: "no known restrictions (only the Library of Congress's)" };
  if (/creativecommons\.org\/licenses\/by\/|\bcc[- ]by\b(?![- ]?(?:nc|nd|sa))/i.test(text))
    return allowBy ? { ok: true, license: "CC-BY" } : { ok: false, reason: "CC BY (needs the owner's approval)" };
  if (/\bcc[- ]by[- ]sa\b|licenses\/by-sa/i.test(text)) return { ok: false, reason: "share-alike" };
  const pd = f.publicDomain === true || /public domain|^pd\b|\bpd-(?:old|us|art|1923|author|usgov|textlogo)/i.test(text);
  if (US_GOV.has(source) && (pd || /government work|us gov|no copyright/i.test(text) || !text)) {
    if (THIRD_PARTY.test(f.credit ?? "") || THIRD_PARTY.test(text)) return { ok: false, reason: "third-party rights named in the record" };
    return { ok: true, license: "US-Gov" };
  }
  if (/pd-usgov|us government work/i.test(text)) return THIRD_PARTY.test(f.credit ?? "") ? { ok: false, reason: "third-party rights named in the record" } : { ok: true, license: "US-Gov" };
  if (pd) return { ok: true, license: CC0_WHEN_PD.has(source) && f.publicDomain === true ? "CC0" : "PD" };
  if (f.publicDomain === false) return { ok: false, reason: "not public domain" };
  return { ok: false, reason: text ? `unclear licence: ${text.slice(0, 60)}` : "no licence stated" };
}
