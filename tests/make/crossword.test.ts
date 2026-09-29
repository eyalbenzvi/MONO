import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/crossword";
import { buildCrossword } from "@/lib/custom/draw/crossword";
import { PRODUCT, check, crossWordProblem } from "@/lib/custom/specs/crossword";
import { encodeMake, decodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const spec = (p: unknown) => validate({ t: "crossword", v: 1, p });
const ex: CustomSpec = { t: "crossword", v: 1, p: PRODUCT.example };

describe("Your Crossword: the spec", () => {
  it("accepts the example and keeps its keys in order", () => {
    expect(spec(PRODUCT.example)).toEqual(ex);
    expect(JSON.stringify(check({ w: "Us", h: 1, x: "ANA BEN CAL DOV" }, {}))).toBe('{"x":"ANA BEN CAL DOV","h":1,"w":"Us"}');
  });
  it("drops unknown keys", () => {
    expect(spec({ ...PRODUCT.example, z: 1, t: "x" })).toEqual(ex);
  });
  it("rejects wrong types, ranges, spellings and limits", () => {
    const x = "ANA BEN CAL DOV";
    for (const p of [
      {},
      { x: ["ANA", "BEN", "CAL", "DOV"] },
      { x: "ANA BEN CAL" },
      { x: Array.from({ length: 13 }, (_, i) => "NAME" + "ABCDEFGHIJKLM"[i]).join(" ") },
      { x: "ana BEN CAL DOV" },
      { x: "AN BEN CAL DOV" },
      { x: "ABCDEFGHIJKLM BEN CAL DOV" },
      { x: "ZOË BEN CAL DOV" },
      { x: "ANA  BEN CAL DOV" },
      { x: " ANA BEN CAL DOV" },
      { x: "ANA BEN CAL DOV " },
      { x: "ANA,BEN,CAL,DOV" },
      { x: "ANA ANA CAL DOV" },
      { x: 1 },
      { x, h: 0 },
      { x, h: true },
      { x, w: "" },
      { x, w: " Us" },
      { x, w: "x".repeat(29) },
      { x, w: 5 },
    ])
      expect(spec(p), JSON.stringify(p)).toBeNull();
  });
  it("says what's wrong with a name in one line", () => {
    expect(crossWordProblem("Zoë")).toBe('Letters A to Z only. Try "E".');
    expect(crossWordProblem("Al")).toBe("3 to 12 letters");
    expect(crossWordProblem("Noa")).toBeNull();
  });
  it("fits the largest spec in a link", () => {
    const big = spec({ x: Array.from({ length: 12 }, (_, i) => "ABCDEFGHIJKL".slice(i) + "MNOPQRSTUVWX".slice(0, i)).join(" "), h: 1, w: "The Levins and the Cohens, x" })!;
    expect(big).not.toBeNull();
    const link = encodeMake(big);
    expect(decodeMake(link)).toEqual(big);
    // 12 names of 12 letters, blank, a 28-character title: 310 characters (the ceiling is 1,200).
    expect(link.length).toBeLessThanOrEqual(310);
  });
});

describe("Your Crossword: the builder", () => {
  it("crosses every word it can, and never runs two words side by side", () => {
    const cw = buildCrossword(["MIRIAM", "DAVID", "NOA", "ELLA", "JONATHAN", "RUTH"]);
    expect(cw.islands).toEqual([]);
    const grid = new Map<string, string>();
    for (const p of cw.placed)
      for (let i = 0; i < p.word.length; i++) {
        const k = p.across ? `${p.r},${p.c + i}` : `${p.r + i},${p.c}`;
        if (grid.has(k)) expect(grid.get(k)).toBe(p.word[i]);
        grid.set(k, p.word[i]);
      }
    // Every run of two or more letters, across and down, is one of the words.
    const runs: string[] = [];
    for (const across of [true, false])
      for (let a = 0; a < (across ? cw.rows : cw.cols); a++) {
        let run = "";
        for (let b = 0; b <= (across ? cw.cols : cw.rows); b++) {
          const ch = grid.get(across ? `${a},${b}` : `${b},${a}`);
          if (ch) run += ch;
          else (run.length > 1 && runs.push(run), (run = ""));
        }
      }
    expect(runs.sort()).toEqual(["DAVID", "ELLA", "JONATHAN", "MIRIAM", "NOA", "RUTH"].sort());
  });
  it("puts a word with no letter in common on its own", () => {
    expect(buildCrossword(["ANNA", "NOAH", "XYZ", "HANNAH"]).islands).toEqual(["XYZ"]);
  });
});

describe("Your Crossword: the template", () => {
  it("is deterministic", () => {
    expect(render(ex, "black")).toBe(render(ex, "black"));
  });
  it("writes only what the canvas preview draws", () => {
    for (const p of [PRODUCT.example, { ...PRODUCT.example, h: 1 }]) expect(render(spec(p)!, "white")).not.toMatch(/clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/);
  });
  it("the example passes the gate on both tees", () => {
    for (const color of ["black", "white"] as const) expect(gate(render(ex, color), color)).toBeNull();
  });
  it("few to many names, short to long, filled or blank: all pass the gate", () => {
    const rnd = mulberry32(0xc5055);
    const POOL = "NOA ELI ANA BEN MAYA DAVID MIRIAM RUTH ELLA JONATHAN SARAH YOSEF TAMAR ADAM LEAH AVIGAIL ITAMAR SHIRA OMER DANIEL REBECCA MAXIMILIAN CHRISTOPHER ALEXANDRA IVY ZED KAI JUNE OLIVER GRACE".split(" ");
    const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const rand = (n: number) => Array.from({ length: n }, () => L[Math.floor(rnd() * 26)]).join("");
    const sets: string[][] = [
      ["NOA", "ANA", "ELI", "LEA"],
      ["XXX", "QQQ", "ZZZ", "JJJ"],
      ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH", "III", "JJJ", "KKK", "LLL"],
      ["ABCDEFGHIJKL", "MNOPQRSTUVWX", "AAAAAAAAAAAA", "EEEEEEEEEEEE", "IIIIIIIIIIII", "OOOOOOOOOOOO", "UUUUUUUUUUUU", "YYYYYYYYYYYY", "ANNABELLAROS", "CHRISTOPHERS", "MAXIMILIANUS", "ELIZABETHANN"],
      ["MAXIMILIANUS", "CHRISTOPHERS", "ALEXANDRIANA", "BARTHOLOMEWS"],
      POOL.slice(0, 12),
    ];
    for (let i = 0; i < 60; i++) {
      const n = 4 + Math.floor(rnd() * 9);
      const set = new Set<string>();
      while (set.size < n) set.add(rnd() < 0.7 ? POOL[Math.floor(rnd() * POOL.length)] : rand(3 + Math.floor(rnd() * 10)));
      sets.push([...set]);
    }
    const failures: string[] = [];
    sets.forEach((x, i) => {
      for (const h of [0, 1]) {
        const s = spec({ x: x.join(" "), ...(h ? { h: 1 } : {}), ...(i % 3 === 0 ? { w: i % 2 ? "The Levins and the Cohens, x" : "Us" } : {}) });
        expect(s, JSON.stringify(x)).not.toBeNull();
        const colors: ("black" | "white")[] = (i + h) % 3 ? ["black"] : ["black", "white"];
        for (const color of colors) {
          const bad = gate(render(s!, color), color);
          if (bad) failures.push(`${JSON.stringify(s!.p)} ${color}: ${bad}`);
        }
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
