/**
 * Every input of every Make product changes the print. For each product in
 * MADE, its example (and each other mode it has: a boarding pass beside the
 * departures board, a street sign beside the warning), every parameter in
 * turn is changed to another valid value (the spec's own validation says
 * which), the print drawn again, and the two compared as printed (resvg,
 * pixels, not the SVG's text: a changed id or comment is no change).
 * A parameter that legitimately draws nothing different is listed in SAME
 * with its reason. Then two quite different realistic inputs must give
 * visibly different prints, the drawing itself where the input drives it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { MADE } from "@/lib/custom/products";
import { ASCII_ROWS, asciiPack, canonical, validate, type AsciiCols, type CustomSpec } from "@/lib/custom/spec";
import { packInts, packPlaces } from "@/lib/custom/specKit";
import { LANDMARK_IDS } from "@/lib/custom/specs/landmarks";
import { packNotes } from "@/lib/custom/specs/musicbox";
import { packDays } from "@/lib/custom/specs/orbits";
import { svgInk } from "../scripts/gen/quality";
import { drawSpec, places } from "./make/render";

type P = Record<string, unknown>;
type Path = (string | number)[];
const ROOT = path.resolve(__dirname, "..");
const read = (f: string) => {
  try {
    return readFileSync(path.join(ROOT, f), "utf8");
  } catch {
    return "";
  }
};
const cityById = (id: number) => places.byId(id);
const spec = (t: string, p: P) => validate({ t, v: 1, p }, cityById);
const pOf = (s: CustomSpec) => s.p as unknown as P;

/* ---------- The products' other modes, and the optional inputs their examples leave out ---------- */

const sq = (s: string) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[(Number(s[1]) - 1) * 8 + s.charCodeAt(0) - 97];
const moves = (...m: string[]) => m.map((x) => sq(x.slice(0, 2)) + sq(x.slice(2))).join("");
/** A game that promotes on its ninth ply (b7 takes a8): the promotion piece (`u`) has something to change. */
const PROMOTES = moves("a2a4", "b7b5", "a4b5", "a7a6", "b5a6", "c8b7", "a6b7", "b8c6", "b7a8");
/** An ASCII picture: a gradient with a bright disc, `c` characters wide. */
const picture = (c: AsciiCols) => asciiPack(Array.from({ length: c * ASCII_ROWS[c] }, (_, i) => (Math.hypot((i % c) - c * 0.62, Math.floor(i / c) - ASCII_ROWS[c] / 2) < c / 5 ? 7 : Math.min(7, Math.floor(((i % c) / c) * 8)))));
const LONDON = 2643743, PARIS = 2988507, TEL_AVIV = 293397, NEW_YORK = 5128581, TOKYO = 1850147;

/** Each product's other bases: the other modes (a mode's own inputs are changed there), and the example with its optional inputs added. */
const VARIANTS: Record<string, P[]> = {
  moon: [{ d: "2021-11-19", s: 1 }],
  year: [{ y: 2020, s: 1 }],
  code: [{ x: "NOA", k: "card", h: 1 }],
  ascii: [{ x: ["NOA", "LEVI"], f: "phrase", p: "for noa" }, { x: [], c: 32, g: picture(32) }],
  line: [{ s: "AKZYTzQlNhc0CzQGJAwkEjQmWFA", n: 12, m: 1 }],
  number: [{ v: "1:52:07", u: "", l: "Half marathon", face: "stopwatch" }],
  place: [{ la: 48.86, lo: 2.35, d: "2001-07-14" }],
  tartan: [{ n: "Mackenzie", t: "K8W2D12L4" }],
  dinosaur: [{ n: "Maya", k: "triceratops", e: "saurus", s: "velox", y: 2019, h: 112, d: "pasta" }],
  birth: [{ h: "boy", n: "Dan", d: "2020-02-29", t: "23:50", u: "i", wt: 120, ln: 200, c: LONDON }],
  chess: [{ m: PROMOTES, u: packInts([8, 1]), a: "Noa", b: "Dan", d: "2024-05-01", r: "1-0" }],
  flights: [{ k: "pass", n: "Noa Cohen", f: "TLV", t: "JFK", d: "2019-06-02", s: "14A", g: "B22" }],
  sayings: [{ k: "first", n: "Noa", o: "Cat", d: "2021-05-01" }],
  sign: [
    { s: "street", n: "Maya Lane", l: "Est. 1990" },
    { s: "plaque", n: "Maya Cohen lived here", x: ["Maya Cohen", "Reader, cook", "Since 1990"] },
  ],
  signpost: [{ k: "since", h: TEL_AVIV, x: packPlaces([{ c: LONDON }]), y: 2010 }],
  receipt: [
    { k: "terms", h: "Noa & Dan", x: ["Whoever cooks does not wash up.", "The thermostat is a shared resource.", "Both parties are right. Occasionally."], d: "2016-08-14" },
    { k: "review", n: 4, q: "Arrived late but has been worth it since.", by: "Dan", y: 2016 },
  ],
  route: [{ r: pOf(MADE.find((m) => m.slug === "route")!.example).r as string, w: "Drawn by hand" }],
  orbits: [{ n: ["Miriam", "David", "Ruth"], b: packDays(["1948-03-14", "1951-11-02", "1976-06-21"]), s: 1 }],
  lineup: [{ f: "5", t: "Sunday FC", x: [["Dad", 1], ["Ari", 2], ["Tom", 5], ["Ben", 6], ["Noa", 7]], me: 3 }],
};

/**
 * Inputs whose change must be made by hand (the generic changes below can't reach a valid one): a new value, or a
 * function of the params. Keyed "<slug>.<key>".
 */
const CHANGE: Record<string, (p: P) => P> = {
  // The span's ends move with the years' marks.
  "rings.b": (p) => ({ ...p, b: (p.b as number) + 3, m: (p.m as string).slice(3) }),
  "rings.c": (p) => ({ ...p, c: (p.c as number) - 3, m: (p.m as string).slice(0, -3) }),
  // Home's places, and the other of the two.
  "signpost.x": (p) => ({ ...p, x: packPlaces(p.k ? [{ c: PARIS }] : [{ c: LONDON }, { c: PARIS }, { c: TOKYO }]) }),
  "tour.x": (p) => ({ ...p, x: packPlaces([{ c: PARIS, y: 2011 }, { c: TOKYO, y: 2014 }, { c: NEW_YORK, y: 2016 }, { c: LONDON, y: 2019 }, { c: TEL_AVIV, y: 2022 }]) }),
  // Another birthday for someone who isn't the sun, then the sun's own (it's marked on the dial).
  // Another fill (a phrase's own words go with it); a picture's other width (its tones with it); metric for imperial.
  "ascii.f": (p) => ({ ...p, f: p.f === "#" ? "@" : "#", p: undefined }),
  "ascii.c": (p) => ({ ...p, c: 40, g: picture(40) }),
  "birth.u": (p) => (p.u ? { ...p, u: undefined, wt: 3400, ln: 510 } : { ...p, u: "i", wt: 120, ln: 200 }),
  "orbits.b": (p) => ({ ...p, b: packDays(["1948-08-30", "1951-11-02", "1976-06-21", "1979-01-30", "2008-09-05", "2012-04-17"].slice(0, (p.n as string[]).length)) }),
};

/** Parameters that draw nothing different, and why (each one's product and key). */
const SAME: Record<string, string | [why: string, when: (p: P) => boolean]> = {
  // A mode switch alone makes no valid spec: each mode is a base of its own above, its inputs changed there.
  "flights.k": "the mode: the pass and the board are both bases here",
  "sign.s": "the style: each style is a base here",
  "receipt.k": "the kind: each kind is a base here",
  "sayings.k": "the mode: first words is a base here",
  "signpost.k": "the mode: since is a base here",
  "number.face": "the face: the stopwatch is a base here (it takes a time, the dial a number)",
  "number.u": ["a time has no unit: the editor writes none, and the stopwatch shows h:mm:ss", (p) => typeof p.v === "string"],
};
const same = (slug: string, key: string, p: P) => {
  const s = SAME[`${slug}.${key}`];
  return typeof s === "string" || (!!s && s[1](p));
};

/* ---------- Changing a value ---------- */

const drawSrc = readdirSync(path.join(ROOT, "lib/custom/draw")).map((f) => read(`lib/custom/draw/${f}`)).join("\n");
const words = (s: string) => [...new Set([...s.matchAll(/["']([A-Za-z0-9][A-Za-z0-9 _-]{0,20})["']/g)].map((m) => m[1]))];
/** The strings a product's own modules name (its options: plates, styles, emblems…), and every landmark's id. */
const poolFor = (t: string) => [...words(read(`lib/custom/specs/${t}.ts`) + read(`lib/custom/templates/${t}.ts`) + drawSrc), ...LANDMARK_IDS];
const CITIES = [LONDON, TEL_AVIV, PARIS, NEW_YORK, TOKYO];
const NAMES = ["Tamar Katz", "Dan", "Ruth", "Hello there", "JOSEPH", "ZQX", "BK"];
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const shift = (d: string, days: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};
/** Other values for one, most different first: another date, time, name, word or option, another number in range, another character of a packed string. */
function others(v: unknown, pool: string[]): unknown[] {
  if (typeof v === "string") {
    if (/^\d{4}-\d\d-\d\d$/.test(v)) return [200, 40, -40, 1100, -1100, 9, -9].map((d) => shift(v, d));
    if (/^\d\d:\d\d$/.test(v)) return ["03:15", "12:00", "18:47"];
    const out: unknown[] = [...NAMES, v.split("").reverse().join("")];
    for (const i of [0, Math.floor(v.length / 2), v.length - 1]) for (const c of B64) out.push(v.slice(0, i) + c + v.slice(i + 1));
    return [...out, ...pool];
  }
  if (typeof v === "number") return [...(v === 1 ? [undefined] : []), ...[v + 10, v - 10, v + 7, v - 7, v + 3, v - 3, v + 1, v - 1, v + 0.5, v + 0.1, v - 0.1, v + 0.01, v + 0.001, v * 2, Math.round(v / 2), ...CITIES, ...Array.from({ length: 13 }, (_, i) => i)].map((x) => Math.round(x * 1000) / 1000)];
  return [];
}
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const at = (o: unknown, p: Path) => p.reduce<unknown>((a, k) => (a as Record<string | number, unknown>)?.[k], o);
function put(o: P, p: Path, val: unknown): P {
  const q = clone(o);
  let a = q as Record<string | number, unknown>;
  for (const k of p.slice(0, -1)) a = a[k] as Record<string | number, unknown>;
  const last = p[p.length - 1];
  if (val === undefined) delete a[last];
  else a[last] = val;
  return q;
}
/** Every value a spec holds: each key, and in a list its first and last entries (each field of an entry). */
function leaves(v: unknown, p: Path, out: Path[]) {
  if (Array.isArray(v)) {
    if (v.length)
      for (const i of new Set([0, v.length - 1])) leaves(v[i], [...p, i], out);
  } else if (v && typeof v === "object") {
    for (const k of Object.keys(v)) if (k !== "cap") leaves((v as P)[k], [...p, k], out);
  } else if (p.length) out.push(p);
}
/** The first other value of one that makes a valid spec, not the same one. */
function change(base: CustomSpec, p: Path): CustomSpec | null {
  const hand = CHANGE[`${slugOf(base)}.${p[0]}`];
  if (hand && p.length === 1) return spec(base.t, hand(pOf(base)));
  for (const v of others(at(base.p, p), poolFor(base.t))) {
    const s = spec(base.t, put(pOf(base), p, v));
    if (s && canonical(s) !== canonical(base)) return s;
  }
  return null;
}
const slugOf = (s: CustomSpec) => MADE.find((m) => m.template === s.t)!.slug;

/* ---------- Comparing prints ---------- */

const W = 300;
/** How many pixels two prints differ by, as printed (black tee, W wide). */
function differ(a: string, b: string): number {
  const x = svgInk(a, "black", W), y = svgInk(b, "black", W);
  if (x.h !== y.h) return x.ink.length;
  let n = 0;
  for (let i = 0; i < x.ink.length; i++) if (Math.abs(x.ink[i] - y.ink[i]) > 0.25) n++;
  return n;
}
/** A print without its words: the drawing alone. */
const drawing = (svg: string) => svg.replace(/<text[\s\S]*?<\/text>/g, "").replace(/<g transform="rotate\([^"]*\)"><\/g>/g, "");
/** Visibly different: one digit of a year in the caption changes about ten pixels at this size. */
const VISIBLE = 6;

describe("Make: every input changes the print", () => {
  for (const m of MADE) {
    it(`${m.name} (${m.slug})`, async () => {
      const bases = [pOf(m.example), ...(VARIANTS[m.slug] ?? [])].map((p) => {
        const s = spec(m.template, p);
        expect(s, `${m.slug} base ${JSON.stringify(p)}`).not.toBeNull();
        return s!;
      });
      const failures: string[] = [];
      const covered = new Set<string>();
      for (const base of bases) {
        const a = await drawSpec(base, "black");
        const paths: Path[] = [];
        leaves(base.p, [], paths);
        // A list's whole entries too (one fewer): the count is an input.
        for (const [k, v] of Object.entries(base.p)) if (Array.isArray(v) && v.length > 1) paths.push([k, "−"]);
        for (const p of paths) {
          const key = `${m.slug}.${p[0]}`;
          if (same(m.slug, p[0] as string, pOf(base))) continue;
          let changed: CustomSpec | null;
          if (p[1] === "−") {
            const list = pOf(base)[p[0] as string] as unknown[];
            changed = spec(base.t, { ...pOf(base), [p[0]]: list.slice(0, -1) });
            // At its fewest already (a family's seven places, a metro's lines): the entries' own changes cover it.
            if (!changed) continue;
          } else changed = change(base, p);
          covered.add(key);
          if (!changed) {
            failures.push(`${key} (${p.join(".")}): no other valid value`);
            continue;
          }
          const b = await drawSpec(changed, "black");
          const n = a === b ? 0 : differ(a, b);
          if (n < VISIBLE) failures.push(`${p.join(".")}: ${JSON.stringify(at(base.p, p))} → ${JSON.stringify(at(changed.p, p))} changes ${n} pixels`);
        }
      }
      for (const k of Object.keys(SAME)) if (k.startsWith(`${m.slug}.`)) expect(bases.some((b) => (k.split(".")[1] in pOf(b))), `${k} is listed but not an input`).toBe(true);
      expect(failures).toEqual([]);
      expect(covered.size).toBeGreaterThan(0);
    }, 120_000);
  }
});

/**
 * Two realistic, quite different inputs for each product's main input: the
 * prints differ visibly, and where the input drives the drawing (a crystal
 * grown from a name, a maze, a sky) the drawing itself differs, words aside.
 */
const PAIRS: { slug: string; a: P; b: P; drawing?: true }[] = [
  { slug: "sky", a: { c: LONDON, d: "2016-08-12", t: "23:30" }, b: { c: TEL_AVIV, d: "1990-01-03", t: "21:00" }, drawing: true },
  { slug: "moon", a: { d: "2021-11-19" }, b: { d: "2021-11-30" }, drawing: true },
  { slug: "planets", a: { d: "2012-06-06" }, b: { d: "1987-01-20" }, drawing: true },
  { slug: "year", a: { y: 2020 }, b: { y: 1987 }, drawing: true },
  { slug: "code", a: { x: "NOA", k: "card" }, b: { x: "JONATHAN", k: "card" }, drawing: true },
  { slug: "ascii", a: { x: ["NOA"], f: "self" }, b: { x: ["MAYA"], f: "self" } },
  { slug: "elements", a: { x: "ALICE" }, b: { x: "BENJAMIN" }, drawing: true },
  { slug: "automaton", a: { x: "Maya", r: 30 }, b: { x: "Jonathan", r: 30 }, drawing: true },
  { slug: "maze", a: { x: "NB", d: 2 }, b: { x: "RL", d: 2 }, drawing: true },
  { slug: "tartan", a: { n: "Mackenzie" }, b: { n: "Levi" }, drawing: true },
  { slug: "snowflake", a: { n: "Maya" }, b: { n: "Jonathan" }, drawing: true },
  { slug: "monogram", a: { x: "NDL", s: "seal" }, b: { x: "MK", s: "seal" }, drawing: true },
  { slug: "sampler", a: { n: "Maya", b: "diamonds", mo: ["tree", "heart", "house"] }, b: { n: "Jonathan", b: "diamonds", mo: ["tree", "heart", "house"] }, drawing: true },
  { slug: "julia", a: { d: "2019-05-14" }, b: { d: "1972-10-30" }, drawing: true },
  { slug: "weeks", a: { b: "1990-03-14", a: "2026-09-29", n: 90 }, b: { b: "1961-07-02", a: "2026-09-29", n: 90 }, drawing: true },
  { slug: "rings", a: { b: 2000, c: 2010, m: "11111111111" }, b: { b: 2000, c: 2010, m: "20202020202" }, drawing: true },
  { slug: "dinosaur", a: { n: "Maya", k: "triceratops", h: 112 }, b: { n: "Jonathan", k: "triceratops", h: 150 } },
  { slug: "house", a: { fl: 3, wn: 3, r: "pitched", dr: "c" }, b: { fl: 6, wn: 5, r: "flat", dr: "l" }, drawing: true },
  { slug: "place", a: { la: 32.08, lo: 34.78 }, b: { la: -33.87, lo: 151.21 }, drawing: true },
  { slug: "journey", a: { c: [TEL_AVIV, LONDON] }, b: { c: [TOKYO, NEW_YORK] }, drawing: true },
  { slug: "signpost", a: { h: TEL_AVIV, x: packPlaces([{ c: LONDON }, { c: TOKYO }]) }, b: { h: NEW_YORK, x: packPlaces([{ c: PARIS }, { c: TEL_AVIV }]) }, drawing: true },
  { slug: "countries", a: { x: "AIAAAAAA4ABBBAQAMAIAAAAAAAIAAgAAACAQCAAA" }, b: { x: "AAACQACAAAgAAIAAAAAAAIAMAQABBAAAAAAAAAAA" }, drawing: true },
  { slug: "flights", a: { k: "board", x: [["NRT", 2019]] }, b: { k: "board", x: [["JFK", 2016], ["CDG", 2014], ["LHR", 2011]] }, drawing: true },
  { slug: "passport", a: { n: "Noa Cohen", x: [["JPN", "2019-04-12"]] }, b: { n: "Noa Cohen", x: [["FRA", "2014-07-30"], ["USA", "2016-12-19"]] }, drawing: true },
  { slug: "landmarks", a: { x: [["eiffel", 2009], ["pisa", 2011], ["acropolis", 2013]] }, b: { x: [["colosseum", 2012], ["tajmahal", 2015], ["towerbridge", 2017], ["pisa", 2019]] }, drawing: true },
  { slug: "telegram", a: { to: "Noa", m: "Arrived safely." }, b: { to: "Dan", m: "Home Tuesday. Bring cake. Miss you." } },
  { slug: "label", a: { n: "Maya Cohen", md: "Mixed media, mostly biscuits" }, b: { n: "Dan Levi", md: "Oil on toast" } },
  { slug: "card", a: { n: "Maya Cohen", ti: "Head of Snacks", co: "The Kitchen", s: "classic" }, b: { n: "Dan Levi", ti: "Chief Worrier", co: "Home", s: "classic" } },
  { slug: "frontpage", a: { n: "Noa", h: "Local girl turns ten, takes it well" }, b: { n: "Dan", h: "Man finds keys" } },
  { slug: "family", a: { n: ["Noa Levin", "David Levin", "Ruth Adler", "", "", "", ""] }, b: { n: ["Dan Katz", "Eli Katz", "", "Rosa Stern", "", "", ""] } },
  { slug: "crossword", a: { x: "MIRIAM DAVID NOA ELLA" }, b: { x: "JONATHAN RUTH SAMUEL TAMAR" }, drawing: true },
  { slug: "orbits", a: { n: ["Miriam", "David", "Ruth"], b: packDays(["1948-03-14", "1951-11-02", "1976-06-21"]) }, b: { n: ["Miriam", "David", "Ruth"], b: packDays(["1948-09-14", "1951-04-02", "1976-12-21"]) }, drawing: true },
  { slug: "island", a: { n: "Isle of Levi", x: ["Noa", "Dan"] }, b: { n: "Tamar Rock", x: ["Noa", "Dan"] }, drawing: true },
  { slug: "musicbox", a: { m: packInts(packNotes([[0, 0], [4, 4], [8, 7], [12, 12]])) }, b: { m: packInts(packNotes(Array.from({ length: 16 }, (_, i) => [i * 2, (i * 5) % 25] as [number, number]))) }, drawing: true },
  { slug: "voice", a: { a: 3, b: 2, d: 0.012, ph: 1.2, f: 196 }, b: { a: 5, b: 4, d: 0.006, ph: 0.4, f: 330 }, drawing: true },
  { slug: "number", a: { v: 3.4, u: "kg", face: "dial" }, b: { v: 72, u: "bpm", face: "dial" }, drawing: true },
  { slug: "qr", a: { a: "example.org/for-noa" }, b: { a: "example.org/dan" }, drawing: true },
  { slug: "taste", a: { q: "83227357236269461" }, b: { q: "16496263275372238" }, drawing: true },
];

describe("Make: two different inputs, two different prints", () => {
  for (const pair of PAIRS) {
    it(pair.slug, async () => {
      const m = MADE.find((x) => x.slug === pair.slug)!;
      const [a, b] = [spec(m.template, pair.a), spec(m.template, pair.b)];
      expect(a, JSON.stringify(pair.a)).not.toBeNull();
      expect(b, JSON.stringify(pair.b)).not.toBeNull();
      for (const color of ["black", "white"] as const) {
        const [x, y] = [await drawSpec(a!, color), await drawSpec(b!, color)];
        expect(differ(x, y), `${pair.slug} ${color}`).toBeGreaterThan(200);
        if (pair.drawing) expect(differ(drawing(x), drawing(y)), `${pair.slug} ${color}: the drawing, words aside`).toBeGreaterThan(200);
      }
    });
  }
  it("every product has a pair", () => {
    const missing = MADE.filter((m) => !PAIRS.some((q) => q.slug === m.slug)).map((m) => m.slug);
    // Covered by the sweep above alone (their inputs are all words or rows of words, each changed there).
    expect(missing.filter((s) => !TEXT_ONLY.includes(s))).toEqual([]);
  });
});
/** Products whose every input is printed words (each changed in the sweep above): no pair of their own. */
const TEXT_ONLY = ["sayings", "credits", "receipt", "message", "birth", "sign", "tour", "lineup", "patch", "editions", "metro", "route", "chess", "line"];
