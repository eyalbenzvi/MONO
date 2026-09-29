import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/musicbox";
import { NOTES_MAX, PITCHES, PRODUCT, STEPS, check, notesProblem, packNotes, pitchName, tidyNotes, unpackNotes, type Note } from "@/lib/custom/specs/musicbox";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { packInts } from "@/lib/custom/specKit";
import { wordsProblem } from "@/lib/custom/lexicon";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const ok = (p: unknown) => validate({ t: "musicbox", v: 1, p });
const ex = PRODUCT.example;
const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;
const pack = (ns: Note[]) => packInts(packNotes(tidyNotes(ns)));

describe("Your Music Box: the spec", () => {
  it("accepts the example and drops unknown keys, in a fixed key order", () => {
    expect(check(ex as never, {})).toEqual(ex);
    expect(ok({ ...ex, zz: 1 })).toEqual({ t: "musicbox", v: 1, p: ex });
    expect(Object.keys(ok({ w: "Our song", m: ex.m })!.p)).toEqual(["m", "w"]);
    expect(ok({ m: ex.m })).toEqual({ t: "musicbox", v: 1, p: { m: ex.m } });
  });
  it("packs notes delta by delta, tidied to one spelling", () => {
    const notes: Note[] = [[3, 12], [2, 7], [2, 0], [2, 7], [9, 24]];
    expect(tidyNotes(notes)).toEqual([[0, 0], [0, 7], [1, 12], [7, 24]]);
    expect(packNotes(tidyNotes(notes))).toEqual([0, 0, 0, 7, 1, 5, 6, 12]);
    expect(unpackNotes(pack(notes))).toEqual([[0, 0], [0, 7], [1, 12], [7, 24]]);
    expect(pitchName(0)).toBe("C4");
    expect(pitchName(13)).toBe("C#5");
    expect(pitchName(24)).toBe("C6");
  });
  it("gives a hint for an empty or one-note strip, never a print", () => {
    expect(notesProblem([])).toMatch(/two notes/);
    expect(notesProblem([[0, 5]])).toMatch(/two notes/);
    expect(notesProblem([[0, 5], [0, 9]])).toMatch(/two notes/);
    expect(notesProblem([[0, 5], [1, 9]])).toBeNull();
    for (const ns of [[], [[0, 5]], [[0, 5], [0, 9]]] as Note[][]) expect(ok({ m: packInts(packNotes(ns)) || "AA" })).toBeNull();
  });
  it("rejects wrong types, ranges, unknown values, non-canonical forms and over-limit inputs", () => {
    const bad: unknown[] = [
      {},
      { m: 12 },
      { m: "" },
      { m: "!!" },
      { m: [0, 0, 1, 2] },
      { m: packInts([0, 0, 1]) },
      { m: packInts([1, 0, 1, 2]) },
      { m: packInts([0, 5, 0, -2, 1, 0]) },
      { m: packInts([0, 5, 0, 0, 1, 0]) },
      { m: packInts([0, 5, -1, 0, 2, 0]) },
      { m: packInts([0, -1, 1, 3]) },
      { m: packInts([0, PITCHES, 1, -1]) },
      { m: packInts([0, 0, STEPS, 1]) },
      { m: packInts(packNotes(Array.from({ length: NOTES_MAX + 1 }, (_, i) => [i % STEPS, Math.floor(i / STEPS)] as Note).sort((a, b) => a[0] - b[0] || a[1] - b[1]))) },
      { m: `${ex.m}A` },
      { m: ex.m, w: "" },
      { m: ex.m, w: " Our song" },
      { m: ex.m, w: "x".repeat(29) },
      { m: ex.m, w: 7 },
    ];
    for (const p of bad) expect(ok(p), JSON.stringify(p)).toBeNull();
    // An over-long varint spells a valid list the non-canonical way.
    expect(ok({ m: btoa(String.fromCharCode(0x80, 0, 0, 2, 0)).replace(/=+$/, "") })).toBeNull();
  });
  it("refuses a brand in the title through the lexicon (the editor's check)", () => {
    expect(wordsProblem("N1KE")).not.toBeNull();
    expect(wordsProblem("Twinkle, twinkle")).toBeNull();
  });
});

describe("Your Music Box: the template", () => {
  it("is deterministic, and writes only what the canvas draws", () => {
    const spec = ok(ex)!;
    const svg = render(spec, "black");
    expect(svg).toBe(render(spec, "black"));
    expect(svg).not.toMatch(FORBIDDEN);
    expect(svg).not.toMatch(/transform=/);
    expect(svg).not.toMatch(/<(?!\/?(svg|rect|circle|line|path|text|g)\b)[a-z]/);
  });
  it("the example passes the gate on both tees", () => {
    const spec = ok(ex)!;
    for (const c of ["black", "white"] as const) expect(gate(render(spec, c), c)).toBeNull();
  });
  it("the longest link fits", () => {
    // 64 notes as far apart as the steps allow, each leap the widest: the most bytes a strip can take.
    const notes = Array.from({ length: NOTES_MAX }, (_, i) => [i, i % 2 ? 24 : 0] as Note);
    const len = encodeMake(ok({ m: pack(notes), w: "W".repeat(28) })!).length;
    console.log(`musicbox: longest ?make= is ${len} characters`);
    expect(len).toBeLessThan(400);
  });
  it("two notes to sixty-four, any pitches, chords and rests: all pass the gate", () => {
    const rnd = mulberry32(0x3b0c5);
    const all = (f: (i: number) => Note, n: number) => Array.from({ length: n }, (_, i) => f(i));
    const edges: Note[][] = [
      [[0, 0], [1, 0]],
      [[0, 0], [1, 24]],
      [[0, 12], [63, 12]],
      [[0, 0], [63, 24]],
      all((i) => [i, 12], 64),
      all((i) => [i, i % 25], 64),
      all((i) => [i, 24 - (i % 25)], 64),
      all((i) => [i, i % 2 ? 24 : 0], 64),
      all((i) => [i >> 1, (i % 2) * 12], 64),
      [...all((i) => [0, i], 25), ...all((i) => [1, i], 25), ...all((i) => [2, i], 14)],
      [...all((i) => [0, i], 25), ...all((i) => [63, i], 25), ...all((i) => [31, i], 14)],
      all((i) => [Math.floor(i / 8) * 8, i % 8], 64),
      all((i) => [Math.floor(i / 2) * 2, i % 2 ? 24 : 23], 64),
    ];
    const raws: Record<string, unknown>[] = edges.map((ns, i) => ({ m: pack(ns), ...(i % 3 === 0 ? { w: "W".repeat(28) } : i % 3 === 1 ? { w: "A" } : {}) }));
    for (let i = 0; i < 150; i++) {
      const count = 2 + Math.floor(rnd() ** 1.5 * (NOTES_MAX - 1));
      const span = 2 + Math.floor(rnd() * (STEPS - 1));
      const chordy = rnd();
      const ns: Note[] = [];
      let pitch = Math.floor(rnd() * PITCHES);
      for (let k = 0; k < count; k++) {
        pitch = Math.max(0, Math.min(24, pitch + Math.round((rnd() - 0.5) * 8)));
        ns.push([rnd() < chordy * 0.4 && ns.length ? ns[ns.length - 1][0] : Math.floor(rnd() * span), pitch]);
      }
      const tidy = tidyNotes(ns);
      if (notesProblem(tidy)) continue;
      raws.push({ m: pack(tidy), ...(rnd() < 0.3 ? { w: "Our song" } : {}) });
    }
    const failures: string[] = [];
    raws.forEach((raw, i) => {
      const spec = ok(raw) as CustomSpec;
      expect(spec, JSON.stringify(raw)).not.toBeNull();
      const colors: ("black" | "white")[] = i % 4 ? ["black"] : ["black", "white"];
      for (const c of colors) {
        const svg = render(spec, c);
        expect(svg).not.toMatch(FORBIDDEN);
        const bad = gate(svg, c);
        if (bad) failures.push(`${JSON.stringify(raw)} ${c}: ${bad}`);
      }
    });
    console.log(`musicbox: ${raws.length} strips through the gate`);
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
