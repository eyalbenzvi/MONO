import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { asciiRows, render } from "@/lib/custom/templates/ascii";
import { cropBox, pictureRows, toneGrid } from "@/lib/custom/draw/asciiPicture";
import { ASCII_COLS, ASCII_FILLS, ASCII_ROWS, WORDS_MAX, asciiPack, asciiPictureProblem, asciiUnpack, decodeMake, encodeMake, validate, type AsciiCols, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

describe("Your ASCII: the template", () => {
  it("types each lit pixel of the pixel font in the chosen character", () => {
    // The letters sit inside a glow five cells deep: strip it to read them.
    const letters = (rows: string[], r: number) => rows[r + 5].replace(/[:·.]/g, " ").trim();
    expect(letters(asciiRows({ x: ["HI"], f: "#" }), 0)).toBe("#   #  ###");
    expect(letters(asciiRows({ x: ["HI"], f: "self" }), 3)).toBe("HHHHH   I");
    expect(letters(asciiRows({ x: ["HI"], f: "phrase", p: "ab" }), 0)).toBe("a   b  aba");
    expect(asciiRows({ x: ["I"], f: "@", s: 1 })[6]).toContain("@/");
    // The glow: a light halo (·) next to the letters, the brightest ring (:) round it, fading out to . at its edge.
    const top = asciiRows({ x: ["I"], f: "#" });
    expect(top[4]).toContain("·");
    expect(top[3]).toContain(":");
    expect(top[0].trim()).toMatch(/^\.+$/);
  });
  it("validates lines, characters, fills and the phrase", () => {
    expect(validate({ t: "ascii", v: 1, p: { x: ["noa"], f: "#" } })).toEqual({ t: "ascii", v: 1, p: { x: ["NOA"], f: "#" } });
    for (const p of [{ x: [], f: "#" }, { x: ["A", "B", "C"], f: "#" }, { x: ["ÉCOLE"], f: "#" }, { x: ["ABCDEFGHI"], f: "#" }, { x: ["..."], f: "#" }, { x: ["A"], f: "*" }, { x: ["A"], f: "phrase" }, { x: ["A"], f: "#", p: "x" }, { x: ["A"], f: "phrase", p: "  " }])
      expect(validate({ t: "ascii", v: 1, p }), JSON.stringify(p)).toBeNull();
  });
  it("is deterministic", () => {
    const spec: CustomSpec = { t: "ascii", v: 1, p: { x: ["NOA", "1991"], f: "self", s: 1 } };
    expect(render(spec, "black")).toBe(render(spec, "black"));
  });
  it("one letter to two lines of eight, every fill, shadow or not: all pass the gate", () => {
    const rnd = mulberry32(0xa5c11);
    const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?!.:-+/";
    const word = (n: number) => Array.from({ length: n }, () => CH[Math.floor(rnd() * CH.length)]).join("");
    const specs: unknown[] = [];
    for (const f of ASCII_FILLS)
      for (const x of [["I"], ["1."], ["NOA"], ["WWWWWWWW"], ["MMMMMMMM", "88888888"], ["HELLO", "WORLD"], ["A" + word(Math.floor(rnd() * 8))], ["B" + word(3), "C" + word(7)]])
        for (const s of [0, 1]) specs.push({ t: "ascii", v: 1, p: { x, f, ...(f === "phrase" ? { p: "love, from tel aviv" } : {}), ...(s ? { s: 1 } : {}), ...(rnd() < 0.3 ? { w: "For Maya" } : {}) } });
    const failures: string[] = [];
    specs.forEach((raw, i) => {
      const spec = validate(raw);
      expect(spec, JSON.stringify(raw)).not.toBeNull();
      const color = i % 2 ? "white" : "black";
      const bad = gate(render(spec!, color), color);
      if (bad) failures.push(`${JSON.stringify(spec!.p)} ${color}: ${bad}`);
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});

/* ------------------------------------------------------------------ */
/* A picture: tones on the grid (lib/custom/draw/asciiPicture)          */
/* ------------------------------------------------------------------ */

/** A synthetic picture's luminance, W × H, as the editor hands toneGrid a cropped canvas. */
const W = 96, H = 92;
function picture(f: (x: number, y: number, r: () => number) => number, seed = 1): Float32Array {
  const r = mulberry32(seed);
  const lum = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lum[y * W + x] = Math.min(1, Math.max(0, f(x, y, r)));
  return lum;
}
const tonesOf = (lum: Float32Array, c: AsciiCols, edges = false) => toneGrid(lum, W, H, c, ASCII_ROWS[c], { edges });
const pic = (levels: number[], c: AsciiCols, w?: string) => ({ t: "ascii", v: 1, p: { x: [], c, g: asciiPack(levels), ...(w ? { w } : {}) } });
const gradient = (c: AsciiCols) => tonesOf(picture((x, y) => (x + y) / (W + H)), c);

describe("Your ASCII: a picture", () => {
  it("packs three bits a cell, two cells a character, in one spelling", () => {
    for (const c of ASCII_COLS) {
      const lv = gradient(c);
      expect(lv.length).toBe(c * ASCII_ROWS[c]);
      const g = asciiPack(lv);
      expect(g.length).toBe(lv.length / 2);
      expect(g).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(asciiUnpack(g, c)).toEqual(lv);
    }
    const g = asciiPack(gradient(40));
    expect(asciiUnpack(g, 48)).toBeNull();
    expect(asciiUnpack(g + "A", 40)).toBeNull();
    expect(asciiUnpack(g.slice(1), 40)).toBeNull();
    expect(asciiUnpack(g.slice(0, -1) + "=", 40)).toBeNull();
    expect(asciiUnpack(g, 41)).toBeNull();
    expect(asciiUnpack(7, 40)).toBeNull();
  });
  it("validates a picture strictly: x: [] and no letters' settings, a known width, its grid, the words", () => {
    const lv = gradient(40), g = asciiPack(lv);
    expect(validate({ t: "ascii", v: 1, p: { w: "For Maya", g, c: 40, x: [], extra: 1 } })).toEqual({ t: "ascii", v: 1, p: { x: [], c: 40, g, w: "For Maya" } });
    expect(JSON.stringify(validate(pic(lv, 40))!.p)).toBe(`{"x":[],"c":40,"g":"${g}"}`);
    for (const p of [
      { c: 40, g },
      { x: ["A"], c: 40, g },
      { x: [], g },
      { x: [], c: 40 },
      { x: [], c: 44, g },
      { x: [], c: "40", g },
      { x: [], c: 48, g },
      { x: [], c: 40, g: g + "AA" },
      { x: [], c: 40, g: g.replace(/.$/, "+") },
      { x: [], c: 40, g, f: "#" },
      { x: [], c: 40, g, s: 1 },
      { x: [], c: 40, g, p: "ab" },
      { x: [], c: 40, g, w: "" },
      { x: [], c: 40, g, w: "x".repeat(WORDS_MAX + 1) },
      { x: [], c: 40, g: asciiPack(Array(lv.length).fill(0)) },
      { x: [], c: 40, g: asciiPack(Array(lv.length).fill(7)) },
    ])
      expect(validate({ t: "ascii", v: 1, p }), JSON.stringify(p).slice(0, 80)).toBeNull();
  });
  it("crops to the grid's look, centred across, moved along the long side, closer when zoomed", () => {
    const aspect = (40 * 0.602) / (22 * 1.02);
    const land = cropBox(4000, 2000, 40, 22, 0);
    expect(land).toMatchObject({ sx: 0, sy: 0, sh: 2000 });
    expect(land.sw / land.sh).toBeCloseTo(aspect, 6);
    expect(cropBox(4000, 2000, 40, 22, 1).sx + cropBox(4000, 2000, 40, 22, 1).sw).toBeCloseTo(4000, 6);
    const port = cropBox(1000, 3000, 40, 22, 0.5, 2);
    expect(port.sw).toBeCloseTo(500, 6);
    expect(port.sx).toBeCloseTo(250, 6);
    expect(port.sy + port.sh / 2).toBeCloseTo(1500, 6);
  });
  it("stretches contrast, but a flat picture stays its own tone, and the tee turns the ramp round", () => {
    const lv = tonesOf(picture((x) => 0.35 + 0.3 * (x / W)), 40);
    expect(Math.min(...lv)).toBe(0);
    expect(Math.max(...lv)).toBe(7);
    expect(new Set(tonesOf(picture(() => 0.01), 40))).toEqual(new Set([0]));
    expect(new Set(tonesOf(picture(() => 0.99), 40))).toEqual(new Set([7]));
    // The ink is the characters: on a black tee a light tone is dense, on a white one a dark tone.
    expect(pictureRows([0, 7], 2, "black")).toEqual([" @"]);
    expect(pictureRows([0, 7], 2, "white")).toEqual(["@ "]);
  });
  it("renders deterministically, in the SVG subset, in the frame, as `cat picture.txt`", () => {
    const spec = validate(pic(tonesOf(picture((x, y) => Math.hypot(x - 48, y - 46) < 30 ? 0.9 : 0.2 + x / 300), 48), 48, "For Maya"))!;
    const svg = render(spec, "black");
    expect(svg).toBe(render(spec, "black"));
    expect(svg).not.toMatch(/clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline|<image/);
    expect(svg).toContain("$ cat picture.txt");
    expect(svg).toContain("a picture in 1296 characters");
    expect(svg).toContain("+-----");
    expect(render(spec, "white")).not.toBe(svg);
  });
  it("the words' prints are unchanged (render hashes of the house-type banner: Plex Mono grid, bold letters in a light glow)", () => {
    const specs = [
      { x: ["NOA"], f: "self", s: 1 },
      { x: ["HAPPY", "BIRTHDAY"], f: "phrase", p: "from tel aviv", w: "For Maya" },
      { x: ["MMMMMMMM", "88888888"], f: "#" },
      { x: ["I"], f: "@", s: 1 },
      { x: ["1991"], f: "$", w: "Tel Aviv" },
    ];
    const hashes = specs.flatMap((p) => (["black", "white"] as const).map((c) => createHash("sha256").update(render(validate({ t: "ascii", v: 1, p })!, c)).digest("hex").slice(0, 16)));
    expect(hashes).toEqual(["bfbb76afd69243f1", "8e32d376f813408a", "3c681f0c4a4ba674", "73487d7a72dc5aee", "5a69954967fb725b", "1a8b221eb04f52c8", "7d557ce883cd7cfc", "a8adfea5ce3ab141", "491804cd549d46ea", "2d8b1cadafb2a048"]);
  });
  it("the largest picture link fits (48 × 27, 28 three-byte characters of words)", () => {
    const lv = gradient(48);
    const worst = validate(pic(lv, 48, "’".repeat(WORDS_MAX)))!;
    expect(worst).not.toBeNull();
    const link = encodeMake(worst);
    // 43 + 648 + 7 + 84 + 3 = 785 bytes of JSON, base64url: 1047.
    expect(link.length).toBe(1047);
    expect(decodeMake(link)).toEqual(worst);
  });
  it("synthetic pictures, every width, edges or not: a print passes the gate on both tees, or it's refused with a hint", () => {
    const shapes: Record<string, (x: number, y: number, r: () => number) => number> = {
      across: (x) => x / W,
      down: (_x, y) => 1 - y / H,
      radial: (x, y) => 1 - Math.hypot(x - W / 2, y - H / 2) / 66,
      noise: (_x, _y, r) => r(),
      face: (x, y) => (Math.hypot(x - 37, y - 40) < 5 || Math.hypot(x - 59, y - 40) < 5 ? 0.1 : Math.hypot((x - 48) / 28, (y - 46) / 35) < 1 ? 0.8 : 0.15),
      checker: (x, y) => ((Math.floor(x / 12) + Math.floor(y / 12)) % 2 ? 0.95 : 0.05),
      stripes: (x) => (Math.floor(x / 5) % 2 ? 1 : 0),
      halves: (x) => (x < W / 2 ? 0.05 : 0.95),
      horizon: (x, y) => (y > 60 + 10 * Math.sin(x / 10) ? 0.15 : 0.7 + 0.3 * (y / H)),
      moon: (x, y) => (Math.hypot(x - 48, y - 46) < 14 ? 0.9 : 0.05),
      dim: (x, _y, r) => 0.1 + 0.05 * r() + 0.1 * (x / W),
      pale: (x, _y, r) => 0.85 + 0.05 * r() + 0.08 * (x / W),
      allDark: () => 0.02,
      allLight: () => 0.98,
      fog: (_x, _y, r) => 0.5 + 0.02 * r(),
    };
    const samples: [string, number[], AsciiCols, string | undefined][] = [];
    for (const [name, f] of Object.entries(shapes))
      for (const c of ASCII_COLS) for (const edges of [false, true]) samples.push([`${name} ${c}${edges ? " edges" : ""}`, tonesOf(picture(f), c, edges), c, c === 40 ? "Tel Aviv, 1991" : undefined]);
    // Random pictures: a ground (often near black or white), blobs hard or soft, a slope, some noise, sometimes two halves.
    const rnd = mulberry32(0xa5c12);
    for (let k = 0; k < 90; k++) {
      const bg = rnd() < 0.6 ? (rnd() < 0.5 ? rnd() * 0.15 : 1 - rnd() * 0.15) : rnd();
      const slope = (rnd() - 0.5) * rnd(), noise = rnd() < 0.3 ? rnd() * 0.3 : 0, split = rnd() < 0.15;
      const blobs = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => ({ x: rnd() * W, y: rnd() * H, r: 5 + rnd() * 45, v: rnd() < 0.5 ? 1 - bg + (rnd() - 0.5) * 0.2 : rnd(), soft: rnd() < 0.5 }));
      const f = (x: number, y: number, r: () => number) => {
        let v = split ? (x < W / 2 ? bg : 1 - bg) : bg + slope * (x / W - 0.5);
        for (const b of blobs) {
          const d = Math.hypot(x - b.x, y - b.y) / b.r;
          if (d < 1) v = b.soft ? v + (b.v - v) * (1 - d) : b.v;
        }
        return v + noise * (r() - 0.5);
      };
      const c = ASCII_COLS[k % 3];
      samples.push([`random ${k}`, tonesOf(picture(f, k), c, rnd() < 0.3), c, rnd() < 0.5 ? "For Maya" : undefined]);
    }
    const failures: string[] = [];
    let printed = 0;
    for (const [name, lv, c, w] of samples) {
      const spec = validate(pic(lv, c, w));
      const problem = asciiPictureProblem(lv, c);
      // Refused exactly when there's a hint, and the hint is one line.
      expect(!spec, name).toBe(!!problem);
      if (problem) {
        expect(problem, name).toMatch(/^[^\n]{10,90}$/);
        continue;
      }
      printed++;
      for (const color of ["black", "white"] as const) {
        const bad = gate(render(spec!, color), color);
        if (bad) failures.push(`${name} ${color}: ${bad}`);
      }
    }
    for (const name of ["allDark", "allLight", "fog", "moon"]) for (const c of ASCII_COLS) expect(asciiPictureProblem(tonesOf(picture(shapes[name]), c), c), name).not.toBeNull();
    expect(printed).toBeGreaterThan(samples.length / 2);
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
