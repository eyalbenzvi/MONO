import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BOXES, MEDIUM_W, PX_PER_MM, convert, fit } from "@/lib/upload/convert";
import { DEFAULTS, fixesFor, openWords, settingsKey, type PreviewFail } from "@/lib/upload/client";
import { FACES, FACE_IDS, FILL_MAX, PRINTABLE, WORDS_DEFAULT, cased, layoutWords, letters } from "@/lib/upload/words";

/** A measurer like a monospace face: 0.6 em a letter, capitals 0.73 em tall, descenders 0.2 em. */
const mono = (s: string, px: number) => ({ w: s.length * 0.6 * px, asc: 0.73 * px, desc: /[gjpqy]/.test(s) ? 0.2 * px : 0 });

describe("words: the layout", () => {
  it("Same size, Centre: every line at the middle; Left: every line at the margin", () => {
    const c = layoutWords(["MODERATE", "BECOMING", "GOOD"], WORDS_DEFAULT, mono);
    expect(c.runs.every((r) => r.x === c.w / 2 && r.align === "center")).toBe(true);
    const l = layoutWords(["MODERATE", "GOOD"], { ...WORDS_DEFAULT, align: "left" }, mono);
    expect(new Set(l.runs.map((r) => r.x)).size).toBe(1);
    expect(l.runs[0].x).toBeLessThan(l.w / 4);
    expect(l.runs[0].align).toBe("left");
  });
  it("Fill width: every line as wide as the widest, a short one scaled no further than 2.5×", () => {
    const f = layoutWords(["MODERATE", "BECOMING", "GOOD"], { ...WORDS_DEFAULT, layout: "fill" }, mono);
    const widths = f.runs.map((r) => mono(r.text, r.px).w);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
    const capped = layoutWords(["BECOMING", "A"], { ...WORDS_DEFAULT, layout: "fill" }, mono);
    expect(capped.runs[1].px).toBe(160 * FILL_MAX);
    // Fill width is centred whatever Align says.
    expect(layoutWords(["AB", "ABCD"], { ...WORDS_DEFAULT, layout: "fill", align: "left" }, mono).runs.every((r) => r.align === "center")).toBe(true);
  });
  it("lines never overlap, however tight the type's leading", () => {
    const tall = (s: string, px: number) => ({ w: s.length * 0.5 * px, asc: 0.95 * px, desc: 0.3 * px });
    const t = layoutWords(["Hygge", "Hygge"], { ...WORDS_DEFAULT, face: "condensed" }, tall);
    const [a, b] = t.runs;
    expect(b.y - b.px * 0.95).toBeGreaterThan(a.y + a.px * 0.3);
    expect(t.h).toBeGreaterThan(b.y + b.px * 0.3);
  });
  it("Capitals are counted as they print (ß is SS)", () => {
    expect(cased("straße", true)).toBe("STRASSE");
    expect(letters(cased("straße", true))).toBe(7);
    expect(letters("Käse")).toBe(4);
  });
  it("prints what a phone types: curly quotes, dashes, the ellipsis, Latin accents; not ¼, soft hyphens or emoji", () => {
    for (const ok of ["DON’T", "“Hi” – ok…", "Käse", "Łódź", "Ærø — Ōsaka"]) expect(PRINTABLE.test(ok), ok).toBe(true);
    for (const no of ["¼", "a­b", "😀", "ŉ"]) expect(PRINTABLE.test(no), no).toBe(false);
  });
});

describe("words: opening, by the type's limit", () => {
  const line = "ABCDEFGHIJ ABCDEFGHIJ ABCDEFG"; // 29 letters
  it("29 letters open in Condensed and not in Mono, which says its own limit", async () => {
    expect((await openWords([line], "w1", { face: "condensed", caps: false })).ok).toBe(true);
    expect(await openWords([line], "w1", { face: "mono", caps: false })).toMatchObject({ ok: false, code: "long", reason: "Lines of up to 24 letters in Mono." });
  });
  it("Capitals can take a line over (ß)", async () => {
    const l = "ßßßßßßßßßßßß ß"; // 14 as typed, 27 in capitals
    expect((await openWords([l], "w2", { face: "mono", caps: false })).ok).toBe(true);
    expect((await openWords([l], "w2", { face: "mono", caps: true })).ok).toBe(false);
  });
  it("curly punctuation is taken now", async () => {
    expect((await openWords(["DON’T PANIC…"], "w3")).ok).toBe(true);
  });
});

describe("words: the size, in print centimetres", () => {
  it("a letter cap makes the print narrower than the box, still at the top and centred", () => {
    const a = fit(1000, 200, "full");
    const b = fit(1000, 200, "full", { maxK: 0.5 });
    expect(b.w).toBe(500);
    expect(b.w).toBeLessThan(a.w);
    expect(b.y).toBe(BOXES.full.y);
    expect(b.x + b.w / 2).toBeCloseTo(BOXES.full.x + BOXES.full.w / 2, -1);
    expect(fit(1000, 200, "full", { maxW: MEDIUM_W }).w).toBe(MEDIUM_W);
  });
  it("a short word is capped at its type's height, and Medium prints 18 cm wide", () => {
    // "YES" as a block of three bold capitals: a 3:1 slab that would be 28 cm × 9 cm at Full.
    const w = 480, h = 200;
    const data = new Uint8ClampedArray(w * h * 4).fill(255);
    for (let y = 30; y < 170; y++) for (let x = 20; x < 460; x++) if ((x - 20) % 150 < 110 && ((x - 20) % 150 < 30 || y < 60 || y > 140)) for (let c = 0; c < 3; c++) data[(y * w + x) * 4 + c] = 0;
    const px = { w, h, data };
    const free = convert({ pixels: px, words: ["YES"] }, { size: "full" });
    const capped = convert({ pixels: px, words: ["YES"], capPx: 140, maxCapCm: 9.5 }, { size: "full" });
    expect(capped.capMm).toBeLessThanOrEqual(95);
    expect(capped.capMm).toBeGreaterThan(85);
    const inkW = (ink: Uint8Array) => {
      let [lo, hi] = [1e9, -1];
      for (let i = 0; i < ink.length; i++) if (ink[i]) (lo = Math.min(lo, i % 1500)), (hi = Math.max(hi, i % 1500));
      return hi - lo + 1;
    };
    expect(inkW(capped.ink)).toBeLessThan(inkW(free.ink));
    const medium = convert({ pixels: px, words: ["YES"] }, { size: "full", span: "medium" });
    expect(inkW(medium.ink)).toBeLessThanOrEqual(MEDIUM_W + 2);
    expect(Math.round(MEDIUM_W / PX_PER_MM / 10)).toBe(18);
  });
});

describe("words: the settings and the fixes", () => {
  it("a draft or upload kept before types existed reopens as today's look (Mono, Same size, Centre, as typed, Full)", () => {
    const old = { crop: null, rot: 0, stronger: false, bolder: false, mode: "dots", size: "full" };
    expect({ ...DEFAULTS, ...old }).toMatchObject({ face: "mono", layout: "even", align: "centre", caps: false, span: "full" });
    expect(settingsKey({ ...DEFAULTS, ...old } as typeof DEFAULTS)).toBe(settingsKey(DEFAULTS));
    expect(settingsKey({ ...DEFAULTS, face: "serif" })).not.toBe(settingsKey(DEFAULTS));
  });
  const f = (code: string, size: "full" | "small"): PreviewFail => ({ ok: false, reason: "", code, cls: "words", mode: "words", size, canvas: () => null });
  it("too much ink at Full offers Medium, then Small; too faint at Small offers Full, then Condensed", () => {
    expect(fixesFor(f("solid", "full"), DEFAULTS, { kind: "words" }).map((x) => x.id)).toEqual(["medium", "small"]);
    const faint = fixesFor(f("faint", "small"), { ...DEFAULTS, size: "small" }, { kind: "words" });
    expect(faint.map((x) => x.id)).toEqual(["full", "face"]);
    expect(faint[1]).toMatchObject({ label: "Use Condensed", patch: { face: "condensed" } });
  });
});

describe("words: the types are shipped", () => {
  const dir = path.join(__dirname, "..", "..", "public", "fonts", "words");
  it("each face has its file (under 50 KB), its licence, and its name in names.svg", () => {
    const names = readFileSync(path.join(dir, "names.svg"), "utf8");
    for (const id of FACE_IDS) {
      const file = path.join(dir, FACES[id].file);
      expect(existsSync(file), id).toBe(true);
      expect(statSync(file).size, id).toBeLessThan(50_000);
      expect(existsSync(path.join(dir, `LICENSE-${id}.txt`)), id).toBe(true);
      expect(names).toContain(`id="face-${id}"`);
    }
    expect(names.match(/<symbol /g)).toHaveLength(FACE_IDS.length);
  });
});
