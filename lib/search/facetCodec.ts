/**
 * Facets as values and in the address (f=kind:value,…) — the small part the
 * shop needs before search itself has loaded.
 */

export const FACET_KINDS = ["category", "medium", "style", "variant", "source", "era", "artist", "look", "tee", "new", "seen", "match", "like"] as const;
export type FacetKind = (typeof FACET_KINDS)[number];
export interface Facet {
  kind: FacetKind;
  value: string;
}

export const sameFacet = (a: Facet, b: Facet) => a.kind === b.kind && a.value === b.value;

/* URL: f=kind:value,kind:value (values URL-encoded) --------------------- */

export function encodeFacets(facets: readonly Facet[]): string {
  return facets.filter((f) => f.kind !== "like").map((f) => `${f.kind}:${encodeURIComponent(f.value)}`).join(",");
}

export function decodeFacets(s: string | null): Facet[] {
  if (!s) return [];
  const out: Facet[] = [];
  for (const part of s.split(",")) {
    const i = part.indexOf(":");
    if (i <= 0) continue;
    const kind = part.slice(0, i) as FacetKind;
    if (!(FACET_KINDS as readonly string[]).includes(kind) || kind === "like") continue;
    let value: string;
    try {
      value = decodeURIComponent(part.slice(i + 1));
    } catch {
      continue;
    }
    if (value && !out.some((f) => f.kind === kind && f.value === value)) out.push({ kind, value });
  }
  return out;
}

