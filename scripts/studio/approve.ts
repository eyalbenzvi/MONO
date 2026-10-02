/**
 * A gated studio run's decision from its five designer reviews (scripts/studio/briefs/review-designers.md):
 * data/studio/<run>/review/designer-1.json … designer-5.json (each a score 1–10 and PASS / NEEDS CHANGE /
 * DELETE per design, numbered as review/designs.json numbers them) → review/approved.json, which
 * scripts/studio/publish.ts reads. No human signs off.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/studio/approve.ts <run> [--max N]
 *
 * Approved: an average score of APPROVE_AVERAGE or more, fewer than three DELETE votes, and among the PER_FAMILY
 * best of its family (the details' Family line) in the run. --max N keeps the N best of those (the run's target).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { APPROVE_AVERAGE, PER_FAMILY, type Approval } from "./publish";

const ROOT = path.resolve(__dirname, "..", "..");

export type Verdict = "PASS" | "NEEDS CHANGE" | "DELETE";
export interface Review {
  designer: string;
  designs: { no: number; score: number; verdict: Verdict; why?: string }[];
}
/** review/designs.json: the review's numbering of the run's folders. */
export interface Listed {
  no: number;
  folder: string;
  title: string;
  family: string;
}

/** The decision for each listed design. */
export function decide(listed: Listed[], reviews: Review[], max = Infinity): Approval["designs"] {
  if (reviews.length < 5) throw new Error(`${reviews.length} reviews: five designers review a run`);
  const out: Approval["designs"] = {};
  const scored = listed.map((d) => {
    const votes = reviews.map((r) => {
      const v = r.designs.find((x) => x.no === d.no);
      if (!v) throw new Error(`${r.designer} has no verdict for #${d.no} ${d.title}`);
      return v;
    });
    const average = Math.round((votes.reduce((sum, v) => sum + v.score, 0) / votes.length) * 100) / 100;
    const deleteVotes = votes.filter((v) => v.verdict === "DELETE").length;
    return { d, average, deleteVotes };
  });
  // Passing on its own: the average and fewer than three DELETE votes.
  for (const { d, average, deleteVotes } of scored) {
    const ok = average >= APPROVE_AVERAGE && deleteVotes < 3;
    out[d.folder] = {
      average,
      deleteVotes,
      family: d.family,
      approved: ok,
      why: ok ? "approved" : deleteVotes >= 3 ? `${deleteVotes} designers said delete` : `average ${average} (${APPROVE_AVERAGE} to pass)`,
    };
  }
  // The family cap: the best PER_FAMILY of each family stay (ties go to fewer DELETE votes, then the earlier number).
  const families = new Map<string, typeof scored>();
  for (const s of scored) if (out[s.d.folder].approved) families.set(s.d.family, [...(families.get(s.d.family) ?? []), s]);
  for (const [family, list] of families) {
    list.sort((a, b) => b.average - a.average || a.deleteVotes - b.deleteVotes || a.d.no - b.d.no);
    for (const s of list.slice(PER_FAMILY)) {
      out[s.d.folder] = { ...out[s.d.folder], approved: false, why: `a third ${family} design (${PER_FAMILY} per family a run)` };
    }
  }
  // The run's target: the best `max` of the approved (average, then fewer DELETE votes, then the earlier number).
  const approved = scored.filter((s) => out[s.d.folder].approved).sort((a, b) => b.average - a.average || a.deleteVotes - b.deleteVotes || a.d.no - b.d.no);
  for (const s of approved.slice(max)) out[s.d.folder] = { ...out[s.d.folder], approved: false, why: `past the run's ${max} best` };
  return out;
}

function main() {
  const run = process.argv[2];
  if (!run) throw new Error("usage: approve.ts <run>");
  const dir = path.join(ROOT, "data", "studio", run, "review");
  const listed = JSON.parse(readFileSync(path.join(dir, "designs.json"), "utf8")) as Listed[];
  const files = readdirSync(dir).filter((f) => /^designer-\d+\.json$/.test(f)).sort();
  const reviews = files.map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as Review);
  const max = process.argv.includes("--max") ? Number(process.argv[process.argv.indexOf("--max") + 1]) : Infinity;
  const designs = decide(listed, reviews, max);
  const file = path.join(dir, "approved.json");
  // The first decision's date stays: it fixes the run's place in the shop's numbering.
  const approvedAt = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Approval).approvedAt : new Date().toISOString();
  const approval: Approval = { run, approvedAt, designs };
  writeFileSync(file, `${JSON.stringify(approval, null, 1)}\n`);
  const ok = Object.values(designs).filter((d) => d.approved).length;
  console.log(`${run}: ${ok} of ${listed.length} approved → ${path.relative(ROOT, file)}`);
  for (const [folder, d] of Object.entries(designs)) console.log(`  ${d.approved ? "✓" : "✗"} ${folder} ${d.average} (${d.why})`);
}

if (require.main === module) main();
