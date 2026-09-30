import { productSuite } from "./productSuite";
import { packPlaces } from "@/lib/custom/specKit";
import { TOUR_MAX, TOUR_MIN, TOUR_NAME_MAX, TOUR_TITLES, TOUR_TITLE_MAX } from "@/lib/custom/specs/tour";
import { places } from "./render";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
const rnd = mulberry32(0x7043);
const ids = places.list.map((c) => c.id);
const byLength = [...places.list].sort((a, b) => b.name.length - a.name.length).map((c) => c.id);
const rows = (n: number, years: boolean, from = ids) => Array.from({ length: n }, (_, i) => ({ c: from[Math.floor(rnd() * Math.min(from.length, 400))], ...(years && i % 5 ? { y: 1950 + Math.floor(rnd() * 150) } : {}) }));
const fuzz: Record<string, unknown>[] = [
  { n: "Al", t: "Tour", x: packPlaces(rows(TOUR_MIN, false)) },
  { n: W(TOUR_NAME_MAX), t: W(TOUR_TITLE_MAX), x: packPlaces(byLength.slice(0, TOUR_MAX).map((c) => ({ c, y: 2100 }))) },
  { n: "Noa", t: "World Tour", x: packPlaces(byLength.slice(0, TOUR_MAX).map((c) => ({ c }))) },
];
for (let i = 0; i < 30; i++) fuzz.push({ n: ["Noa", "Dan", "Jean-Luc", W(TOUR_NAME_MAX)][i % 4], t: TOUR_TITLES[i % TOUR_TITLES.length], x: packPlaces(rows(TOUR_MIN + Math.floor(rnd() * (TOUR_MAX - TOUR_MIN + 1)), i % 3 !== 0, i % 2 ? byLength : ids)) });

productSuite({
  slug: "tour",
  refuse: [{}, { n: "Noa", t: "Tour" }, { n: "Noa", t: "Tour", x: packPlaces(rows(TOUR_MIN - 1, true)) }, { n: "Noa", t: "Tour", x: packPlaces(rows(TOUR_MAX + 1, true)) }, { n: W(TOUR_NAME_MAX + 1), t: "Tour", x: packPlaces(rows(TOUR_MIN, true)) }, { n: "Noa", t: W(TOUR_TITLE_MAX + 1), x: packPlaces(rows(TOUR_MIN, true)) }, { n: "Noa", t: "", x: packPlaces(rows(TOUR_MIN, true)) }],
  // Twenty-four dates (the most) of the largest ids, each with a year, packed (specKit packPlaces), and the name and the tour in two-byte letters: 402.
  longest: { n: "Ã".repeat(TOUR_NAME_MAX), t: "Ã".repeat(TOUR_TITLE_MAX), x: packPlaces([...ids].sort((a, b) => b - a).slice(0, TOUR_MAX).map((c) => ({ c, y: 2100 }))) },
  linkMax: 420,
  fuzz,
});
