/**
 * The print fonts resvg reads (the gate, the audit, the bakers): the system's
 * DejaVu and Liberation (fixed files, the same on the CI runner's Ubuntu), and
 * the Make prints' own faces in assets/fonts (scripts/tools/buildPrintFonts.py:
 * Libre Caslon Text, Oswald, UnifrakturMaguntia), so a print is measured in the
 * glyphs the page shows. A face is only used when a print names its family.
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const SYSTEM = ["/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/truetype/liberation"];
const OWN = path.resolve(__dirname, "..", "..", "assets", "fonts");

/** The Make prints' own faces (every .ttf in assets/fonts). */
export const PRINT_FONT_FILES = existsSync(OWN) ? readdirSync(OWN).filter((f) => f.endsWith(".ttf")).sort().map((f) => path.join(OWN, f)) : [];

/** System font files by name, where they exist, then the Make prints' own. */
export const fontFiles = (names: readonly string[]) => [...SYSTEM.flatMap((d) => names.map((f) => path.join(d, f))).filter((f) => existsSync(f)), ...PRINT_FONT_FILES];
