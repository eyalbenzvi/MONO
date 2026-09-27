/**
 * The owner's decisions.json (from the review pages) → the curation files.
 * A decision is "keep" | "reject" | "maybe", or {decision, title_override?, reason?}.
 *
 *   tsx scripts/review/applyDecisions.ts catalogue <decisions.json…>
 *     rejects → data/curation/retired.json ("review-2: <reason | owner review>"); title overrides → titles.json
 *   tsx scripts/review/applyDecisions.ts source <source> <wave> <decisions.json…>
 *     keeps → numbered and committed (data/sources/<source>.json, prints, masters, halftone.json);
 *     rejects → dropped from the cache; maybes stay in the cache for a later look
 *
 * Prints counts only.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { commit, forget } from "../sources/_pipeline";
import type { SourceId } from "../sources/ranges";

const ROOT = path.resolve(__dirname, "..", "..");
type Decision = "keep" | "reject" | "maybe";
export type Decisions = Record<string, Decision | { decision: Decision; title_override?: string; reason?: string }>;

/** Several decision files, one map: a later file wins for the same id. */
export function readDecisions(files: string[]): Map<string, { decision: Decision; title?: string; reason?: string }> {
  const out = new Map<string, { decision: Decision; title?: string; reason?: string }>();
  for (const f of files)
    for (const [id, d] of Object.entries(JSON.parse(readFileSync(f, "utf8")) as Decisions)) {
      const v = typeof d === "string" ? { decision: d } : { decision: d.decision, title: d.title_override?.trim() || undefined, reason: d.reason?.trim() || undefined };
      if (!["keep", "reject", "maybe"].includes(v.decision)) throw new Error(`${f}: ${id}: unknown decision ${JSON.stringify(d)}`);
      out.set(id, v);
    }
  return out;
}

/** Wave 0: rejects retire live designs (the reason as the owner wrote it), overrides rename them. */
export function applyCatalogue(decisions: ReturnType<typeof readDecisions>, root = ROOT) {
  const retiredFile = path.join(root, "data", "curation", "retired.json");
  const titlesFile = path.join(root, "data", "curation", "titles.json");
  const retired = JSON.parse(readFileSync(retiredFile, "utf8")) as Record<string, string>;
  const titles = existsSync(titlesFile) ? (JSON.parse(readFileSync(titlesFile, "utf8")) as Record<string, string>) : {};
  let rejected = 0, renamed = 0;
  for (const [id, d] of decisions) {
    if (!/^mono-\d{4,}$/.test(id)) throw new Error(`not a design id: ${id}`);
    if (d.decision === "reject") (retired[id] = `review-2: ${d.reason ?? "owner review"}`), rejected++;
    else if (d.title) (titles[id] = d.title), renamed++;
  }
  // Existing entries keep their place; new ones go at the end (small diffs).
  writeFileSync(retiredFile, JSON.stringify(retired, null, 1) + "\n");
  writeFileSync(titlesFile, JSON.stringify(titles, null, 1) + "\n");
  return { rejected, renamed, kept: decisions.size - rejected };
}

if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "catalogue") console.log(applyCatalogue(readDecisions(args)));
  else if (cmd === "source") {
    const [source, wave, ...files] = args;
    const d = readDecisions(files);
    const keep = new Map([...d].filter(([, v]) => v.decision === "keep").map(([k, v]) => [k, { name: v.title }]));
    const rejects = [...d].filter(([, v]) => v.decision === "reject").map(([k]) => k);
    forget(source as SourceId, rejects);
    console.log({ ...commit(source as SourceId, Number(wave), keep), rejected: rejects.length, maybe: [...d.values()].filter((v) => v.decision === "maybe").length });
  } else {
    console.error("usage: applyDecisions.ts catalogue <files…> | source <source> <wave> <files…>");
    process.exit(1);
  }
}
