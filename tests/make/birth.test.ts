import { expect, it } from "vitest";
import { productSuite } from "./productSuite";
import { BABY_NAME_MAX, HELLOS, LENGTH, WEIGHT, check, lengthText, weightText } from "@/lib/custom/specs/birth";
import { places } from "./render";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
const rnd = mulberry32(0xb1e7);
const names = ["Noa", "Al", "Maya", "Jean-Luc", "Zoë", W(BABY_NAME_MAX), "O'Neill", "Ari"];
const cities = [293397, 2643743, 5128581, 1850147, 2147714];
const fuzz: Record<string, unknown>[] = [
  { h: "boy", n: "Al", d: "2021-11-19" },
  { h: "girl", n: "Al", d: "2021-11-19", mo: 1 },
  { h: "hello", n: W(BABY_NAME_MAX), d: "2100-12-31", t: "23:59", u: "i", wt: WEIGHT.imperial[1], ln: LENGTH.imperial[1], c: 293397, mo: 1 },
  { h: "girl", n: "Noa", d: "1900-01-01", wt: WEIGHT.metric[0], ln: LENGTH.metric[0] },
];
for (let i = 0; i < 40; i++) {
  const imp = i % 3 === 0;
  const sys = imp ? "imperial" : "metric";
  fuzz.push({
    h: HELLOS[i % 3],
    n: names[i % names.length],
    d: `${1950 + Math.floor(rnd() * 150)}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`,
    ...(i % 2 ? { t: `${String(Math.floor(rnd() * 24)).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}` } : {}),
    ...(imp ? { u: "i" } : {}),
    ...(i % 4 ? { wt: WEIGHT[sys][0] + Math.floor(rnd() * (WEIGHT[sys][1] - WEIGHT[sys][0])) } : {}),
    ...(i % 5 ? { ln: LENGTH[sys][0] + Math.floor(rnd() * (LENGTH[sys][1] - LENGTH[sys][0])) } : {}),
    ...(i % 3 ? { c: cities[i % cities.length] } : {}),
    ...(i % 2 ? {} : { mo: 1 }),
  });
}

productSuite({
  slug: "birth",
  refuse: [
    {}, { h: "girl", n: "Noa" }, { h: "twins", n: "Noa", d: "2021-11-19" }, { h: "girl", n: "N", d: "2021-11-19" }, { h: "girl", n: W(BABY_NAME_MAX + 1), d: "2021-11-19" },
    { h: "girl", n: "Noa", d: "2021-11-19", t: "24:00" }, { h: "girl", n: "Noa", d: "2021-11-19", wt: 399 }, { h: "girl", n: "Noa", d: "2021-11-19", wt: 6501 }, { h: "girl", n: "Noa", d: "2021-11-19", u: "i", wt: 3400 },
    { h: "girl", n: "Noa", d: "2021-11-19", ln: 249 }, { h: "girl", n: "Noa", d: "2021-11-19", u: "m" }, { h: "girl", n: "Noa", d: "2021-11-19", mo: 2 }, { h: "girl", n: "Noa", d: "2021-11-19", wt: 3400.5 },
  ],
  longest: { h: "hello", n: "Ã".repeat(BABY_NAME_MAX), d: "2021-11-19", t: "04:12", u: "i", wt: 120, ln: 201, c: 2643743, mo: 1 },
  fuzz,
});

it("the weight and the length print as typed, in their unit", () => {
  expect(weightText({ wt: 3400 })).toBe("3.4 kg");
  expect(weightText({ wt: 3450 })).toBe("3.45 kg");
  expect(weightText({ wt: 3456 })).toBe("3.456 kg");
  expect(weightText({ wt: 3000 })).toBe("3.0 kg");
  expect(weightText({ u: "i", wt: 120 })).toBe("7 lb 8 oz");
  expect(lengthText({ ln: 510 })).toBe("51 cm");
  expect(lengthText({ ln: 505 })).toBe("50.5 cm");
  expect(lengthText({ u: "i", ln: 201 })).toBe("20.1 in");
});

it("a city must be one of the list when the list is at hand", () => {
  expect(check({ h: "girl", n: "Noa", d: "2021-11-19", c: 1 }, { cityById: places.byId })).toBeNull();
  expect(check({ h: "girl", n: "Noa", d: "2021-11-19", c: 293397 }, { cityById: places.byId })).not.toBeNull();
});
