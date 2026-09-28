/**
 * Automatic decisions for a wave's candidates, used when the owner has delegated the selection
 * ("do what you think; don't ask"): no picture is looked at. An item is kept only when every
 * number is clean: not weak (quality at least AUTO_QUALITY, no sliver, vignette or flat flag), no
 * solid block, no duplicate scan, no repeated title within the wave. Titles are tidied from the
 * record (file-name debris out; nothing invented). Writes data/review/wave-<n>/decisions-<source>.json
 * (the same format as the review page's export) and prints counts.
 *
 *   tsx scripts/review/autoDecide.ts <wave> <source…>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readPrepped, waveDir } from "../sources/_pipeline";
import type { SourceId } from "../sources/ranges";

/** Stricter than the catalogue's weak line (53): with no eye on it, only a clearly good print goes in. */
export const AUTO_QUALITY = 60;

/** A record title as a design name: file-name debris out (underscores, extensions, Flickr/BHL ids in brackets). */
export function tidyTitle(t: string): string {
  return t
    .replace(/^File:/i, "")
    .replace(/\.(jpe?g|png|tiff?|gif)$/i, "")
    .replace(/_/g, " ")
    .replace(/\s*\((?:\d{5,}|[a-z]{2,}\d{3,}\w*)\)/gi, "")
    .replace(/\s*\[[^\]]*\]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "")
    .slice(0, 90);
}

export function decide(wave: number, sources: SourceId[]) {
  const titles = new Set<string>();
  const out: Record<string, Record<string, unknown>> = {};
  for (const src of sources) {
    const list = readPrepped(src, wave).sort((a, b) => b.assess.quality - a.assess.quality || b.score - a.score);
    const d: Record<string, unknown> = {};
    for (const p of list) {
      const title = tidyTitle(p.title);
      const clean = !p.weak && !p.solid && !p.flags.includes("dup") && p.assess.flags.length === 0 && p.assess.quality >= AUTO_QUALITY && title.length >= 3;
      const repeat = titles.has(title.toLowerCase());
      if (clean && !repeat) titles.add(title.toLowerCase());
      const keep = clean && !repeat;
      d[p.key] = title !== p.title && keep ? { decision: "keep", title_override: title } : keep ? "keep" : { decision: "reject", reason: repeat ? "repeated title" : p.solid ? `solid ${p.solid}` : p.flags.includes("dup") ? "duplicate" : `quality ${p.assess.quality}${p.assess.flags.length ? ` ${p.assess.flags.join(" ")}` : ""}` };
    }
    mkdirSync(waveDir(wave), { recursive: true });
    writeFileSync(path.join(waveDir(wave), `decisions-${src}.json`), JSON.stringify(d, null, 1) + "\n");
    const kept = Object.values(d).filter((v) => v === "keep" || (v as { decision?: string }).decision === "keep").length;
    out[src] = { prepped: list.length, keep: kept, reject: list.length - kept };
  }
  return out;
}

if (require.main === module) {
  const [wave, ...sources] = process.argv.slice(2);
  console.log(decide(Number(wave), sources as SourceId[]));
}
