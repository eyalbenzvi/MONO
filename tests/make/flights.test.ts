import { productSuite } from "./productSuite";
import { BOARD_MAX, PASSENGER_MAX } from "@/lib/custom/specs/flights";
import { airports } from "./render";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
const rnd = mulberry32(0xf117);
const codes = airports.list.map((a) => a.iata);
const longCity = [...airports.list].sort((a, b) => b.city.length - a.city.length).map((a) => a.iata);
const pick = () => codes[Math.floor(rnd() * codes.length)];
const fuzz: Record<string, unknown>[] = [
  { k: "board", x: [["LHR"]] },
  { k: "board", n: W(PASSENGER_MAX), x: longCity.slice(0, BOARD_MAX).map((c) => [c, 2100]) },
  { k: "pass", n: "Al", f: "LHR", t: "CDG" },
  { k: "pass", n: W(PASSENGER_MAX), f: longCity[0], t: longCity[1], d: "2100-12-31", s: "99K", g: "Z99Z" },
  // An airport the list doesn't have (a link from an older list): its code alone.
  { k: "board", x: [["QQQ", 2000], ["LHR"]] },
];
for (let i = 0; i < 30; i++) {
  if (i % 3 === 0) fuzz.push({ k: "pass", n: ["Noa Cohen", "Dan", "Jean-Luc O'Neill"][i % 3], f: pick(), t: pick(), ...(i % 2 ? { d: "2019-04-02", s: `${1 + (i % 40)}A`, g: `B${i + 1}` } : {}) });
  else fuzz.push({ k: "board", ...(i % 2 ? { n: "Noa" } : {}), x: Array.from({ length: 1 + Math.floor(rnd() * BOARD_MAX) }, () => (rnd() < 0.7 ? [pick(), 1960 + Math.floor(rnd() * 60)] : [pick()])) });
}

productSuite({
  slug: "flights",
  refuse: [
    {}, { k: "plane", x: [["LHR"]] }, { k: "board", x: [] }, { k: "board", x: Array.from({ length: BOARD_MAX + 1 }, () => ["LHR"]) }, { k: "board", x: [["lhr"]] }, { k: "board", x: [["LHR", 1899]] }, { k: "board", x: [["LHR"]], f: "TLV" },
    { k: "pass", f: "LHR", t: "CDG" }, { k: "pass", n: "Al", f: "LHR", t: "LHR" }, { k: "pass", n: "Al", f: "LHR", t: "CDG", s: "0A" }, { k: "pass", n: "Al", f: "LHR", t: "CDG", s: "14L" }, { k: "pass", n: "Al", f: "LHR", t: "CDG", g: "B-22" }, { k: "pass", n: "Al", f: "LHR", t: "CDG", x: [["LHR"]] },
  ],
  longest: { k: "board", n: "Ã".repeat(PASSENGER_MAX), x: Array.from({ length: BOARD_MAX }, () => ["LHR", 2026]) },
  fuzz,
  // Two random airports may be the same one: a flight from somewhere to itself is refused.
  mayRefuse: (p) => p.k === "pass" && p.f === p.t,
});
