import { describe, expect, it } from "vitest";
import shirts from "../data/shirts.json";
import { judgeLicense } from "../scripts/sources/_license";
import { metaFilter, type MetaInput } from "../scripts/sources/_metaFilter";
import { BLOCK, EXISTING, SOURCE_BLOCKS, SOURCE_IDS, allRanges, nextNumbers, rangeOf } from "../scripts/sources/ranges";

describe("content waves: id ranges", () => {
  it("no two ranges overlap, the sources' blocks are 1,000 each, and every live design sits in a range", () => {
    const all = allRanges();
    for (let i = 1; i < all.length; i++) expect(all[i].first, `${all[i - 1].what} / ${all[i].what}`).toBeGreaterThan(all[i - 1].last);
    for (const s of SOURCE_IDS) for (const first of SOURCE_BLOCKS[s]) expect(first).toBeGreaterThan(EXISTING[EXISTING.length - 1].last);
    for (const s of shirts as { n: number }[]) expect(rangeOf(s.n), `n ${s.n}`).not.toBeNull();
  });

  it("next numbers skip used ones, stay in the source's block and refuse a full block", () => {
    expect(nextNumbers("met", [9001, 9003], 3)).toEqual([9002, 9004, 9005]);
    const full = Array.from({ length: BLOCK }, (_, i) => 8001 + i);
    expect(() => nextNumbers("wikimedia", full, 1)).toThrow(/full/);
  });
});

describe("content waves: licences", () => {
  const ok = (source: string, f: Parameters<typeof judgeLicense>[1]) => judgeLicense(source, f);
  it("allows public domain, CC0, the Public Domain Mark, US government works and the LoC's no known restrictions", () => {
    expect(ok("wikimedia", { license: "CC0" })).toEqual({ ok: true, license: "CC0" });
    expect(ok("wikimedia", { license: "https://creativecommons.org/publicdomain/zero/1.0/" })).toEqual({ ok: true, license: "CC0" });
    expect(ok("wellcome", { license: "pdm" })).toEqual({ ok: true, license: "PDM" });
    expect(ok("wikimedia", { license: "Public domain", rights: "PD-old-100" })).toEqual({ ok: true, license: "PD" });
    expect(ok("met", { publicDomain: true })).toEqual({ ok: true, license: "CC0" });
    expect(ok("nasa", { rights: "" , credit: "NASA/JPL" })).toEqual({ ok: true, license: "US-Gov" });
    expect(ok("loc", { rights: "No known restrictions on publication." })).toEqual({ ok: true, license: "NKR" });
  });

  it("refuses NC, ND, all rights reserved, not evaluated, unclear, third-party rights, CC BY without approval, and aggregators", () => {
    const no = (source: string, f: Parameters<typeof judgeLicense>[1]) => judgeLicense(source, f).ok;
    expect(no("wikimedia", { license: "CC BY-NC 4.0" })).toBe(false);
    expect(no("wikimedia", { license: "CC BY-ND 2.0" })).toBe(false);
    expect(no("met", { rights: "All rights reserved" })).toBe(false);
    expect(no("loc", { rights: "Rights status not evaluated" })).toBe(false);
    expect(no("wikimedia", { license: "" })).toBe(false);
    expect(no("nasa", { rights: "", credit: "Image courtesy of Getty Images" })).toBe(false);
    expect(no("wikimedia", { license: "CC BY 4.0" })).toBe(false);
    expect(judgeLicense("wikimedia", { license: "CC BY 4.0" }, { allowBy: true })).toEqual({ ok: true, license: "CC-BY" });
    expect(no("wikimedia", { license: "CC BY-SA 3.0" })).toBe(false);
    expect(no("openverse", { license: "cc0" })).toBe(false);
    expect(no("met", { publicDomain: false })).toBe(false);
    expect(no("wikimedia", { rights: "No known restrictions" })).toBe(false);
  });
});

describe("content waves: the metadata filter", () => {
  const base: MetaInput = { record: "r1", title: "Octopus", classification: "Print", tags: [], description: "", photo: false, hasImage: true, width: 3000, height: 4000, date: "1880", maker: "E. Haeckel", credit: "Met" };
  const keywords = ["octopus", "whale", "fish", "school of fish", "ship", "signal flags", "seal"];
  const run = (c: Partial<MetaInput>, extra = {}) => metaFilter({ ...base, ...c }, { keywords, ...extra }, { records: new Set(), shas: new Set() });

  it("keeps a world's print and orders by the metadata only", () => {
    const d = run({});
    expect(d).toMatchObject({ keep: true, reasons: [] });
    expect(run({ date: "1990" }).score).toBeLessThan(d.score);
    expect(run({ classification: "", title: "Octopus", tags: [] }).score).toBeLessThan(d.score);
  });

  it("refuses each reason, with the reason", () => {
    expect(run({ title: "Whale" , hasImage: false }).reasons).toContain("no-image");
    expect(run({ width: 1200 }).reasons).toContain("low-res");
    expect(run({ width: 3000, height: 10000 }).reasons).toContain("strip");
    expect(run({ title: "Teapot", tags: [] }).reasons).toContain("off-world");
    expect(run({ photo: true, title: "Fishermen with their catch of fish" }).reasons).toContain("people");
    expect(run({ title: "Portrait of a Whaler", tags: ["whale"] }).reasons).toContain("people");
    expect(run({ title: "Whale", classification: "Trade card" }).reasons).toContain("text");
    expect(run({ title: "Ship with the Royal Coat of Arms" }).reasons).toContain("brand");
    expect(run({ title: "Naval battle, ships burning" }).reasons).toContain("unsuitable");
    expect(run({ title: "Whale", classification: "Textile" }).reasons).toContain("classification");
  });

  it("allows figures that aren't the subject of a print, never in a photograph; the seal is an animal, a flag is a signal only at sea", () => {
    expect(run({ title: "Ship in a harbour with crew" }).keep).toBe(true);
    expect(run({ photo: true, title: "Ship in a harbour with crew" }).keep).toBe(false);
    expect(run({ title: "Seal on a rock" }).keep).toBe(true);
    expect(run({ title: "Seal of the City of Boston" }).reasons).toContain("brand");
    expect(run({ title: "Ship flying signal flags" }).reasons).toContain("brand");
    expect(run({ title: "Ship flying signal flags" }, { signalFlags: true }).keep).toBe(true);
  });

  it("a record or a scan seen before is a duplicate", () => {
    const seen = { records: new Set<string>(), shas: new Set<string>() };
    expect(metaFilter({ ...base, sha: "a" }, { keywords }, seen).keep).toBe(true);
    expect(metaFilter({ ...base, sha: "b" }, { keywords }, seen).reasons).toContain("duplicate");
    expect(metaFilter({ ...base, record: "r2", sha: "a" }, { keywords }, seen).reasons).toContain("duplicate");
  });
});

describe("content waves: /shop/?wave=<n>", () => {
  it("narrows the shop to a wave's designs in the shop's own order, and changes nothing without it", async () => {
    const { SHIRTS } = await import("@/lib/catalog");
    const { rankShirts } = await import("@/lib/recommendation");
    const { shopList } = await import("@/components/shop/shopList");
    const vector = Object.fromEntries(Object.keys(SHIRTS[0].features).map((k) => [k, 0.5])) as typeof SHIRTS[0]["features"];
    const tagged = SHIRTS.map((s, i) => (i % 50 === 0 ? { ...s, wave: 7 } : s));
    const ranked = rankShirts(vector, tagged, "popular");
    const all = shopList({ ranked, tee: null, cats: [], sort: "popular", result: null });
    const wave = shopList({ ranked, tee: null, cats: [], sort: "popular", result: null, wave: 7 });
    expect(wave.length).toBeGreaterThan(0);
    expect(wave.every((h) => h.shirt.wave === 7)).toBe(true);
    expect(wave.map((h) => h.shirt.id)).toEqual(all.filter((h) => h.shirt.wave === 7).map((h) => h.shirt.id));
    expect(shopList({ ranked, tee: null, cats: [], sort: "popular", result: null, wave: 99 })).toEqual([]);
  });
});

describe("content waves: applying the owner's decisions", () => {
  it("rejects retire with the owner's reason (or 'owner review'), overrides rename, keep and maybe change nothing, and bad input is refused", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, readFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const { applyCatalogue, readDecisions } = await import("../scripts/review/applyDecisions");
    const root = mkdtempSync(path.join(tmpdir(), "mono-dec-"));
    mkdirSync(path.join(root, "data", "curation"), { recursive: true });
    writeFileSync(path.join(root, "data", "curation", "retired.json"), JSON.stringify({ "mono-0001": "old: reason" }));
    writeFileSync(path.join(root, "data", "curation", "titles.json"), "{}");
    const file = path.join(root, "d.json");
    writeFileSync(file, JSON.stringify({ "mono-0100": "reject", "mono-0101": { decision: "reject", reason: "text on it" }, "mono-0102": "keep", "mono-0103": "maybe", "mono-0104": { decision: "keep", title_override: "Moon Chart" } }));
    expect(applyCatalogue(readDecisions([file]), root)).toEqual({ rejected: 2, renamed: 1, kept: 3 });
    expect(JSON.parse(readFileSync(path.join(root, "data", "curation", "retired.json"), "utf8"))).toEqual({ "mono-0001": "old: reason", "mono-0100": "review-2: owner review", "mono-0101": "review-2: text on it" });
    expect(JSON.parse(readFileSync(path.join(root, "data", "curation", "titles.json"), "utf8"))).toEqual({ "mono-0104": "Moon Chart" });
    writeFileSync(file, JSON.stringify({ "mono-0100": "drop" }));
    expect(() => readDecisions([file])).toThrow(/unknown decision/);
  });
});
