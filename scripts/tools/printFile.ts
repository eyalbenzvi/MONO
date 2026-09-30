/**
 * A Make print's production file: the print as the printer takes it, one ink
 * on a transparent ground at 300 DPI over the whole print area (28 × 37 cm:
 * 3300 × 4400 pixels), with the vector SVG beside it (its fonts embedded).
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/tools/printFile.ts <make link or code> [black|white] [out dir]
 *
 * The link is a Make page's address (…?make=<code>) or the code alone; the
 * colour is the tee's (default black: white ink); the files go to out dir
 * (default ./print-files). The ink's alpha is the print's own coverage, read
 * from the raster the gate reads (white ink on black: its lightness; black ink
 * on white: its darkness), so antialiased edges stay smooth and the tee's
 * colour never appears in the file: a knockout is simply no ink.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { decodeAirports, decodeCities, decodeCountries, type AirportsFile, type CitiesFile, type CountriesFile } from "../../lib/custom/data";
import { loadRenderer, type RenderData } from "../../lib/custom/renderers";
import { decodeMake, type CustomSpec } from "../../lib/custom/spec";
import type { BaseColor } from "../../types/shirt";
import { FONT_OPTS } from "../images/bake";

const ROOT = path.resolve(__dirname, "..", "..");
/** 300 DPI over the print area, 3:4 as the print is (27.9 × 37.3 cm). */
export const PRINT_PX = { width: 3300, height: 4400, dpi: 300 } as const;
/** The print faces the SVG may name, and their files (lib/custom/kit FONT_FAMILY; public/fonts). */
const FACES: [string, string, string][] = [
  ["DejaVu Sans Mono", "normal", "dejavu-sans-mono"],
  ["DejaVu Sans Mono", "bold", "dejavu-sans-mono-bold"],
  ["Libre Caslon Text", "normal", "libre-caslon-text"],
  ["Libre Caslon Text", "bold", "libre-caslon-text-bold"],
  ["Oswald", "normal", "oswald"],
  ["Oswald", "bold", "oswald-bold"],
  ["UnifrakturMaguntia", "normal", "unifraktur-maguntia"],
  ["IBM Plex Mono", "normal", "ibm-plex-mono"],
  ["IBM Plex Mono", "bold", "ibm-plex-mono-bold"],
  ["Space Grotesk", "normal", "space-grotesk"],
  ["Space Grotesk", "bold", "space-grotesk-bold"],
  ["Cinzel", "normal", "cinzel"],
  ["Cinzel", "bold", "cinzel-bold"],
  ["Playfair Display", "normal", "playfair-display"],
  ["Playfair Display", "bold", "playfair-display-bold"],
];

const read = (f: string) => JSON.parse(readFileSync(path.join(ROOT, "data", f), "utf8"));

/** What any template may need, read from data/ (as the tests and the bakers read it). */
function dataFor(spec: CustomSpec): RenderData {
  const places = decodeCities(read("cities/cities.json") as CitiesFile);
  const sky = { stars: read("sky/stars.json"), lines: (read("sky/constellations.json") as { lines: [number, number][][] }[]).flatMap((c) => c.lines) };
  const c = (spec.p as { c?: unknown }).c;
  return {
    sky,
    places: places.list,
    countries: decodeCountries(read("countries/countries.json") as CountriesFile),
    airports: decodeAirports(read("airports/airports.json") as AirportsFile),
    ...(typeof c === "number" ? { city: places.byId(c) } : {}),
  };
}

/** The code from a Make link (its `make` parameter) or the code itself. */
export function codeOf(arg: string): string {
  try {
    return new URL(arg).searchParams.get("make") ?? arg;
  } catch {
    return arg;
  }
}

/** The SVG with every face it names embedded, so it sets the same anywhere. */
export function embedFonts(svg: string): string {
  const css = FACES.filter(([family]) => svg.includes(family))
    .map(([family, weight, file]) => `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(path.join(ROOT, "public", "fonts", `${file}.woff2`)).toString("base64")}) format("woff2")}`)
    .join("");
  return css ? svg.replace(/^(<svg[^>]*>)/, `$1<defs><style>${css}</style></defs>`) : svg;
}

/** The print as one ink on a transparent ground, PRINT_PX: RGBA, the ink's colour everywhere, its coverage as alpha. */
export async function inkPng(svg: string, color: BaseColor): Promise<Buffer> {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: PRINT_PX.width }, font: FONT_OPTS }).render().asPng();
  const grey = await sharp(png).flatten({ background: color === "black" ? "#000" : "#fff" }).resize(PRINT_PX.width, PRINT_PX.height, { fit: "fill" }).greyscale().raw().toBuffer();
  const ink = color === "black" ? 255 : 0;
  const rgba = Buffer.alloc(PRINT_PX.width * PRINT_PX.height * 4);
  for (let i = 0; i < grey.length; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = ink;
    rgba[i * 4 + 3] = color === "black" ? grey[i] : 255 - grey[i];
  }
  return sharp(rgba, { raw: { width: PRINT_PX.width, height: PRINT_PX.height, channels: 4 } }).withMetadata({ density: PRINT_PX.dpi }).png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  const [arg, colorArg = "black", out = "print-files"] = process.argv.slice(2);
  if (!arg) throw new Error("usage: printFile.ts <make link or code> [black|white] [out dir]");
  const color = colorArg === "white" ? "white" : "black";
  const spec = decodeMake(codeOf(arg));
  if (!spec) throw new Error("not a Make link or code");
  const svg = (await loadRenderer(spec.t))(spec, color, dataFor(spec));
  mkdirSync(out, { recursive: true });
  const name = `${spec.t}-${color}`;
  writeFileSync(path.join(out, `${name}.svg`), embedFonts(svg));
  writeFileSync(path.join(out, `${name}.png`), await inkPng(svg, color));
  console.log(`${out}/${name}.png (${PRINT_PX.width} × ${PRINT_PX.height}, ${PRINT_PX.dpi} DPI) and ${name}.svg`);
}

if (require.main === module) main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
