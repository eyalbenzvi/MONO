/**
 * Short links for sharing (lib/share): one TinyURL per catalogue design, pointing at its product page
 * (the canonical address, no query), written to data/share/short.json and committed, so a share never
 * waits on the service. TinyURL answers with a plain 301 to the page, so a chat app's link preview is
 * the page's own (its image and title). Needs the network; run after the catalogue changes (a design
 * without one shares its long link):
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/tools/shortLinks.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const FILE = path.join(ROOT, "data", "share", "short.json");
/** The public site the links lead to (the GitHub Pages address the site is served from). */
const SITE = process.env.SHORT_LINK_SITE ?? "https://eyalbenzvi.github.io/MONO";

async function main() {
  const shirts = JSON.parse(readFileSync(path.join(ROOT, "data", "shirts.json"), "utf8")) as { id: string }[];
  const links: Record<string, string> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
  let made = 0;
  for (const { id } of shirts) {
    if (links[id]) continue;
    const target = `${SITE}/shop/${id}/`;
    const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(target)}`);
    const short = (await res.text()).trim();
    if (!res.ok || !/^https:\/\/tinyurl\.com\/[A-Za-z0-9]+$/.test(short)) throw new Error(`${id}: ${res.status} ${short.slice(0, 80)}`);
    links[id] = short;
    made++;
    await new Promise((r) => setTimeout(r, 400));
  }
  const sorted = Object.fromEntries(Object.entries(links).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })));
  writeFileSync(FILE, `${JSON.stringify(sorted, null, 1)}\n`);
  console.log(`short links: ${made} new, ${Object.keys(sorted).length} in ${path.relative(ROOT, FILE)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
