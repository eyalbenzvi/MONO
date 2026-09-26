/**
 * After `next build` (npm runs it as "postbuild"), over the static export:
 *
 * 1. Link-preview images (R32): every pre-rendered product page needs
 *    out/og/<id>.png. When the OG step ran (some exist) a missing one fails
 *    the build. When it didn't run at all (a quick local build), pages point
 *    at og/default.png instead — or keep their links if that's missing too.
 * 2. Product pages get og:type=product and product:price:* (Next's Open
 *    Graph types have no "product").
 * 3. Structured data (JSON-LD) goes into <head> here rather than through
 *    React, so it isn't repeated in each page's React payload.
 * 4. Every page gets its Content-Security-Policy meta tag, first in <head>
 *    (right after the charset), listing the sha256 of its own inline scripts
 *    instead of allowing 'unsafe-inline' (lib/csp).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import full from "../../data/shirts.json";
import { homeJsonLd, jsonLd, productJsonLd } from "../../lib/structuredData";
import { contentSecurityPolicy } from "../../lib/csp";
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

function main() {
  if (!existsSync(path.join(OUT, "index.html"))) {
    console.error("postbuild: out/ not found");
    process.exit(1);
  }
  const pages = productPages();
  const byId = new Map(SHIRTS.map((s) => [s.id, s]));
  const og = path.join(OUT, "og");
  const have = new Set(existsSync(og) ? readdirSync(og).filter((f) => /^mono-\d{4}\.png$/.test(f)).map((f) => f.slice(0, -4)) : []);
  const hasDefault = existsSync(path.join(og, "default.png"));
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
      html = html.replace(new RegExp(`/og/${id}\\.png`, "g"), "/og/default.png");
      if (html !== before) fallback++;
    }
    html = html.replace(
      /<meta property="og:type" content="website"\/>/,
      `<meta property="og:type" content="product"/><meta property="product:price:amount" content="${shirt.price.toFixed(2)}"/><meta property="product:price:currency" content="USD"/>`,
    );
    writeFileSync(file, intoHead(html, ld(productJsonLd(shirt))));
  }

  const home = path.join(OUT, "index.html");
  const homeHtml = readFileSync(home, "utf8");
  if (!homeHtml.includes('type="application/ld+json"')) writeFileSync(home, intoHead(homeHtml, ld(homeJsonLd())));

  // Content-Security-Policy, per page, with its inline scripts' hashes.
  let csp = 0;
  for (const file of htmlFiles(OUT)) {
    writeFileSync(file, withCsp(readFileSync(file, "utf8")));
    csp++;
  }

  if (!ogRan) console.warn(`postbuild: no link-preview images in out/og (npm run og didn't run)${hasDefault ? ` — ${fallback} pages use og/default.png` : ""}`);
  console.log(`postbuild: ${pages.length} product pages checked${ogRan ? ", all with their og image" : ""}; JSON-LD written; CSP on ${csp} pages`);
}

if (require.main === module) main();
