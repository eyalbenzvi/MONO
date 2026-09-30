import { describe, expect, it } from "vitest";
import { productSuite } from "./productSuite";
import { COUNTRIES_NAME_MAX, COUNTRY_CODES, NOT_COUNTED, OF, counted, packCountries, unpackCountries } from "@/lib/custom/specs/countries";
import { countries } from "./render";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
const rnd = mulberry32(0xc0c0);
const all = [...COUNTRY_CODES];
const pick = (n: number) => [...all].sort(() => rnd() - 0.5).slice(0, n);
const bySize = [...countries.list].sort((a, b) => b.area - a.area).map((c) => c.a3);
const fuzz: Record<string, unknown>[] = [
  { x: packCountries(["MCO"]) },
  { x: packCountries(["LUX"]) },
  { x: packCountries(all), n: W(COUNTRIES_NAME_MAX), y: 2100 },
  { x: packCountries(bySize.slice(0, 20)), n: "Noa" },
  { x: packCountries(bySize.slice(-40)) },
];
for (let i = 0; i < 24; i++) fuzz.push({ x: packCountries(pick(1 + Math.floor(rnd() * all.length))), ...(i % 2 ? { n: "Noa" } : {}), ...(i % 3 ? { y: 1950 + i } : {}) });

productSuite({
  slug: "countries",
  refuse: [{}, { x: "" }, { x: packCountries([]) }, { x: `${packCountries(["ISR"])}A` }, { x: packCountries(["ISR"]).replace(/^./, "!") }, { x: packCountries(["ISR"]), n: W(COUNTRIES_NAME_MAX + 1) }, { x: packCountries(["ISR"]), y: 1899 }],
  longest: { x: packCountries(all), n: "Ã".repeat(COUNTRIES_NAME_MAX), y: 2026 },
  fuzz,
});

describe("Your Countries: the codes", () => {
  it("the fixed list is the map's countries, each once", () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect([...COUNTRY_CODES].sort()).toEqual(countries.list.map((c) => c.a3).sort());
  });
  it("every country chosen counts to 195, the United Nations' count", () => {
    expect(counted(all)).toBe(OF);
    expect(NOT_COUNTED.every((c) => (COUNTRY_CODES as readonly string[]).includes(c))).toBe(true);
  });
  it("packs and unpacks, one spelling each", () => {
    for (let i = 0; i < 20; i++) {
      const codes = pick(1 + Math.floor(rnd() * 60)).sort((a, b) => all.indexOf(a) - all.indexOf(b));
      expect(unpackCountries(packCountries(codes))).toEqual(codes);
    }
    expect(packCountries(["ZZZ"])).toBe(packCountries([]));
  });
});
