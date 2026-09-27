import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import full from "@/data/shirts.json";
import { solidBlock, svgInk } from "../scripts/gen/quality";
import { checkPrint } from "../scripts/tools/blockCheck";
import type { CatalogEntry } from "@/types/shirt";

const FULL = full as unknown as CatalogEntry[];
const svg = (ground: string, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400"><rect width="300" height="400" fill="${ground}"/>${body}</svg>`;

describe("Part 0: no print lands on the tee as a solid block of ink", () => {
  it("the check refuses a knockout (a white slab with thin outlines of a square, a circle and a triangle in it)", () => {
    const knock = svg("#000000", `<rect x="15" y="15" width="270" height="370" fill="#FFFFFF"/><rect x="60" y="60" width="80" height="80" fill="none" stroke="#000000" stroke-width="3"/><circle cx="200" cy="200" r="45" fill="none" stroke="#000000" stroke-width="3"/><path d="M80 330 L150 230 L220 330 Z" fill="none" stroke="#000000" stroke-width="3"/>`);
    expect(solidBlock(svgInk(knock, "black")).reject).not.toBeNull();
    // A filled panel behind a motif, a slab covering the print's edges.
    expect(solidBlock(svgInk(svg("#FFFFFF", `<rect x="40" y="120" width="220" height="180" fill="#000000"/>`), "white")).reject).not.toBeNull();
    expect(solidBlock(svgInk(svg("#FFFFFF", `<rect width="300" height="400" fill="#000000"/><circle cx="150" cy="200" r="60" fill="#FFFFFF"/>`), "white")).reject).not.toBeNull();
  });

  it("the check refuses solid towers with windows cut out, whatever their outline (rule d, slab)", () => {
    // A skyline: filled towers of uneven height, rows of small windows — no rectangle outline for rules (a) and (b).
    const towers = [[20, 160, 50], [75, 120, 40], [120, 200, 60], [185, 90, 45], [235, 150, 45]]
      .map(([x, top, w]) => `<rect x="${x}" y="${top}" width="${w}" height="${360 - top}" fill="#FFFFFF"/>` + Array.from({ length: Math.floor((340 - top) / 18) }, (_, k) => `<rect x="${x + 6}" y="${top + 8 + k * 18}" width="${w - 12}" height="6" fill="#000000"/>`).join(""))
      .join("");
    const c = solidBlock(svgInk(svg("#000000", towers), "black"));
    expect(c.reject).toBe("slab");
    expect(c.solid).toBeGreaterThan(0.1);
  });

  it("the check refuses one filled bar among outlines (rule d: a connected patch of solid ink over 3% of the print)", () => {
    const bars = Array.from({ length: 6 }, (_, k) => `<rect x="40" y="${30 + k * 55}" width="220" height="40" fill="none" stroke="#FFFFFF" stroke-width="3"/>`).join("");
    const open = solidBlock(svgInk(svg("#000000", bars), "black"));
    expect(open.reject).toBeNull();
    const c = solidBlock(svgInk(svg("#000000", `${bars}<rect x="40" y="345" width="220" height="45" fill="#FFFFFF"/>`), "black"));
    expect(c.reject).toBe("slab");
    expect(c.slab).toBeGreaterThanOrEqual(0.03);
  });

  it("a halftone's dark masses are an open mesh of dots at print resolution, never solid ink", async () => {
    // The 80% cap on masses (scripts/photos/halftone.py cap_masses): the darkest photographs and plates check clean at their own size.
    const dark = FULL.filter((s) => s.backPrintUrl.endsWith(".webp")).sort((a, b) => b.quality - a.quality).slice(0, 12);
    for (const s of dark) expect((await checkPrint(s)).solid, s.id).toBe(0);
  }, 120_000);

  it("open line art, a line grid in a thin frame and a dotted halftone pass", () => {
    const lines = Array.from({ length: 12 }, (_, i) => `<line x1="20" y1="${20 + i * 30}" x2="280" y2="${20 + i * 30}" stroke="#FFFFFF" stroke-width="1.5"/><line x1="${20 + i * 23}" y1="20" x2="${20 + i * 23}" y2="380" stroke="#FFFFFF" stroke-width="1.5"/>`).join("");
    expect(solidBlock(svgInk(svg("#000000", `<rect x="10" y="10" width="280" height="380" fill="none" stroke="#FFFFFF" stroke-width="1.5"/>${lines}`), "black")).reject).toBeNull();
    const dots = Array.from({ length: 30 * 40 }, (_, k) => `<circle cx="${5 + (k % 30) * 10}" cy="${5 + Math.floor(k / 30) * 10}" r="${1 + ((k * 7) % 3)}" fill="#000000"/>`).join("");
    expect(solidBlock(svgInk(svg("#FFFFFF", dots), "white")).reject).toBeNull();
    expect(solidBlock(svgInk(svg("#FFFFFF", `<circle cx="150" cy="200" r="100" fill="none" stroke="#000000" stroke-width="2"/>`), "white")).reject).toBeNull();
  });

  it("every design in the catalogue passes (rendered at the print's own size)", async () => {
    const refused: string[] = [];
    for (const s of FULL) {
      const c = await checkPrint(s);
      if (c.reject) refused.push(`${s.id} ${c.reject}`);
    }
    expect(refused).toEqual([]);
  }, 300_000);

  it("no description mentions a solid ink block or a knockout, and the generator has no knockout mode", () => {
    for (const s of FULL) expect(`${s.summary} ${s.description}`, s.id).not.toMatch(/solid ink block|knock(ed)?[ -]?out/i);
    const gen = readFileSync(path.resolve(__dirname, "..", "scripts", "generateCatalog.ts"), "utf8");
    expect(gen).not.toMatch(/knockout|knocked out/i);
  });
});
