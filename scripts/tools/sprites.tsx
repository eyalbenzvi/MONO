/**
 * Shared SVG files the pages point at instead of inlining (R23):
 *
 * - public/icons.svg: one <symbol> per icon in lib/icons.ts, from lucide.
 * - public/tee/<layer>-<colour>.svg: the mockup's garment (fabric, seams,
 *   collar), fold shadows and highlights, per tee colour (lib/teeShape).
 *
 *   npm run sprites        (tests check the files match)
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as lucide from "lucide-react";
import { ICONS } from "../../lib/icons";
import { TEE_BODY, TEE_COLLAR, TEE_COLORS, TEE_HEMS, TEE_SEAMS, TEE_VIEW } from "../../lib/teeShape";

const ROOT = path.resolve(__dirname, "../..");

export function iconSprite() {
  const symbols = Object.entries(ICONS).map(([id, component]) => {
    const svg = renderToStaticMarkup(createElement((lucide as unknown as Record<string, React.ComponentType>)[component]));
    const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    return `<symbol id="${id}" viewBox="0 0 24 24">${inner}</symbol>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join("")}</svg>\n`;
}

const VIEW = `${TEE_VIEW.x} ${TEE_VIEW.y} ${TEE_VIEW.w} ${TEE_VIEW.h}`;
const doc = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW}" width="${TEE_VIEW.w}" height="${TEE_VIEW.h}">${body}</svg>\n`;

export function teeLayers(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const color of ["black", "white"] as const) {
    const { fabric, seam, collar } = TEE_COLORS[color];
    const black = color === "black";
    out[`garment-${color}`] = doc(
      `<path d="${TEE_BODY}" fill="${fabric}"/>` +
        `<path d="${TEE_SEAMS}" fill="none" stroke="${seam}" stroke-width="1.4"/>` +
        `<path d="${TEE_HEMS}" fill="none" stroke="${seam}" stroke-width="1.2" stroke-dasharray="3 3"/>` +
        `<path d="${TEE_COLLAR}" fill="none" stroke="${collar}" stroke-width="7" stroke-linecap="round"/>`,
    );
    out[`shade-${color}`] = doc(
      `<defs><clipPath id="c"><path d="${TEE_BODY}"/></clipPath>` +
        `<linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-opacity=".55"/><stop offset=".22" stop-opacity="0"/><stop offset=".78" stop-opacity="0"/><stop offset="1" stop-opacity=".55"/></linearGradient>` +
        `<linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset=".8" stop-opacity="0"/><stop offset="1" stop-opacity=".35"/></linearGradient>` +
        `<radialGradient id="f"><stop offset="0" stop-opacity=".5"/><stop offset="1" stop-opacity="0"/></radialGradient></defs>` +
        `<g clip-path="url(#c)" opacity="${black ? 0.85 : 0.3}">` +
        `<rect x="92" y="20" width="216" height="420" fill="url(#s)"/><rect width="400" height="440" fill="url(#h)"/>` +
        `<ellipse cx="100" cy="160" rx="26" ry="60" fill="url(#f)"/><ellipse cx="300" cy="160" rx="26" ry="60" fill="url(#f)"/>` +
        `<ellipse cx="250" cy="340" rx="16" ry="90" fill="url(#f)" transform="rotate(18 250 340)" opacity=".6"/>` +
        `<ellipse cx="150" cy="380" rx="12" ry="60" fill="url(#f)" transform="rotate(-12 150 380)" opacity=".5"/>` +
        `<ellipse cx="50" cy="120" rx="30" ry="14" fill="url(#f)" transform="rotate(40 50 120)" opacity=".5"/>` +
        `<ellipse cx="350" cy="120" rx="30" ry="14" fill="url(#f)" transform="rotate(-40 350 120)" opacity=".5"/></g>`,
    );
    out[`light-${color}`] = doc(
      `<defs><clipPath id="c"><path d="${TEE_BODY}"/></clipPath><radialGradient id="l"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
        `<g clip-path="url(#c)" opacity="${black ? 0.12 : 0.05}">` +
        `<ellipse cx="175" cy="200" rx="70" ry="150" fill="url(#l)"/><ellipse cx="272" cy="300" rx="10" ry="80" fill="url(#l)" transform="rotate(18 272 300)"/>` +
        `<ellipse cx="200" cy="40" rx="90" ry="16" fill="url(#l)"/></g>`,
    );
  }
  return out;
}

if (require.main === module) {
  writeFileSync(path.join(ROOT, "public", "icons.svg"), iconSprite());
  for (const [name, svg] of Object.entries(teeLayers())) writeFileSync(path.join(ROOT, "public", "tee", `${name}.svg`), svg);
  console.log(`sprites: ${Object.keys(ICONS).length} icons → public/icons.svg · ${Object.keys(teeLayers()).length} tee layers → public/tee`);
}
