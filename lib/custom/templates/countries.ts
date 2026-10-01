/**
 * Your Countries: an Equal Earth world map (data/countries: Natural Earth's
 * outlines, projected and simplified at build time). Every country's outline
 * thin, the world's own edge round them, the chosen ones hatched with
 * diagonal lines (computed inside each outline, never clipped), the tiny
 * ones as rings, and under it the count out of 195, the name and the year.
 * The hatch opens up as more of the world is chosen, so a well-travelled map
 * stays light.
 */
import { INK, STROKE, caption, captionLines, circle, clip, f1, fitSize, text, textWidth, type Lines, house } from "../kit";
import { EE_X, equalEarth } from "../equalEarth";
import { OF, counted, unpackCountries, type Params } from "../specs/countries";
import { loadCountries, type Countries, type Country } from "../data";
import type { CustomSpec } from "../spec";
import type { RenderData } from "../renderers";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const COND = "condensed" as const;
/** The map: its width on the print, and where its middle sits. */
const W = 256, CX = 150, CY = 112;
const S = W / (2 * EE_X);

const px = (x: number) => CX + (x / 1000) * S;
const py = (y: number) => CY + (y / 1000) * S;

/** The caption's lines (ours). */
export function countriesCaption(p: Params, countries?: Countries): Lines {
  const codes = unpackCountries(p.x) ?? [];
  // The countries (the 195) first, then any territories: the line never counts a territory as a country.
  const [states, others] = [codes.filter((c) => counted([c])), codes.filter((c) => !counted([c]))];
  const names = countries ? states.map((c) => countries.byA3(c)?.name).filter(Boolean) : [];
  const plus = others.length ? ` + ${others.length} ${others.length === 1 ? "territory" : "territories"}` : "";
  const first = names.length ? `${names[0]}${names.length > 1 ? ` and ${names.length - 1} more` : ""}${plus}` : "";
  const count = states.length ? `${states.length} ${states.length === 1 ? "country" : "countries"}${plus}` : `${others.length} ${others.length === 1 ? "territory" : "territories"}`;
  return [p.n ? `${p.n}’s countries` : "Countries visited", first && first.length <= 36 ? first : count, p.y ? `Since ${p.y} · Equal Earth projection` : "Equal Earth projection"];
}

/** The world's edge: the meridians at ±180° from pole to pole. */
function worldEdge(): string {
  const pts: string[] = [];
  for (let lat = -90; lat <= 90; lat += 5) pts.push(`${f1(CX + equalEarth(180, lat)[0] * S)} ${f1(CY - equalEarth(180, lat)[1] * S)}`);
  for (let lat = 90; lat >= -90; lat -= 5) pts.push(`${f1(CX + equalEarth(-180, lat)[0] * S)} ${f1(CY - equalEarth(-180, lat)[1] * S)}`);
  return `<path d="M${pts.join("L")}Z" fill="none" stroke="${INK}" stroke-width="${STROKE.fine}"/>`;
}

/** A ring's points on the print. */
const ringPts = (ring: number[]) => {
  const out: [number, number][] = [];
  for (let i = 0; i < ring.length; i += 2) out.push([px(ring[i]), py(ring[i + 1])]);
  return out;
};

/**
 * Diagonal hatching inside one ring: lines x + y = k every `gap` (measured
 * across), each cut where it crosses the ring's edges and drawn between
 * alternate crossings (even–odd), so the lines stay inside without a clip.
 */
function hatchRing(pts: [number, number][], gap: number): string {
  const r2 = Math.SQRT2;
  const k = pts.map(([x, y]) => (x + y) / r2);
  const lo = Math.ceil(Math.min(...k) / gap) * gap, hi = Math.max(...k);
  let d = "";
  for (let c = lo; c <= hi; c += gap) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
      const [ka, kb] = [k[i], k[(i + 1) % pts.length]];
      if ((ka <= c && kb > c) || (kb <= c && ka > c)) {
        const t = (c - ka) / (kb - ka);
        // Along the line, measured by v = (x − y) / √2.
        xs.push(((a[0] + t * (b[0] - a[0])) - (a[1] + t * (b[1] - a[1]))) / r2);
      }
    }
    xs.sort((m, n) => m - n);
    for (let j = 0; j + 1 < xs.length; j += 2) {
      const [v0, v1] = [xs[j], xs[j + 1]];
      if (v1 - v0 < 0.3) continue;
      // Back from (u = c, v) to x, y.
      d += `M${f1((c + v0) / r2)} ${f1((c - v0) / r2)}L${f1((c + v1) / r2)} ${f1((c - v1) / r2)}`;
    }
  }
  return d;
}

export function countriesBody(p: Params, countries?: Countries): string {
  const chosen = new Set(unpackCountries(p.x) ?? []);
  let s = worldEdge();
  let outline = "", visited = "", hatch = "";
  let area = 0;
  const list: Country[] = countries?.list ?? [];
  for (const c of list) if (chosen.has(c.a3)) area += c.area;
  // The more of the world chosen, the wider the hatch (area in square thousandths; the land is about 4.6 million of them).
  const share = Math.min(1, area / 4.6e6);
  const gap = 1.7 + 2.3 * Math.sqrt(share);
  for (const c of list) {
    for (const ring of c.rings) {
      const pts = ringPts(ring);
      if (pts.length < 3) continue;
      const d = `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join("L")}Z`;
      if (chosen.has(c.a3)) (visited += d), (hatch += hatchRing(pts, gap));
      else outline += d;
    }
  }
  // The world's countries in the finest line; the chosen ones outlined a step up and hatched.
  if (outline) s += `<path d="${outline}" fill="none" stroke="${INK}" stroke-width=".4" stroke-linejoin="round"/>`;
  if (hatch) s += `<path d="${hatch}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}"/>`;
  if (visited) s += `<path d="${visited}" fill="none" stroke="${INK}" stroke-width="${STROKE.fine}" stroke-linejoin="round"/>`;
  // The tiny countries (a point each): a ring for each chosen.
  for (const c of list) if (!c.rings.length && chosen.has(c.a3)) s += circle(px(c.point[0]), py(c.point[1]), 1.6, STROKE.fine);
  // The count, the name, the year.
  const count = `${counted([...chosen])} / ${OF}`;
  s += text(150, 240, count, 44, { family: COND, bold: true, spacing: 1.3 });
  // The name and the year: sized to the measure (tracked 0.12 em), then cut.
  const line = [p.n?.toUpperCase(), p.y ? `SINCE ${p.y}` : ""].filter(Boolean).join(" · ");
  if (line) {
    const ls = fitSize(line, 230, 13, { family: COND, track: 0.12, floor: 6 });
    s += text(150, 262, clip(line, 230, ls, { family: COND, spacing: ls * 0.12 }), ls, { family: COND, spacing: Math.round(ls * 1.2) / 10 });
  }
  // The names, small, as a list under it (as many as fit four rows).
  if (countries) {
    // The countries, then the territories (each alphabetical): the list reads as the count does.
    const nameOf = (a3: string) => countries.byA3(a3)?.name;
    const byName = (codes: string[]) => codes.map(nameOf).filter((n): n is string => !!n).sort();
    const names = [...byName([...chosen].filter((c) => counted([c]))), ...byName([...chosen].filter((c) => !counted([c])))];
    const fits = (r: string) => textWidth(r.toUpperCase(), 6.5, { family: COND }) + r.length * 0.6 <= 256;
    const rows: string[][] = [[]];
    for (const n of names) {
      const row = rows[rows.length - 1];
      if (!row.length || fits([...row, n].join(" · "))) row.push(n);
      else rows.push([n]);
    }
    // Four rows at most: the fourth gives up names until "and so many more" fits after it.
    if (rows.length > 4) {
      const kept = rows.slice(0, 4);
      let shown = kept.reduce((a, r) => a + r.length, 0);
      while (!fits(`${kept[3].join(" · ")} · AND ${names.length - shown} MORE`)) {
        kept[3].pop();
        shown--;
      }
      kept[3].push(`AND ${names.length - shown} MORE`);
      rows.splice(0, rows.length, ...kept);
    }
    rows.forEach((r, i) => (s += text(150, 280 + i * 9, r.join(" · ").toUpperCase(), 6.5, { family: COND, spacing: 0.6 })));
  }
  return s + caption(348, ...captionLines(countriesCaption(p, countries), p.cap));
}


export const captionOf = (spec: CustomSpec, data: RenderData = {}) => countriesCaption((spec as { p: Params }).p, data.countries);

export const render = (spec: CustomSpec, color: BaseColor, data: RenderData = {}) => house(() => wrap(countriesBody((spec as { p: Params }).p, data.countries), color));

/** The countries, for the index cards and the bag (the editor passes its own). */
export async function prepare(): Promise<RenderData> {
  return { countries: await loadCountries() };
}
