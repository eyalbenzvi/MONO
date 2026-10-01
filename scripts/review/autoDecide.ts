/**
 * Automatic decisions for a wave's candidates, used when the owner has delegated the selection
 * ("do what you think; don't ask"): no picture is looked at. An item is kept only when every
 * number is clean: not weak (quality at least AUTO_QUALITY, no sliver, vignette or flat flag), no
 * duplicate scan, no repeated title (within the wave, or one the catalogue already has:
 * the generator refuses two designs with one title), and no shop category past CATEGORY_SHARE of the
 * catalogue (the brand book: none swamps the shop; the best by quality stay). Titles are tidied from the
 * record (file-name debris out; nothing invented). Writes data/review/wave-<n>/decisions-<source>.json
 * (the same format as the review page's export) and prints counts.
 *
 *   tsx scripts/review/autoDecide.ts <wave> <source…>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { houseTitle } from "../gen/titles";
import { ROOT, readPrepped, waveDir } from "../sources/_pipeline";
import { filing, shortName } from "../sources/waves";
import type { Prepped } from "../sources/_types";
import type { SourceId } from "../sources/ranges";

/** Stricter than the catalogue's weak line (53): with no eye on it, only a clearly good print goes in. */
export const AUTO_QUALITY = 60;

/** A record title as a design name: file-name debris out (underscores, extensions, Flickr/BHL ids in brackets). */
export function tidyTitle(t: string): string {
  return t
    .replace(/^File:/i, "")
    // A HABS/HAER sheet's call number and sheet count ("HABS NC,28-BUXT,1- (sheet 1 of 13) - Cape Hatteras Lighthouse, …").
    .replace(/^(?:HABS|HAER|HALS)\s+[^()]*\(sheet \d+ of \d+\)\s*-\s*/i, "")
    // A book's figure label before the caption ("T4- d476 - Fig. 296 — Le phare de Cordouan").
    .replace(/^.{0,20}?\bfig\.?\s*\d+\s*[—–-]\s*/i, "")
    // A museum's inventory line ("Ritning-Akterspegel, Sjöhistoriska museet, OR 1033-14"): the drawing's own words.
    .replace(/\s*[-,]\s*Sjöhistoriska museet\b.*$/i, "")
    .replace(/^(?:Ritning|Teckning)\s*[-–]\s*(?=\S)/i, "")
    .replace(/\.(jpe?g|png|tiff?|gif)$/i, "")
    .replace(/_/g, " ")
    // Commons' clip-art set marker ("Square-rigged (PSF)": Pearson Scott Foresman).
    .replace(/\s*\(PSF\)/g, "")
    .replace(/\s*\((?:\d{5,}|[a-z]{2,}\d{3,}\w*)\)/gi, "")
    .replace(/\s*\[[^\]]*\]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "")
    .slice(0, 90);
}

/** A category's most of the catalogue after a wave (the catalogue test's line is 30%; a margin for what the generator retires). */
export const CATEGORY_SHARE = 0.29;

/** A title as the catalogue will print it (cut to 60, the house style), lowercased: two that match are one title. */
const titleKey = (t: string) => houseTitle(shortName(t)).toLowerCase();

export function decide(wave: number, sources: SourceId[]) {
  // The catalogue's titles and categories, except this wave's own (a re-run).
  const shirtsFile = path.join(ROOT, "data", "shirts.json");
  const catalogue = (existsSync(shirtsFile) ? (JSON.parse(readFileSync(shirtsFile, "utf8")) as { title: string; category: string; wave?: number }[]) : []).filter((s) => s.wave !== wave);
  const titles = new Set<string>(catalogue.map((s) => s.title.toLowerCase()));
  const decisions = new Map<SourceId, { list: Prepped[]; d: Record<string, unknown> }>();
  const keeps: { p: Prepped; src: SourceId; category: string }[] = [];
  for (const src of sources) {
    const list = readPrepped(src, wave).sort((a, b) => b.assess.quality - a.assess.quality || b.score - a.score);
    const d: Record<string, unknown> = {};
    for (const p of list) {
      const title = tidyTitle(p.title);
      // No name at all: a bare "drawing" word, or a file name (author-year-book-page).
      const nameless = /^(?:teckning|ritning|drawing|plate|untitled)$/i.test(title) || /^[\p{L}]+-\d{4}-.+-\d+$/u.test(title);
      const clean = !nameless && !p.weak && !p.flags.includes("dup") && p.assess.flags.length === 0 && p.assess.quality >= AUTO_QUALITY && title.length >= 3;
      const repeat = titles.has(titleKey(title));
      if (clean && !repeat) titles.add(titleKey(title));
      const keep = clean && !repeat;
      if (keep) keeps.push({ p, src, category: filing({ ...p, wave }).category });
      d[p.key] = title !== p.title && keep ? { decision: "keep", title_override: title } : keep ? "keep" : { decision: "reject", reason: nameless ? "no name" : repeat ? "repeated title" : p.flags.includes("dup") ? "duplicate" : `quality ${p.assess.quality}${p.assess.flags.length ? ` ${p.assess.flags.join(" ")}` : ""}` };
    }
    decisions.set(src, { list, d });
  }
  // The category ceiling: while a category would pass its share of the catalogue after the wave, its
  // weakest keep goes (the total shrinks with it, so this runs until nothing moves).
  const had: Record<string, number> = {};
  for (const s of catalogue) had[s.category] = (had[s.category] ?? 0) + 1;
  keeps.sort((a, b) => b.p.assess.quality - a.p.assess.quality || b.p.score - a.p.score);
  const full: Record<string, number> = {};
  for (let moved = true; moved; ) {
    moved = false;
    const total = catalogue.length + keeps.length;
    const per: Record<string, number> = {};
    for (const k of keeps) per[k.category] = (per[k.category] ?? 0) + 1;
    for (const [cat, n] of Object.entries(per)) {
      if ((had[cat] ?? 0) + n <= CATEGORY_SHARE * total) continue;
      const i = keeps.map((k) => k.category).lastIndexOf(cat);
      const [k] = keeps.splice(i, 1);
      decisions.get(k.src)!.d[k.p.key] = { decision: "reject", reason: `category full (${cat})` };
      full[cat] = (full[cat] ?? 0) + 1;
      moved = true;
      break;
    }
  }
  const out: Record<string, Record<string, unknown>> = {};
  for (const [src, { list, d }] of decisions) {
    mkdirSync(waveDir(wave), { recursive: true });
    writeFileSync(path.join(waveDir(wave), `decisions-${src}.json`), JSON.stringify(d, null, 1) + "\n");
    const kept = Object.values(d).filter((v) => v === "keep" || (v as { decision?: string }).decision === "keep").length;
    out[src] = { prepped: list.length, keep: kept, reject: list.length - kept };
  }
  if (Object.keys(full).length) out.categoryFull = full;
  return out;
}

if (require.main === module) {
  const [wave, ...sources] = process.argv.slice(2);
  console.log(decide(Number(wave), sources as SourceId[]));
}
