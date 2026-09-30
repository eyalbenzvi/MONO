import { describe, expect, it } from "vitest";
import { encodeMake } from "@/lib/custom/spec";
import { packInts, packPlaces, unpackPlaces } from "@/lib/custom/specKit";
import { places } from "./render";

const TLV = 293397, ROME = 3169070, LONDON = 2643743;

describe("Make: places and years, packed", () => {
  it("round-trips rows with and without years, in order", () => {
    const rows = [{ c: TLV, y: 1990 }, { c: ROME }, { c: LONDON, y: 2026 }, { c: TLV }];
    const s = packPlaces(rows);
    expect(unpackPlaces(s, { min: 1, max: 8 }, places.byId)).toEqual(rows);
    expect(/^[A-Za-z0-9_-]+$/.test(s)).toBe(true);
  });
  it("refuses a count out of range, a year out of range, years where none are taken, an unknown city, and any other spelling", () => {
    expect(unpackPlaces(packPlaces([{ c: TLV }]), { min: 2, max: 8 })).toBeNull();
    expect(unpackPlaces(packPlaces(Array(9).fill({ c: TLV })), { min: 1, max: 8 })).toBeNull();
    expect(unpackPlaces(packInts([TLV, -1]), { min: 1, max: 8 })).toBeNull();
    expect(unpackPlaces(packPlaces([{ c: TLV, y: 2101 }]), { min: 1, max: 8 })).toBeNull();
    expect(unpackPlaces(packPlaces([{ c: TLV, y: 2000 }]), { min: 1, max: 8, years: false })).toBeNull();
    expect(unpackPlaces(packPlaces([{ c: 1 }]), { min: 1, max: 8 }, places.byId)).toBeNull();
    for (const bad of ["", "!!", 5, null, packPlaces([{ c: TLV }]) + "A"]) expect(unpackPlaces(bad, { min: 1, max: 8 })).toBeNull();
  });
  it("24 rows with years stay a short link", () => {
    const big = [...places.list].sort((a, b) => b.id - a.id).slice(0, 24).map((c, i) => ({ c: c.id, y: 2000 + i }));
    const p = packPlaces(big);
    expect(unpackPlaces(p, { min: 4, max: 24 })).toEqual(big);
    const n = encodeMake({ t: "journey", v: 1, p: { c: [TLV, ROME] } } as never).length + p.length;
    expect(n).toBeLessThan(300);
  });
});

describe("Make: the places-and-years editor's rows", () => {
  it("drafts round-trip rows; a half-typed or out-of-range year makes no rows", async () => {
    const { draftsOf, rowsOf } = await import("@/components/custom/editors/PlacesField");
    const rows = [{ c: TLV, y: 1990 }, { c: ROME }];
    expect(rowsOf(draftsOf(rows))).toEqual(rows);
    expect(rowsOf([{ c: TLV, year: "19" }])).toBeNull();
    expect(rowsOf([{ c: TLV, year: "1850" }])).toBeNull();
    expect(rowsOf([])).toEqual([]);
  });
});
