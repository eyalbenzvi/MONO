import { describe, expect, it } from "vitest";
import { encodeMoves, fromSan, legalMoves, play, readPgn, startPosition, toSan, type Move, type Position } from "@/lib/custom/draw/chess";
import { render, replay } from "@/lib/custom/templates/chess";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { packInts } from "@/lib/custom/specKit";
import { CHESS_MAX_PLIES, PLAYER_MAX, PRODUCT, check } from "@/lib/custom/specs/chess";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const spec = (p: Record<string, unknown>) => validate({ t: "chess", v: 1, p });
const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;
const game = (pgn: string) => {
  const r = readPgn(pgn, CHESS_MAX_PLIES);
  if (!("game" in r)) throw new Error(r.error);
  return r.game;
};
/** A seeded random legal game (random games wander: the densest journeys), underpromotions included. */
function randomGame(seed: number, plies: number): Move[] {
  const rnd = mulberry32(seed);
  let pos: Position = startPosition();
  const out: Move[] = [];
  for (let i = 0; i < plies; i++) {
    const ms = legalMoves(pos);
    if (!ms.length) break;
    const m = ms[Math.floor(rnd() * ms.length)];
    out.push(m);
    pos = play(pos, m);
  }
  return out;
}
const toParams = (moves: Move[]) => {
  const under = moves.flatMap((m, i) => (m.promo && m.promo !== "q" ? [i, { n: 1, b: 2, r: 3 }[m.promo]] : []));
  return { m: encodeMoves(moves), ...(under.length ? { u: packInts(under) } : {}) };
};

describe("Your Game: reading a PGN", () => {
  it("reads headers, and strips comments, variations (nested), NAGs, annotations and move numbers", () => {
    const g = game(`[Event "Club"]\n[White "Noa Levi"]\n[Black "Dad"]\n[Date "2023.05.14"]\n[Result "0-1"]\n\n1. e4 {best by test} e5 2.Nf3 (2. f4 exf4 (2... d5) 3. Nf3) 2... Nc6 $1 3. Bb5!? a6 ; the Morphy\n4. Ba4 Nf6 0-1`);
    expect(g.moves.length).toBe(8);
    expect(g).toMatchObject({ white: "Noa Levi", black: "Dad", date: "2023-05-14", result: "0-1", cut: false });
    expect(game("[Date \"1858.??.??\"]\n1. e4 *").date).toBeUndefined();
  });
  it("castles both ways (O and 0), takes en passant, promotes and underpromotes, marks check and mate", () => {
    const g = game("1. e4 d5 2. e5 f5 3. exf6 Nh6 4. fxg7 Be6 5. gxh8=N Nc6 6. d4 Qd6 7. Bxh6 O-O-O 8. Nc3 a6 9. Qd2 a5 10. 0-0-0 b6");
    let pos = startPosition();
    const sans = g.moves.map((m) => {
      const s = toSan(pos, m);
      pos = play(pos, m);
      return s;
    });
    expect(sans).toEqual(["e4", "d5", "e5", "f5", "exf6", "Nh6", "fxg7", "Be6", "gxh8=N", "Nc6", "d4", "Qd6", "Bxh6", "O-O-O", "Nc3", "a6", "Qd2", "a5", "O-O-O", "b6"]);
    const mate = game("1. f3 e5 2. g4 Qh4#");
    let p2 = startPosition();
    const s2 = mate.moves.map((m) => {
      const s = toSan(p2, m);
      p2 = play(p2, m);
      return s;
    });
    expect(s2[3]).toBe("Qh4#");
  });
  it("disambiguates and refuses what isn't legal or is ambiguous", () => {
    let pos = startPosition();
    for (const t of ["Nf3", "Nf6", "Nc3", "Nc6", "Nd4", "Nd5"]) pos = play(pos, fromSan(pos, t)!);
    // Two white knights can reach b5 (c3 and d4).
    expect(fromSan(pos, "Nb5")).toBeNull();
    expect(fromSan(pos, "Ncb5")).not.toBeNull();
    expect(fromSan(pos, "Ndb5")).not.toBeNull();
    expect(toSan(pos, fromSan(pos, "Ncb5")!)).toBe("Ncb5");
    expect(readPgn("1. e4 e5 2. Ke3", 120)).toEqual({ error: "Move 2: Ke3 isn't legal there." });
    expect(readPgn("1. e4 e5 2. Nf3 Ke7 3. O-O", 120)).toEqual({ error: "Move 3: O-O isn't legal there." });
    expect(readPgn("hello", 120)).toMatchObject({ error: expect.any(String) });
    expect(readPgn("", 120)).toMatchObject({ error: expect.any(String) });
    expect(readPgn('[SetUp "1"]\n[FEN "8/8/8/8/8/8/8/K6k w - - 0 1"]\n1. Kb1', 120)).toEqual({ error: "Only games from the usual starting position." });
  });
  it("keeps the first 120 plies", () => {
    const long = Array.from({ length: 70 }, () => "Nf3 Nf6 Ng1 Ng8").join(" ");
    const g = game(long);
    expect(g.moves.length).toBe(CHESS_MAX_PLIES);
    expect(g.cut).toBe(true);
  });
});

describe("Your Game: the spec", () => {
  it("accepts the example (which replays whole: the Opera Game's 33 plies) and drops unknown keys", () => {
    expect(check(PRODUCT.example as unknown as Record<string, unknown>, {})).toEqual(PRODUCT.example);
    expect(replay(PRODUCT.example).moves.length).toBe(33);
    expect(spec({ ...PRODUCT.example, z: 1 })!.p).toEqual(PRODUCT.example);
    expect(JSON.stringify(spec({ r: "1-0", d: "2020-01-01", b: "B", a: "A", m: "Mc" })!.p)).toBe('{"m":"Mc","a":"A","b":"B","d":"2020-01-01","r":"1-0"}');
  });
  it("refuses bad moves, promotions, names, days and results", () => {
    for (const p of [
      {},
      { m: "" },
      { m: "M" },
      { m: "Mc0" },
      { m: "MM" },
      { m: "M+" },
      { m: 5 },
      { m: "Mc".repeat(CHESS_MAX_PLIES + 1) },
      { m: "Mc", u: "" },
      { m: "Mc", u: packInts([0]) },
      { m: "Mc", u: packInts([1, 1]) },
      { m: "McMc", u: packInts([0, 4]) },
      { m: "McMc", u: packInts([1, 1, 0, 2]) },
      { m: "McMc", u: packInts([0, 1, 0, 2]) },
      { m: "Mc", u: "AAAA" },
      { m: "Mc", a: "" },
      { m: "Mc", a: " A" },
      { m: "Mc", a: "x".repeat(PLAYER_MAX + 1) },
      { m: "Mc", b: 5 },
      { m: "Mc", d: "2021-02-30" },
      { m: "Mc", d: "1858" },
      { m: "Mc", r: "1/2-1/2" },
      { m: "Mc", r: "draw" },
    ])
      expect(spec(p), JSON.stringify(p)).toBeNull();
    expect(spec({ m: "McMc", u: packInts([0, 1, 1, 3]) })).not.toBeNull();
  });
  it("the longest link fits", () => {
    const moves = randomGame(1, CHESS_MAX_PLIES);
    const s = spec({ m: encodeMoves(moves), u: packInts([0, 1, 1, 2, 2, 3, 3, 1, 4, 2, 5, 3]), a: "W".repeat(PLAYER_MAX), b: "B".repeat(PLAYER_MAX), d: "2024-02-29", r: "1/2" })!;
    const n = encodeMake(s).length;
    expect(n).toBeLessThan(600);
    console.log(`chess: longest ?make= ${n} characters`);
  });
});

describe("Your Game: the template", () => {
  it("is deterministic and draws only what the preview can", () => {
    const s = spec(PRODUCT.example as unknown as Record<string, unknown>)!;
    const a = render(s, "black");
    expect(a).toBe(render(s, "black"));
    expect(a).not.toMatch(FORBIDDEN);
    expect(a).not.toMatch(/<(?!g\b)[a-z]+ [^>]*transform=/);
  });
  it("replays underpromotions, and stops at the first move that isn't legal", () => {
    const g = game("1. e4 d5 2. e5 f5 3. exf6 Nh6 4. fxg7 Be6 5. gxh8=N");
    const r = replay(toParams(g.moves) as never);
    expect(r.final.board[63]).toBe("N");
    // e2-e4, then a1-a8 (a rook through its own pawn): replay stops after one ply.
    expect(replay({ m: "Mc" + "A4" } as never).moves.length).toBe(1);
  });
  it("the example passes the gate in both colours", () => {
    const s = spec(PRODUCT.example as unknown as Record<string, unknown>)!;
    for (const color of ["black", "white"] as const) expect(gate(render(s, color), color)).toBeNull();
  });
  it("games of every length (random, so the densest journeys), with and without names: all pass the gate", () => {
    const rnd = mulberry32(0xc4e55);
    const cases: Record<string, unknown>[] = [
      { m: "Mc" },
      { m: "Mc", a: "W", b: "B" },
      { ...toParams(randomGame(3, CHESS_MAX_PLIES)), a: "W".repeat(PLAYER_MAX), b: "B".repeat(PLAYER_MAX), d: "2024-02-29", r: "1/2" },
      toParams(game(Array.from({ length: 30 }, () => "Nf3 Nf6 Ng1 Ng8").join(" ")).moves),
      toParams(game("1. f3 e5 2. g4 Qh4#").moves),
    ];
    for (let i = 0; i < 60; i++) {
      const plies = 1 + Math.floor(rnd() ** 0.6 * CHESS_MAX_PLIES);
      cases.push({ ...toParams(randomGame(1000 + i, plies)), ...(i % 3 === 0 ? { a: "Noa Levi", b: "Dad", r: "1-0" } : {}), ...(i % 4 === 1 ? { d: "1999-12-31" } : {}) });
    }
    const failures: string[] = [];
    cases.forEach((p, i) => {
      const s = spec(p) as CustomSpec;
      expect(s, JSON.stringify(p)).not.toBeNull();
      const colors: ("black" | "white")[] = i % 4 ? ["black"] : ["black", "white"];
      for (const color of colors) {
        const bad = gate(render(s, color), color);
        if (bad) failures.push(`${JSON.stringify(p)} ${color}: ${bad}`);
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
