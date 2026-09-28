import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../scripts/gen/core";
import { fit, polyline } from "@/lib/custom/draw/paths";
import { harmonographPoints, lissajousLines, lissajousPath, tracePath } from "@/lib/custom/draw/curves";
import { lsystem, phyllotaxis, plant, turtle } from "@/lib/custom/draw/botany";
import { guilloche, rosette } from "@/lib/custom/draw/ornament";
import { BRAILLE_NUMBER, binaryText, brailleCell, brailleEncode, brailleLine, hollerith, morseEncode, morseLine, morseMarks, paperTape, punchCard } from "@/lib/custom/draw/code";
import { dial, dialFraction, slideRule, slideScale } from "@/lib/custom/draw/instruments";
import { brickBond, clipToBox, facadeGrid, orders } from "@/lib/custom/draw/architecture";

const DRAW = path.resolve(__dirname, "..", "lib", "custom", "draw");
const BOX = { x: 30, y: 44, w: 240, h: 266 };
const FERN = { axiom: "X", rules: { X: "F+[[X]-X]-F[-FX]+X", F: "FF" }, iter: 4 };

/** Each drawing with a customer's own inputs; the RNG-taking ones get a fresh seeded generator per call. */
const CASES: [string, () => string][] = [
  ["polyline", () => polyline([[0, 0], [10.04, 5], [10.04, 5], [20, 0]])],
  ["fit", () => JSON.stringify(fit([[[0, 0], [2, 1]]], BOX))],
  ["harmonograph", () => tracePath(harmonographPoints({ a: 3, b: 2, detune: [1, 1.004, 1, 0.997], phases: [0.3, 0.9, 1.7, 2.1], damping: [0.015, 0.02, 0.018, 0.013] }), BOX)],
  ["lissajous", () => lissajousPath({ a: 3, b: 4, delta: 0.7, copies: 5 }, BOX)],
  ["phyllotaxis", () => phyllotaxis({ n: 400, angle: 137.508, grow: true })],
  ["L-system plant", () => plant(FERN, 24, 3, mulberry32(7), BOX)],
  ["L-system plant, no jitter", () => plant(FERN, 24, 0, () => 0.5, BOX)],
  ["guilloche", () => guilloche({ lobes: 9, strands: 6, amps: [0.3, 0.4] })],
  ["rosette", () => rosette({ n: 11, circles: [true, false, true, false] })],
  ["punchCard NOA", () => punchCard("NOA")],
  ["paperTape NOA", () => paperTape("NOA")],
  ["binaryText NOA", () => binaryText("NOA")],
  ["morse NOA 7", () => morseLine(20, 100, "NOA 7")],
  ["braille NOA 7", () => brailleLine(20, 100, "NOA 7")],
  ["dial", () => dial({ from: -135, to: 135, ticks: 40, major: 5, labels: (i) => String(i / 5), needle: dialFraction(4, 0, 8) })],
  ["slide rule", () => slideRule({ mark: 3.14 })],
  ["slide scale", () => slideScale("CI", 150, 40, 200)],
  ["brick bond", () => brickBond("flemish", { box: { x: 20, y: 20, w: 200, h: 150 }, id: "b1" })],
  ["herringbone", () => brickBond("herringbone", { box: { x: 20, y: 20, w: 260, h: 300 }, scale: 0.25, id: "b2" })],
  ["orders", () => orders({ orders: [["Doric", 8], ["Ionic", 9]], x0: 100, step: 100 })],
  ["facade", () => facadeGrid({ cols: 6, rows: 8, gap: 5, sw: 1.5, bands: new Set([3]), filled: (r, c) => (r + c) % 3 === 0, box: BOX }).body],
];

describe("lib/custom/draw: the generator's drawings, reusable by templates", () => {
  it.each(CASES)("%s is deterministic and draws something", (_, draw) => {
    const a = draw();
    expect(a.length).toBeGreaterThan(10);
    expect(draw()).toBe(a);
  });

  it("encodes a name in the standards' codes", () => {
    expect(hollerith("N")).toEqual([1, 7]);
    expect(hollerith("7")).toEqual([9]);
    expect(morseEncode("NOA 7")).toEqual(["-.", "---", ".-", "", "--..."]);
    // Braille digits are the letters a–j after the number sign.
    expect(brailleEncode("NOA 7")).toEqual(["1345", "135", "1", "", BRAILLE_NUMBER, "1245"]);
    expect(morseMarks(0, 0, "-.").x).toBe(22);
    expect(brailleCell(0, 0, "1").match(/fill="#FFFFFF"/g)).toHaveLength(1);
    expect(punchCard("NOA")).toContain('width="5.2"');
    expect(paperTape("NOA")).toContain("00110");
  });

  it("draws the path data a polyline asks for", () => expect(polyline([[0, 0], [10.04, 5], [10.04, 5], [20, 0]])).toBe("M0 0L10 5L20 0"));

  it("walks an L-system and clips polygons as the catalogue does", () => {
    expect(lsystem({ axiom: "F", rules: { F: "F+F" }, iter: 2 })).toBe("F+F+F+F");
    expect(turtle("FF", 90, 0, () => 0.5)).toHaveLength(1);
    expect(clipToBox([[-5, -5], [5, -5], [5, 5], [-5, 5]], 0, 0, 10, 10)).toEqual([[0, 0], [5, 0], [5, 5], [0, 5]]);
    expect(lissajousLines({ a: 1, b: 2, delta: 0, copies: 3 })).toHaveLength(3);
  });

  it("stays pure and small (each module is bundled per page)", () => {
    for (const f of readdirSync(DRAW)) {
      const src = readFileSync(path.join(DRAW, f), "utf8");
      expect(src, f).not.toMatch(/from "node:|require\(|Math\.random|Date\b/);
      expect(gzipSync(src).length, f).toBeLessThan(25_000);
    }
  });
});
