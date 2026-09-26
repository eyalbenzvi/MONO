/**
 * Publishes the catalog index for the browser (I03), before every build
 * (npm "prebuild"): public/data/index.<hash>.json — named by its content, so
 * it's cached forever and a code change never re-downloads it — and
 * data/shirts.index.manifest.json, the small file the app imports to know
 * that name. The server side of the build reads data/shirts.index.json.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const SOURCE = path.join(ROOT, "data", "shirts.index.json");
const DIR = path.join(ROOT, "public", "data");
const MANIFEST = path.join(ROOT, "data", "shirts.index.manifest.json");

export function publishedIndex() {
  // Compact JSON (the source keeps one column per line for diffs).
  const json = JSON.stringify(JSON.parse(readFileSync(SOURCE, "utf8")));
  const hash = createHash("sha256").update(json).digest("hex").slice(0, 10);
  return { json, file: `index.${hash}.json` };
}

if (require.main === module) {
  const { json, file } = publishedIndex();
  mkdirSync(DIR, { recursive: true });
  for (const f of readdirSync(DIR)) if (/^index\.[0-9a-f]+\.json$/.test(f) && f !== file) rmSync(path.join(DIR, f));
  writeFileSync(path.join(DIR, file), json);
  writeFileSync(MANIFEST, `${JSON.stringify({ file }, null, 2)}\n`);
  console.log(`index → public/data/${file} (${(json.length / 1024).toFixed(0)} KB)`);
}
