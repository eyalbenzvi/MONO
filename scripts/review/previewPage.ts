/**
 * The owner's before/after page for a wave (docs/content/waves.md §3.2):
 * what comes in and what goes out, as tees, and the catalogue's numbers
 * before and after (data/shirts.json against the deployed branch's).
 *
 *   tsx scripts/review/previewPage.ts <wave> [base-ref]
 *
 * base-ref defaults to origin/claude/tshirt-discovery-mvp-pc6mk9. Writes
 * node_modules/.cache/mono-review/wave-<n>/preview.html (a hub-less page: publish it directly) and
 * data/review/wave-<n>/summary.md (numbers only, committed).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { OUT, catalogueItem, type ReviewItem } from "./reviewPage";

const ROOT = path.resolve(__dirname, "..", "..");
type Entry = Parameters<typeof catalogueItem>[0] & { wave?: number };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const median = (v: number[]) => (v.length ? [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] : 0);
const du = (p: string) => Number(execFileSync("du", ["-sk", p], { cwd: ROOT, encoding: "utf8" }).split(/\s/)[0]) / 1024;
/** The shop window's size (lib/recommendation SHOP_WINDOW) and the taste test's cards (the index's calibration). */
const WINDOW = 24;

export async function preview(wave: number, base = "origin/claude/tshirt-discovery-mvp-pc6mk9") {
  const before = JSON.parse(execFileSync("git", ["show", `${base}:data/shirts.json`], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 30 })) as Entry[];
  const after = JSON.parse(readFileSync(path.join(ROOT, "data", "shirts.json"), "utf8")) as Entry[];
  const calibration = new Set<string>((JSON.parse(readFileSync(path.join(ROOT, "data", "shirts.index.json"), "utf8")) as { calibration: string[] }).calibration);
  const had = new Set(before.map((s) => s.id));
  const has = new Set(after.map((s) => s.id));
  const incoming = after.filter((s) => !had.has(s.id));
  const leaving = before.filter((s) => !has.has(s.id));
  const cats = [...new Set([...before, ...after].map((s) => s.category))];
  const perCat = (list: Entry[]) => Object.fromEntries(cats.map((c) => [c, list.filter((s) => s.category === c).length]));
  const latest = (list: Entry[]) => list.reduce((m, s) => (s.dropDate > m ? s.dropDate : m), "");
  const thisWeek = (list: Entry[]) => list.filter((s) => s.dropDate === latest(list)).length;
  const waveList = after.filter((s) => s.wave === wave);
  const numbers = {
    designs: [before.length, after.length],
    perCategory: [perCat(before), perCat(after)],
    medianQuality: { wave: median(waveList.map((s) => s.quality)), catalogue: [median(before.map((s) => s.quality)), median(after.map((s) => s.quality))] },
    waveInWindow: waveList.filter((s) => s.rank < WINDOW).length,
    waveInTasteTest: waveList.filter((s) => calibration.has(s.id)).length,
    thisWeek: [thisWeek(before), thisWeek(after)],
    printsMB: Math.round(du("public/prints")),
    // The repository's own git directory (in a worktree, .git is only a pointer file).
    gitMB: Math.round(du(execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: ROOT, encoding: "utf8" }).trim())),
    incoming: incoming.length,
    leaving: leaving.length,
  };
  const fam = new Map<string, number>();
  for (const s of after) fam.set(s.family, (fam.get(s.family) ?? 0) + 1);
  const items = async (list: Entry[]) => {
    const out: ReviewItem[] = [];
    for (const s of list) out.push(await catalogueItem(s, fam.get(s.family) ?? 1).catch(() => null as unknown as ReviewItem));
    return out.filter(Boolean);
  };
  const [inItems, outItems] = [await items(incoming), await items(leaving.filter((s) => s.medium === "drawn"))];
  const rows = cats.map((c) => `<tr><td>${esc(c)}</td><td>${numbers.perCategory[0][c]}</td><td>${numbers.perCategory[1][c]}</td><td>${numbers.perCategory[1][c] - numbers.perCategory[0][c] || ""}</td></tr>`).join("");
  const tees = (list: ReviewItem[]) => list.map((i) => `<figure><div class="tee" data-tee="${i.tee}"><img alt="" loading="lazy" src="${i.print}"></div><figcaption>${esc(i.title)}<span>${esc(i.id)} · Q ${i.numbers[0][1]}</span></figcaption></figure>`).join("");
  const html = `<title>MONO wave ${wave} preview</title>
<style>
:root{color-scheme:dark;--ground:#050505;--surface:#111;--line:#2a2a2a;--text:#f5f5f5;--muted:#9b9b9b;--tee-black:#0d0d0d;--tee-white:#f2f2f0}
body{background:var(--ground);color:var(--text);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding-inline:16px;padding-block:24px 48px}
h1{font-size:20px;font-weight:800;margin:0 0 4px}h2{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:32px 0 12px}
.mono,td{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-variant-numeric:tabular-nums}
.facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1px;background:var(--line);border:1px solid var(--line)}
.facts div{background:var(--ground);padding:10px}.facts b{display:block;font-size:18px}.facts span{color:var(--muted);font-size:12px}
.wrap{overflow-x:auto}table{border-collapse:collapse;min-width:320px}td,th{padding:4px 14px 4px 0;text-align:right;border-bottom:1px solid var(--line)}td:first-child,th:first-child{text-align:left}th{color:var(--muted);font-weight:600;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
figure{margin:0}figcaption{font-size:12px;margin-top:4px}figcaption span{display:block;color:var(--muted);font-family:ui-monospace,Menlo,monospace;font-size:11px}
.tee{position:relative;aspect-ratio:1/1.08;max-width:100%;clip-path:polygon(30% 0,40% 5%,60% 5%,70% 0,100% 15%,91% 32%,81% 27%,81% 100%,19% 100%,19% 27%,9% 32%,0 15%)}
.tee[data-tee=black]{background:var(--tee-black)}.tee[data-tee=white]{background:var(--tee-white)}
.tee img{position:absolute;left:31%;top:17%;width:38%;aspect-ratio:28/37;object-fit:contain}
p{color:var(--muted);max-width:65ch}
</style>
<h1>Wave ${wave}: before and after</h1>
<p>Against ${esc(base)}. ${numbers.incoming} designs come in, ${numbers.leaving} go out.</p>
<div class="facts mono">
<div><b>${numbers.designs[0]} → ${numbers.designs[1]}</b><span>designs</span></div>
<div><b>${numbers.medianQuality.wave || "–"}</b><span>median quality, this wave</span></div>
<div><b>${numbers.medianQuality.catalogue[0]} → ${numbers.medianQuality.catalogue[1]}</b><span>median quality, catalogue</span></div>
<div><b>${numbers.waveInWindow}</b><span>of the wave in Our pick's first ${WINDOW}</span></div>
<div><b>${numbers.waveInTasteTest}</b><span>of the wave in the taste test</span></div>
<div><b>${numbers.thisWeek[0]} → ${numbers.thisWeek[1]}</b><span>dated this week</span></div>
<div><b>${numbers.printsMB} MB</b><span>public/prints</span></div>
<div><b>${numbers.gitMB} MB</b><span>.git</span></div>
</div>
<h2>Per category</h2>
<div class="wrap"><table><tr><th>Category</th><th>Before</th><th>After</th><th>Change</th></tr>${rows}</table></div>
<h2>Coming in · ${inItems.length}</h2>
<div class="grid">${tees(inItems) || "<p>None.</p>"}</div>
<h2>Going out · ${numbers.leaving}</h2>
<p>${leaving.length ? "Drawn prints shown (their files stay in git); pictures listed by title." : "None."}</p>
<div class="grid">${tees(outItems)}</div>
${leaving.filter((s) => s.medium !== "drawn").length ? `<p class="mono">${leaving.filter((s) => s.medium !== "drawn").map((s) => esc(`${s.id} ${s.title}`)).join(" · ")}</p>` : ""}
`;
  const dir = path.join(OUT, `wave-${wave}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "preview.html"), html);
  const sum = path.join(ROOT, "data", "review", `wave-${wave}`);
  mkdirSync(sum, { recursive: true });
  writeFileSync(path.join(sum, "summary.md"), `# Wave ${wave}: before and after\n\nAgainst \`${base}\`.\n\n\`\`\`json\n${JSON.stringify(numbers, null, 1)}\n\`\`\`\n`);
  return numbers;
}

if (require.main === module) {
  const [wave, base] = process.argv.slice(2);
  preview(Number(wave), base).then((n) => console.log(`in ${n.incoming} · out ${n.leaving} · designs ${n.designs.join(" → ")} · page: node_modules/.cache/mono-review/wave-${wave}/preview.html`), (e) => (console.error(e), process.exit(1)));
}
