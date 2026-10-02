/**
 * After `next build` (npm runs it as "postbuild"), over the static export:
 *
 * 1. Link-preview images (R32): every pre-rendered product page needs
 *    out/og/<id>.jpg. When the OG step ran (some exist) a missing one fails
 *    the build. When it didn't run at all (a quick local build), pages point
 *    at og/default.jpg instead — or keep their links if that's missing too.
 * 2. Product pages get og:type=product and product:price:* (Next's Open
 *    Graph types have no "product").
 * 3. Structured data (JSON-LD) goes into <head> here rather than through
 *    React, so it isn't repeated in each page's React payload.
 * 4. Every page gets its Content-Security-Policy meta tag, first in <head>
 *    (right after the charset), listing the sha256 of its own inline scripts
 *    instead of allowing 'unsafe-inline' (lib/csp).
 * 5. The first screen doesn't wait on the catalogue (it used to, after every
 *    catalogue change: empty frames for seconds on a phone). The build fails
 *    when a script carries anything that changes with the catalogue — a
 *    published data file's name, a design's id — since every catalogue change
 *    would rename that script and send each returning visitor's phone back to
 *    the network for it; and when the home page's HTML lacks the first card's
 *    picture (lib/firstCard).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import full from "../../data/shirts.json";
import { homeJsonLd, jsonLd, makeJsonLd, productJsonLd } from "../../lib/structuredData";
import { MADE } from "../../lib/custom/products";
import { contentSecurityPolicy } from "../../lib/csp";
import { customModelIds } from "../../lib/custom/models";
import type { CatalogEntry } from "../../types/shirt";

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "out");
const SHIRTS = full as unknown as CatalogEntry[];

const ld = (data: unknown) => `<script type="application/ld+json">${jsonLd(data)}</script>`;
const intoHead = (html: string, extra: string) => html.replace("</head>", `${extra}</head>`);

function productPages() {
  const dir = path.join(OUT, "shop");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((d) => /^mono-\d{4}$/.test(d))
    .map((id) => ({ id, file: path.join(dir, id, "index.html") }))
    .filter((p) => existsSync(p.file));
}

/** Every .html file under `dir`. */
function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return name === "_next" ? [] : htmlFiles(p);
    return name.endsWith(".html") ? [p] : [];
  });
}

/** Inline, executable scripts (not src=, not JSON data blocks): what CSP must allow. */
export function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(([, attrs = ""]) => !/\bsrc=/.test(attrs) && !/type="application\/(ld\+)?json"/.test(attrs)).map((m) => m[2]);
}

/** The page with one CSP meta tag, right after the charset, allowing exactly its inline scripts. */
export function withCsp(html: string) {
  const cleaned = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/gi, "");
  const hashes = [...new Set(inlineScripts(cleaned).map((code) => createHash("sha256").update(code).digest("base64")))];
  const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(hashes)}"/>`;
  return cleaned.replace(/<head>(<meta charSet="utf-8"\/>)?/i, (m) => m + meta);
}

/**
 * The export carries only what pages show. The prints and model photos are
 * inputs of the pictures baked into img/ (scripts/images/bake.ts) and don't
 * ship (but the photos personalised prints are drawn on); baked pictures and link previews of retired designs (left in a
 * local public/ from earlier builds) don't either.
 */
function pruneRetired(): number {
  let removed = 0;
  const prints = path.join(OUT, "prints");
  if (existsSync(prints)) (removed += readdirSync(prints, { recursive: true }).length), rmSync(prints, { recursive: true });
  // The personalised prints draw on a few model photos in the browser (lib/custom/models): those stay.
  const models = path.join(OUT, "models");
  const keep = new Set(customModelIds(SHIRTS).map((id) => `${id}.webp`));
  if (existsSync(models)) for (const f of readdirSync(models)) if (!keep.has(f)) rmSync(path.join(models, f), { recursive: true }), removed++;
  const alive = new Set(SHIRTS.map((s) => s.n));
  for (const [dir, re] of [
    [path.join(OUT, "img", "m"), /^(\d+)-/],
    [path.join(OUT, "img", "p"), /^(\d+)-/],
    [path.join(OUT, "img", "d"), /^(\d+)-/],
    [path.join(OUT, "og"), /^mono-(\d+)\.(png|jpg)$/],
  ] as const) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const m = f.match(re);
      if (m && !alive.has(Number(m[1]))) rmSync(path.join(dir, f)), removed++;
    }
  }
  return removed;
}

/** Files in out/data named by their content that change with the catalogue (the index, its detail shards, search). */
const CATALOGUE_DATA = /^(index|search|details-\d+)\.[0-9a-f]{8,}\.json$/;

/** Scripts that carry something which changes with the catalogue: [script, what] (empty when none do). */
export function catalogueInScripts(out: string): [string, string][] {
  const data = path.join(out, "data");
  const names = existsSync(data) ? readdirSync(data).filter((f) => CATALOGUE_DATA.test(f)) : [];
  const chunks = path.join(out, "_next", "static");
  const found: [string, string][] = [];
  for (const f of existsSync(chunks) ? (readdirSync(chunks, { recursive: true }) as string[]) : []) {
    if (!f.endsWith(".js")) continue;
    const js = readFileSync(path.join(chunks, f), "utf8");
    const name = names.find((n) => js.includes(n));
    if (name) found.push([f, `the name of data/${name}`]);
    const id = js.match(/["'`]mono-\d{4,5}["'`]/);
    if (id) found.push([f, `the design id ${id[0]}`]);
  }
  return found;
}

/** The home page's served HTML shows the first card, picture and all (lib/firstCard): what's missing, or null. */
export function homeFirstCardMissing(html: string): string | null {
  const card = html.indexOf("data-first-card");
  if (card < 0) return "no data-first-card";
  if (!/<img[^>]*data-mockup/.test(html.slice(card, card + 8000))) return "data-first-card has no picture";
  return null;
}

function main() {
  const pruned = pruneRetired();
  const inScripts = catalogueInScripts(OUT);
  if (inScripts.length) {
    console.error(
      `postbuild: scripts carry the catalogue — every catalogue change would rename them, and returning visitors wait for them again (lib/catalogIndex):\n${inScripts
        .slice(0, 10)
        .map(([f, what]) => `  _next/static/${f}: ${what}`)
        .join("\n")}\nRead such data from the page or the index instead of importing it.`,
    );
    process.exit(1);
  }
  if (!existsSync(path.join(OUT, "index.html"))) {
    console.error("postbuild: out/ not found");
    process.exit(1);
  }
  const pages = productPages();
  const byId = new Map(SHIRTS.map((s) => [s.id, s]));
  const og = path.join(OUT, "og");
  const have = new Set(existsSync(og) ? readdirSync(og).filter((f) => /^mono-\d{4}\.jpg$/.test(f)).map((f) => f.slice(0, -4)) : []);
  const hasDefault = existsSync(path.join(og, "default.jpg"));
  const missing = pages.filter((p) => !have.has(p.id)).map((p) => p.id);
  const ogRan = have.size > 0;
  if (ogRan && missing.length) {
    console.error(`postbuild: ${missing.length} pre-rendered product(s) have no link-preview image, e.g. ${missing.slice(0, 5).join(", ")} — run npm run og`);
    process.exit(1);
  }

  let fallback = 0;
  for (const { id, file } of pages) {
    const shirt = byId.get(id);
    if (!shirt) continue;
    let html = readFileSync(file, "utf8");
    if (html.includes('type="application/ld+json"')) continue; // already processed
    if (!ogRan && hasDefault) {
      const before = html;
      html = html.replace(new RegExp(`/og/${id}\\.jpg`, "g"), "/og/default.jpg");
      if (html !== before) fallback++;
    }
    html = html.replace(
      /<meta property="og:type" content="website"\/>/,
      `<meta property="og:type" content="product"/><meta property="product:price:amount" content="${shirt.price.toFixed(2)}"/><meta property="product:price:currency" content="USD"/>`,
    );
    writeFileSync(file, intoHead(html, ld(productJsonLd(shirt))));
  }

  // Make products: their structured data, typed as products (their link-preview images are the examples, npm run og).
  for (const m of MADE) {
    const file = path.join(OUT, "make", m.slug, "index.html");
    if (!existsSync(file)) continue;
    let html = readFileSync(file, "utf8");
    if (html.includes('type="application/ld+json"')) continue;
    if (!existsSync(path.join(og, `make-${m.slug}.jpg`)) && hasDefault) html = html.replace(new RegExp(`/og/make-${m.slug}\\.jpg`, "g"), "/og/default.jpg");
    html = html.replace(/<meta property="og:type" content="website"\/>/, `<meta property="og:type" content="product"/>`);
    writeFileSync(file, intoHead(html, ld(makeJsonLd(m))));
  }

  const home = path.join(OUT, "index.html");
  const homeHtml = readFileSync(home, "utf8");
  const noFirst = homeFirstCardMissing(homeHtml);
  if (noFirst) {
    console.error(`postbuild: the home page's HTML doesn't show the first card (${noFirst}) — Discover would open on an empty frame until the scripts run (lib/firstCard)`);
    process.exit(1);
  }
  if (!homeHtml.includes('type="application/ld+json"')) writeFileSync(home, intoHead(homeHtml, ld(homeJsonLd())));

  // Content-Security-Policy, per page, with its inline scripts' hashes.
  let csp = 0;
  for (const file of htmlFiles(OUT)) {
    writeFileSync(file, withCsp(readFileSync(file, "utf8")));
    csp++;
  }

  if (!ogRan) console.warn(`postbuild: no link-preview images in out/og (npm run og didn't run)${hasDefault ? ` — ${fallback} pages use og/default.jpg` : ""}`);
  console.log(`postbuild: ${pruned} files of retired designs left out; ${pages.length} product pages checked${ogRan ? ", all with their og image" : ""}; JSON-LD written; CSP on ${csp} pages`);
}

if (require.main === module) main();
