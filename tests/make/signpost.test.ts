import { describe, expect, it } from "vitest";
import { productSuite } from "./productSuite";
import { packPlaces } from "@/lib/custom/specKit";
import { SIGNPOST_MAX, check } from "@/lib/custom/specs/signpost";
import { greatCircle } from "@/lib/custom/templates/signpost";
import { places } from "./render";
import { mulberry32 } from "../../scripts/gen/core";

const rnd = mulberry32(0x5195);
const ids = places.list.map((c) => c.id);
const pick = (n: number, not: number) => {
  const out: number[] = [];
  while (out.length < n) {
    const c = ids[Math.floor(rnd() * ids.length)];
    if (c !== not && !out.includes(c)) out.push(c);
  }
  return out;
};
// The longest names in the list, so the boards meet their longest lettering.
const longest = [...places.list].sort((a, b) => b.name.length - a.name.length).slice(0, SIGNPOST_MAX + 1).map((c) => c.id);
const fuzz: Record<string, unknown>[] = [
  { h: longest[0], x: packPlaces(longest.slice(1).map((c) => ({ c }))) },
  { h: longest[0], x: packPlaces(longest.slice(1).map((c) => ({ c }))), mi: 1 },
  { k: "since", h: longest[0], x: packPlaces([{ c: longest[1] }]), y: 2100 },
];
for (let i = 0; i < 36; i++) {
  const h = ids[Math.floor(rnd() * ids.length)];
  if (i % 4 === 3) fuzz.push({ k: "since", h, x: packPlaces(pick(1, h).map((c) => ({ c }))), y: 1950 + i, ...(i % 2 ? { mi: 1 } : {}) });
  else fuzz.push({ h, x: packPlaces(pick(1 + Math.floor(rnd() * SIGNPOST_MAX), h).map((c) => ({ c }))), ...(i % 3 ? {} : { mi: 1 }) });
}

productSuite({
  slug: "signpost",
  refuse: [
    {}, { h: 293397 }, { h: 293397, x: "" }, { h: 293397, x: packPlaces([{ c: 293397 }]) }, { h: 293397, x: packPlaces([{ c: 2643743 }, { c: 2643743 }]) },
    { h: 293397, x: packPlaces(Array.from({ length: SIGNPOST_MAX + 1 }, (_, i) => ({ c: ids[i] === 293397 ? ids[99] : ids[i] }))) },
    { h: 293397, x: packPlaces([{ c: 2643743, y: 2000 }]) }, { h: 293397, x: packPlaces([{ c: 2643743 }]), y: 2000 },
    { k: "since", h: 293397, x: packPlaces([{ c: 2643743 }]) }, { k: "since", h: 293397, x: packPlaces([{ c: 2643743 }, { c: 5128581 }]), y: 2000 }, { k: "then", h: 293397, x: packPlaces([{ c: 2643743 }]) },
    { h: 293397, x: packPlaces([{ c: 2643743 }]), mi: 2 },
  ],
  // The largest ids in the list, so the packed places are at their longest.
  longest: (() => {
    const big = [...ids].sort((a, b) => b - a).slice(0, SIGNPOST_MAX + 1);
    return { h: big[0], x: packPlaces(big.slice(1).map((c) => ({ c }))), mi: 1 };
  })(),
  fuzz,
});

describe("Your Signpost: the geometry", () => {
  it("measures along the great circle and takes the initial bearing", () => {
    const [london, newYork, telAviv] = [2643743, 5128581, 293397].map((id) => places.byId(id)!);
    const ln = greatCircle(london, newYork);
    expect(ln.km).toBeGreaterThan(5540);
    expect(ln.km).toBeLessThan(5600);
    // London to New York sets off west-north-west, not west.
    expect(ln.bearing).toBeGreaterThan(280);
    expect(ln.bearing).toBeLessThan(295);
    const tl = greatCircle(telAviv, london);
    expect(Math.round(tl.km / 10) * 10).toBeGreaterThan(3500);
    expect(tl.bearing).toBeGreaterThan(290);
    expect(greatCircle(london, london).km).toBe(0);
  });
  it("a city must be one of the list when the list is at hand", () => {
    expect(check({ h: 1, x: packPlaces([{ c: 2643743 }]) }, { cityById: places.byId })).toBeNull();
    expect(check({ h: 293397, x: packPlaces([{ c: 1 }]) }, { cityById: places.byId })).toBeNull();
  });
});
