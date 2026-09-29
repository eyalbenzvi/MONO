import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { SHIRTS, familyOf } from "@/lib/catalog";
import { search, type SearchOptions } from "@/lib/search/engine";
import { TABLE_KINDS, decodeFacets, encodeFacets, facetTest, type Facet } from "@/lib/search/facets";
import { decodeIndex } from "@/lib/search/format";
import { clean, stem, terms, STOPWORDS } from "@/lib/search/normalize";
import { mulberry32 } from "../scripts/gen/core";
import { realIndex } from "./searchFixture";

const { index, file } = realIndex();
const run = (query: string, facets: Facet[] = [], extra: Partial<SearchOptions> = {}) => search(index, SHIRTS, { query, facets, ...extra });
const top = (query: string, k: number) => run(query).results.slice(0, k).map((h) => h.shirt);
/** A sample of designs, the same on every run. */
function sample(n: number, seed: number) {
  const rnd = mulberry32(seed);
  const pool = [...SHIRTS];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
const titleWords = (title: string) => clean(title).split(" ").filter((w) => w.length >= 5 && !STOPWORDS.has(w) && !/\d/.test(w));

describe("search: finding designs by their words", () => {
  it("every design is in the top 3 for its exact title (or its family is, the design itself being a variation)", () => {
    // (A title of stopwords only — "Print" — has nothing to search by.)
    const misses = SHIRTS.filter((s) => terms(s.title).length && !top(`${s.title} `, 3).some((x) => x.id === s.id || x.family === s.family)).map((s) => `${s.id} ${s.title}`);
    expect(misses).toEqual([]);
  }, 60_000);

  it("a title with one word mistyped (a swap or a changed letter) still finds the design in the top 10, and says what it read", () => {
    const rnd = mulberry32(7);
    let tried = 0;
    const misses: string[] = [];
    for (const s of sample(1000, 3)) {
      if (tried >= 300) break;
      const ws = titleWords(s.title);
      if (!ws.length) continue;
      const w = ws[Math.floor(rnd() * ws.length)];
      const i = 1 + Math.floor(rnd() * (w.length - 2));
      const typo = rnd() < 0.5 ? w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2) : w.slice(0, i) + (w[i] === "x" ? "q" : "x") + w.slice(i + 1);
      if (typo === w || index.termId.has(stem(typo))) continue; // the typo is a real word: nothing to correct
      tried++;
      const r = run(`${clean(s.title).replace(new RegExp(`\\b${w}\\b`), typo)} `);
      if (!r.results.slice(0, 10).some((h) => h.shirt.family === s.family)) misses.push(`${s.title} → ${typo}`);
      if (!r.corrected.some((c) => c.from === typo)) misses.push(`${typo}: no correction reported`);
    }
    expect(tried).toBe(300);
    expect(misses).toEqual([]);
  });

  it("the first letters of a word, still being typed, find designs that contain it", () => {
    for (const s of sample(100, 11)) {
      const w = titleWords(s.title)[0];
      if (!w) continue;
      const r = run(w.slice(0, 4));
      expect(r.results.some((h) => h.shirt.family === s.family), `${w.slice(0, 4)} → ${s.title}`).toBe(true);
    }
  });

  it("an id, SKU or number names the design: it comes first", () => {
    for (const s of sample(60, 5)) {
      expect(top(s.id, 1)[0].id).toBe(s.id);
      expect(top(s.sku, 1)[0].id).toBe(s.id);
      // A number within a category (No. 067) names one design per category that has it: they come first.
      const same = SHIRTS.filter((x) => x.no === s.no).length;
      expect(top(`No. ${s.no}`, same).map((x) => x.id)).toContain(s.id);
      expect(top(String(s.no).padStart(3, "0"), same + SHIRTS.filter((x) => x.n === s.no).length).map((x) => x.id)).toContain(s.id);
    }
  });
});

describe("search: facets", () => {
  it("every facet value the index lists returns exactly the designs that have it (no chip leads to nothing)", () => {
    const ctx = { index, catalog: SHIRTS };
    for (const kind of TABLE_KINDS)
      for (const e of file.tables[kind]) {
        const facet = { kind, value: e.id } as Facet;
        const r = run("", [facet]);
        const want = SHIRTS.filter((_, i) => facetTest(ctx, facet)(i)).map((s) => s.id).sort();
        expect(r.mode).toBe("filter");
        expect(r.results.map((h) => h.shirt.id).sort(), `${kind}:${e.id}`).toEqual(want);
        expect(want.length, `${kind}:${e.id}`).toBe(e.count);
        expect(want.length).toBeGreaterThan(0);
      }
  });

  it("AND across kinds, OR within one", () => {
    const [a, b] = file.tables.medium;
    const cat = file.tables.category[0];
    const either = run("", [{ kind: "medium", value: a.id }, { kind: "medium", value: b.id }]).results;
    expect(either).toHaveLength(a.count + b.count);
    const both = run("", [{ kind: "medium", value: a.id }, { kind: "category", value: cat.id }]).results;
    expect(both.every((h) => h.shirt.medium === a.id && h.shirt.category === cat.id)).toBe(true);
  });

  it("the facet list round-trips through the address", () => {
    const facets: Facet[] = [
      { kind: "artist", value: file.tables.artist[0].id },
      { kind: "look", value: file.tables.look[0].id },
      { kind: "era", value: "c19" },
      { kind: "variant", value: "a:b,c" },
    ];
    expect(decodeFacets(encodeFacets(facets))).toEqual(facets);
    expect(decodeFacets("nonsense,look:,bogus:x,look:%E0")).toEqual([]);
  });
});

describe("search: ranking", () => {
  it("never a dead end: a query with a known word always returns something, saying what it let go", () => {
    const rnd = mulberry32(21);
    const kinds = TABLE_KINDS.filter((k) => file.tables[k].length);
    for (let i = 0; i < 200; i++) {
      const w1 = file.vocab[Math.floor(rnd() * file.vocab.length)];
      const w2 = file.vocab[Math.floor(rnd() * file.vocab.length)];
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      const facet = { kind, value: file.tables[kind][Math.floor(rnd() * file.tables[kind].length)].id } as Facet;
      const r = run(`${w1} ${w2} `, [facet]);
      expect(r.results.length, `${w1} ${w2} ${kind}:${facet.value}`).toBeGreaterThan(0);
    }
    const r = run("zzqxv ");
    expect(r.results.length).toBeGreaterThan(0);
    expect(r.relaxed?.droppedTerms).toEqual(["zzqxv"]);
  });

  it("one design per family, the one that matches best", () => {
    for (const s of sample(80, 9)) {
      const q = `${titleWords(s.title)[0] ?? s.title} `;
      const collapsed = run(q).results;
      const families = collapsed.map((h) => h.shirt.family);
      expect(new Set(families).size).toBe(families.length);
      const all = run(q, [], { collapse: false }).results;
      const best = new Map<string, string>();
      for (const h of all) if (!best.has(h.shirt.family)) best.set(h.shirt.family, h.shirt.id);
      for (const h of collapsed) expect(h.shirt.id).toBe(best.get(h.shirt.family));
    }
  });

  it("\"like this\" alone leaves out the design's own family and puts the closest first", () => {
    const s = SHIRTS[42];
    const r = run("", [{ kind: "like", value: s.id }]);
    expect(r.mode).toBe("text");
    expect(r.results.some((h) => familyOf(h.shirt.id) === s.family)).toBe(false);
    expect(r.results.length).toBeGreaterThan(SHIRTS.length / 4);
  });

  it("the taste only counts once it's known", () => {
    const vector = { ...SHIRTS[0].features };
    const q = `${titleWords(SHIRTS[0].title)[0] ?? "line"} `;
    expect(run(q, [], { vector, tasteKnown: false }).results.map((h) => h.shirt.id)).toEqual(run(q).results.map((h) => h.shirt.id));
  });
});

describe("search: the index file", () => {
  it("a stale index (other designs, another format) turns search off without throwing", () => {
    const ids = SHIRTS.map((s) => s.id);
    expect(decodeIndex(file, ids)).not.toBeNull();
    expect(decodeIndex(file, ids.slice(1))).toBeNull();
    expect(decodeIndex(file, [...ids.slice(0, -1), "mono-9999"])).toBeNull();
    expect(decodeIndex({ ...file, v: file.v + 1 }, ids)).toBeNull();
    expect(decodeIndex(null as never, ids)).toBeNull();
  });

  it(`fits the budget: at most 100 KB gzipped`, () => {
    expect(gzipSync(JSON.stringify(file), { level: 9 }).length).toBeLessThanOrEqual(100 * 1024);
  });

  it("answers fast: p95 at most 8 ms over 500 generated queries", () => {
    const rnd = mulberry32(99);
    const queries: [string, Facet[]][] = [];
    for (const s of sample(500, 13)) {
      const w = titleWords(s.title)[0] ?? clean(s.title).split(" ")[0];
      const pick = rnd();
      const facet: Facet[] = rnd() < 0.3 ? [{ kind: "medium", value: s.medium }] : [];
      if (pick < 0.3) queries.push([`${s.title} `, facet]);
      else if (pick < 0.55) queries.push([w.slice(0, Math.min(w.length, 4)), facet]);
      else if (pick < 0.8) queries.push([`${w.length > 4 ? w.slice(0, 2) + w[3] + w[2] + w.slice(4) : w} `, facet]);
      else queries.push([`${w} ${file.vocab[Math.floor(rnd() * file.vocab.length)]} `, facet]);
    }
    for (const [q, f] of queries.slice(0, 50)) run(q, f); // warm up
    // Each query's best of three runs: the engine's own time, not the other test files sharing the CPU.
    const times = queries.map(([q, f]) => {
      let best = Infinity;
      for (let k = 0; k < 3; k++) {
        const t = performance.now();
        run(q, f);
        best = Math.min(best, performance.now() - t);
      }
      return best;
    });
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    expect(p95, `p95 ${p95.toFixed(2)} ms`).toBeLessThanOrEqual(8);
  }, 60_000);
});

describe("search: expert review (algorithm and content)", () => {
  const ids = (q: string) => run(q).results.map((h) => h.shirt.id);

  it("a word and its other forms meet: engraving = engravings, the stem of engrave", () => {
    expect(stem("engraving")).toBe(stem("engravings"));
    expect(stem("engrave")).toBe(stem("engraving"));
    expect(stem("evening")).toBe("evening");
    expect(ids("engravings ")).toEqual(ids("engraving "));
  });

  it("a short real word is never read as another (neon ≠ noon, yeti ≠ yet): no correction, an honest no-match", () => {
    for (const q of ["neon ", "yeti "]) {
      const r = run(q);
      expect(r.corrected, q).toEqual([]);
      expect(r.relaxed?.droppedTerms, q).toEqual([q.trim()]);
    }
  });

  it("a typo is corrected even in a plural or a word ending in e (gatxs → gate, engnie → engine)", () => {
    for (const [q, to] of [["gatxs ", "gate"], ["engnie ", "engin"]]) expect(run(q).corrected.map((c) => stem(c.to)), q).toContain(to);
  });

  it("a catalogue word beats a lexicon word as the correction, and a typo in an -ing ending still finds the word (fountxin, lookxng)", () => {
    expect(run("fountxin ").corrected.map((c) => c.to)).toContain("fountain");
    expect(run("lookxng ").corrected.length).toBeGreaterThan(0);
  });

  it("colour words that name the tee are the tee filter, not text (bird on black)", () => {
    const r = run("bird on black ");
    expect(r.relaxed).toBeNull();
    expect(r.suggestions.some((s) => s.facet.kind === "tee" && s.facet.value === "black")).toBe(true);
    expect(r.total).toBeGreaterThan(0);
  });

  it("typed words are never dropped to fill the page: a word that finds nothing says so", () => {
    const tiger = new Set(ids("tiger "));
    expect(ids("tiger zzqxv ").every((id) => tiger.has(id))).toBe(true);
  });

  it("boilerplate in museum text doesn't match: \"space\" finds spacecraft, not every Air and Space Museum credit", () => {
    expect(run("space ").total).toBeLessThan(SHIRTS.length * 0.2);
    expect(run("ink ").total).toBeLessThan(SHIRTS.length * 0.2);
  });

  it("\"text\" doesn't offer a No text look, and \"new york\" isn't the New this week filter", () => {
    expect(run("text ").suggestions.map((s) => s.label)).not.toContain("No text");
    expect(run("new york ").suggestions.some((s) => s.facet.kind === "new")).toBe(false);
    expect(run("new york ").total).toBeGreaterThan(0);
  });
});

describe("search: a design named exactly is found, not a miss", () => {
  it("an id, SKU or number leads the results and says no 'No match'", () => {
    const s = SHIRTS[0];
    const id = `mono-${String(s.n).padStart(4, "0")}`;
    const r = run(id);
    expect(r.results[0].shirt.id).toBe(s.id);
    expect(r.relaxed).toBeNull();
    // Only that design: the rest of the catalogue isn't listed after it.
    expect(r.results.map((x) => x.shirt.id)).toEqual([s.id]);
  });
});
