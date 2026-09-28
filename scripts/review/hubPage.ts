/**
 * The page that links a wave's review pages (published as one Artifact with
 * the pages as its files): which page holds what, and how many.
 *
 *   tsx scripts/review/hubPage.ts <dir> <title> [intro]
 *
 * Writes <dir>/index.html (without doctype: the Artifact wraps it) listing every other .html in <dir>.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function writeHub(dir: string, title: string, intro: string) {
  const pages = readdirSync(dir).filter((f) => f.endsWith(".html") && f !== "index.html").sort();
  const rows = pages.map((f) => {
    const html = readFileSync(path.join(dir, f), "utf8");
    const heading = /<h1>(.*?)<\/h1>/.exec(html)?.[1] ?? f;
    const mb = (statSync(path.join(dir, f)).size / 1048576).toFixed(1);
    return `<li><a href="${esc(f)}">${heading}</a><span class="mono">${mb} MB</span></li>`;
  });
  writeFileSync(
    path.join(dir, "index.html"),
    `<title>${esc(title)}</title>
<style>
:root{color-scheme:dark;--ground:#050505;--line:#2a2a2a;--text:#f5f5f5;--muted:#9b9b9b}
body{background:var(--ground);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding-inline:16px;padding-block:32px 48px}
main{max-width:720px;margin:0 auto}
h1{font-size:22px;font-weight:800;letter-spacing:.01em;margin:0 0 8px;text-wrap:balance}
p{color:var(--muted);max-width:65ch}
ul{list-style:none;padding:0;margin:24px 0 0;border-top:1px solid var(--line)}
li{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--line)}
a{color:var(--text);font-weight:600}a:focus-visible{outline:2px solid #fff;outline-offset:2px}
.mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;color:var(--muted);font-size:12px;white-space:nowrap}
</style>
<main>
<h1>${esc(title)}</h1>
<p>${esc(intro)}</p>
<ul>
${rows.join("\n")}
</ul>
</main>
`,
  );
  return pages;
}

if (require.main === module) {
  const [dir, title, intro = ""] = process.argv.slice(2);
  console.log(`${writeHub(path.resolve(dir), title, intro).length} pages linked`);
}
