/**
 * The icon sprite the pages point at instead of inlining (R23):
 * public/icons.svg, one <symbol> per icon in lib/icons.ts, from lucide.
 *
 *   npm run sprites        (tests check the file matches)
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as lucide from "lucide-react";
import { ICONS } from "../../lib/icons";

const ROOT = path.resolve(__dirname, "../..");

export function iconSprite() {
  const symbols = Object.entries(ICONS).map(([id, component]) => {
    const svg = renderToStaticMarkup(createElement((lucide as unknown as Record<string, React.ComponentType>)[component]));
    const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    return `<symbol id="${id}" viewBox="0 0 24 24">${inner}</symbol>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join("")}</svg>\n`;
}

if (require.main === module) {
  writeFileSync(path.join(ROOT, "public", "icons.svg"), iconSprite());
  console.log(`sprites: ${Object.keys(ICONS).length} icons → public/icons.svg`);
}
