import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/maze";
import { E, N, S, Wd, buildMaze, glyph } from "@/lib/custom/draw/maze";
import { FONT } from "@/lib/custom/draw/pixelFont";
import { PRODUCT, check, mazeProblem } from "@/lib/custom/specs/maze";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const ok = (p: unknown) => validate({ t: "maze", v: 1, p });
const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Every property a perfect maze that spells its word must have; the first broken one, or null. */
function mazeFault(x: string, d: 1 | 2 | 3): string | null {
  const { cols, rows, open, path, letter } = buildMaze(x, d);
  const n = cols * rows;
  // Passages agree on both sides, and none leads off the grid (but the entrance and the exit).
  let edges = 0;
  for (let p = 0; p < n; p++) {
    const r = Math.floor(p / cols), c = p % cols;
    if (open[p] & E && (c === cols - 1 || !(open[p + 1] & Wd))) return `east ${p}`;
    if (open[p] & S && r < rows - 1 && !(open[p + cols] & N)) return `south ${p}`;
    if (open[p] & Wd && c === 0) return `west edge ${p}`;
    if (open[p] & E) edges++;
    if (open[p] & S && r < rows - 1) edges++;
  }
  const [entry, exit] = [path[0], path[path.length - 1]];
  if (entry >= cols || !(open[entry] & N) || exit < n - cols || !(open[exit] & S)) return "entrance or exit";
  for (let p = 0; p < n; p++) if ((open[p] & N && p >= cols && !(open[p - cols] & S)) || (open[p] & N && p < cols && p !== entry) || (open[p] & S && p >= n - cols && p !== exit)) return `frame ${p}`;
  // A tree: every cell reachable, one edge fewer than cells (so exactly one way between any two).
  if (edges !== n - 1) return `edges ${edges} of ${n - 1}`;
  const prev = new Int32Array(n).fill(-2);
  prev[entry] = -1;
  const q = [entry];
  while (q.length) {
    const p = q.shift()!;
    const r = Math.floor(p / cols);
    for (const [bit, to] of [[N, p - cols], [E, p + 1], [S, p + cols], [Wd, p - 1]] as const)
      if (open[p] & bit && !(bit === N && r === 0) && !(bit === S && r === rows - 1) && prev[to] === -2) (prev[to] = p), q.push(to);
  }
  if (prev.some((v) => v === -2)) return "unreachable cells";
  // The one way from the entrance to the exit is the path…
  const way = [exit];
  while (prev[way[0]] >= 0) way.unshift(prev[way[0]]);
  if (way.join() !== path.join()) return "the way through isn't the path";
  // …and it spells the word: every cell of each letter, one letter after another.
  const order = path.map((p) => letter[p]).filter(Boolean);
  const runs = order.filter((v, i) => i === 0 || v !== order[i - 1]);
  if (runs.join() !== [...x].map((_, i) => i + 1).join()) return `letters out of order: ${runs.join()}`;
  const count = letter.reduce((s, v) => s + (v ? 1 : 0), 0);
  if (order.length !== count) return `path covers ${order.length} of ${count} letter cells`;
  return null;
}

describe("Your Maze: the spec", () => {
  it("accepts the example, drops unknown keys, keeps a fixed key order", () => {
    expect(check(PRODUCT.example as never, {})).toEqual(PRODUCT.example);
    expect(ok({ w: "For Noa", s: 1, d: 3, x: "NB", q: 2 })).toEqual({ t: "maze", v: 1, p: { x: "NB", d: 3, s: 1, w: "For Noa" } });
    expect(Object.keys(ok({ w: "For Noa", s: 1, d: 3, x: "NB" })!.p)).toEqual(["x", "d", "s", "w"]);
  });
  it("rejects wrong types, ranges, unknown values, non-canonical forms and over-limit inputs", () => {
    for (const p of [
      { x: "", d: 1 },
      { x: "nb", d: 1 },
      { x: "N.B.", d: 1 },
      { x: "N B", d: 1 },
      { x: "ABCD", d: 1 },
      { x: "É", d: 1 },
      { x: "?", d: 1 },
      { x: 12, d: 1 },
      { x: "NB", d: 0 },
      { x: "NB", d: 4 },
      { x: "NB", d: "2" },
      { x: "NB", d: 1.5 },
      { x: "NB", d: 1, s: 0 },
      { x: "NB", d: 1, s: true },
      { x: "NB", d: 1, w: "" },
      { x: "NB", d: 1, w: "x".repeat(29) },
      { d: 1 },
    ])
      expect(ok(p), JSON.stringify(p)).toBeNull();
  });
  it("reads typed initials the way the editor does", () => {
    expect(mazeProblem("n. b.")).toBeNull();
    expect(mazeProblem("abcd")).toMatch(/Up to 3/);
    expect(mazeProblem("é")).toMatch(/can't spell/);
    expect(mazeProblem(" . ")).toMatch(/One to three/);
  });
});

describe("Your Maze: the maze", () => {
  it("every glyph is one piece once its diagonal steps are bridged", () => {
    for (const ch of CHARS) {
      const g = glyph(ch);
      const on: [number, number][] = [];
      g.forEach((row, r) => row.forEach((v, c) => v && on.push([r, c])));
      const seen = new Set([`${on[0]}`]);
      const q = [on[0]];
      while (q.length) {
        const [r, c] = q.pop()!;
        for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) if (g[a]?.[b] && !seen.has(`${[a, b]}`)) seen.add(`${[a, b]}`), q.push([a, b]);
      }
      expect(seen.size, ch).toBe(on.length);
      // Bridging only adds pixels.
      FONT[ch].forEach((row, r) => [...row].forEach((v, c) => v === "X" && expect(g[r][c]).toBe(true)));
    }
  });
  it("is perfect and its one way through spells the initials: every letter, one to three, every level", () => {
    const rnd = mulberry32(0x3a2e);
    const words = [...CHARS, "NB", "MW", "QQ", "WWW", "MQ8", "I1I", "OBO", "XYZ", "0W"];
    for (let i = 0; i < 8; i++) words.push(Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => CHARS[Math.floor(rnd() * CHARS.length)]).join(""));
    const faults: string[] = [];
    words.forEach((x, i) => {
      for (const d of i < CHARS.length ? [((i % 3) + 1) as 1 | 2 | 3] : ([1, 2, 3] as const)) {
        const f = mazeFault(x, d);
        if (f) faults.push(`${x} ${d}: ${f}`);
      }
    });
    expect(faults.slice(0, 5)).toEqual([]);
  }, 120_000);
});

describe("Your Maze: the template", () => {
  it("is deterministic, and writes only what the canvas draws", () => {
    const spec = ok({ x: "NB", d: 2, s: 1 })!;
    const svg = render(spec, "black");
    expect(svg).toBe(render(spec, "black"));
    expect(svg).not.toMatch(FORBIDDEN);
  });
  it("the example passes the gate on both tees", () => {
    const spec = ok(PRODUCT.example)!;
    for (const c of ["black", "white"] as const) expect(gate(render(spec, c), c)).toBeNull();
  });
  it("the longest link fits", () => {
    const len = encodeMake(ok({ x: "WWW", d: 3, s: 1, w: "W".repeat(28) })!).length;
    console.log(`maze: longest ?make= is ${len} characters`);
    expect(len).toBeLessThan(300);
  });
  it("one to three letters, every level, drawn or not, words or none: all pass the gate", () => {
    const rnd = mulberry32(0x3a2e1);
    const raws: Record<string, unknown>[] = [];
    const fixed = ["I", "W", "M", "1", ".", "NB", "WM", "II", "WWW", "MMM", "III", "B8B", "Q0Q"].filter((x) => /^[A-Z0-9]+$/.test(x));
    for (const x of fixed) for (const d of [1, 2, 3]) raws.push({ x, d, ...(rnd() < 0.5 ? { s: 1 } : {}), ...(rnd() < 0.3 ? { w: "W".repeat(28) } : {}) });
    for (let i = 0; i < 60; i++)
      raws.push({ x: Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => CHARS[Math.floor(rnd() * CHARS.length)]).join(""), d: 1 + Math.floor(rnd() * 3), ...(rnd() < 0.5 ? { s: 1 } : {}), ...(rnd() < 0.3 ? { w: "For Noa, aged 7" } : {}) });
    const failures: string[] = [];
    raws.forEach((raw, i) => {
      const spec = ok(raw) as CustomSpec;
      expect(spec, JSON.stringify(raw)).not.toBeNull();
      const colors: ("black" | "white")[] = i % 3 ? ["black"] : ["black", "white"];
      for (const c of colors) {
        const bad = gate(render(spec, c), c);
        if (bad) failures.push(`${JSON.stringify(raw)} ${c}: ${bad}`);
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
