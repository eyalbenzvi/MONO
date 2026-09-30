import { productSuite } from "./productSuite";
import { FORMATIONS, PLAYER_MAX, POSITIONS, SEASON_MAX, TEAM_MAX, type Formation } from "@/lib/custom/specs/lineup";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
const rnd = mulberry32(0x1e0b);
const names = ["Dad", "Ari", "Noa", "Maya", "Jean-Luc", "O'Neill", "Bo", W(PLAYER_MAX), "Mmmmmmmmmmmm", ""];
const team = (f: Formation, fill: (i: number) => unknown[]) => POSITIONS[f].map((_, i) => fill(i));
const fuzz: Record<string, unknown>[] = [];
for (const f of FORMATIONS) {
  fuzz.push({ f, t: "A", x: team(f, () => [""]) });
  fuzz.push({ f, t: W(TEAM_MAX), s: W(SEASON_MAX), x: team(f, () => [W(PLAYER_MAX), 99]), me: POSITIONS[f].length - 1 });
  fuzz.push({ f, t: "Sunday FC", s: "2025-26", x: team(f, (i) => [names[i % names.length], i + 1]), me: 0 });
  for (let k = 0; k < 5; k++) fuzz.push({ f, t: ["Sunday FC", "The Levins", "Hoops"][k % 3], x: team(f, () => (rnd() < 0.7 ? [names[Math.floor(rnd() * names.length)], Math.floor(rnd() * 100)] : [names[Math.floor(rnd() * names.length)]])), ...(k % 2 ? { me: Math.floor(rnd() * POSITIONS[f].length) } : {}) });
}

productSuite({
  slug: "lineup",
  refuse: [
    {}, { f: "442", t: "A" }, { f: "4231", t: "A", x: team("442", () => [""]) }, { f: "442", t: "A", x: team("5", () => [""]) }, { f: "5", t: "A", x: team("442", () => [""]) },
    { f: "5", t: "A", x: team("5", () => ["A", 100]) }, { f: "5", t: "A", x: team("5", () => [W(PLAYER_MAX + 1)]) }, { f: "5", t: "A", x: team("5", () => [" A"]) }, { f: "5", t: "", x: team("5", () => [""]) },
    { f: "5", t: "A", x: team("5", () => [""]), me: 5 }, { f: "5", t: "A", s: "2025/26", x: team("5", () => [""]) },
  ],
  // Eleven names of twelve characters with their numbers in two-byte letters (the worst case, 640): the link is the team itself.
  linkMax: 700,
  longest: { f: "442", t: "Ã".repeat(TEAM_MAX), s: "Ã".repeat(SEASON_MAX), x: team("442", () => ["Ã".repeat(PLAYER_MAX), 99]), me: 10 },
  fuzz,
});
