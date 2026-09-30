import { productSuite } from "./productSuite";
import { EMBLEMS } from "@/lib/custom/draw/emblems";
import { CREW_MAX, CREW_NAME_MAX, MISSION_MAX } from "@/lib/custom/specs/patch";

const W = (n: number) => "W".repeat(n);
const crews = [["B"], ["Mum", "Dad", "Noa", "Ari"], ["Wwwwww", "Wwwwww", "Wwwwww", "Wwwwww", "Wwwwww"], ["Jean-Luc", "O'Neill", "Zoë"], [W(CREW_NAME_MAX), W(CREW_NAME_MAX), W(CREW_NAME_MAX)], ["A", "B", "C", "D", "E", "F"]];
const fuzz: Record<string, unknown>[] = [];
EMBLEMS.forEach((e, i) => {
  fuzz.push({ m: "A", x: ["B"], e });
  fuzz.push({ m: [W(MISSION_MAX), "Operation Beach", "Apollo Sofa", "The Big Move"][i % 4], x: crews[i % crews.length], e, ...(i % 2 ? { d: "2024-08-03" } : {}) });
});

productSuite({
  slug: "patch",
  refuse: [{}, { m: "A", x: ["B"] }, { m: "A", e: "tent" }, { m: "A", x: [], e: "tent" }, { m: "A", x: ["B"], e: "cat" }, { m: W(MISSION_MAX + 1), x: ["B"], e: "tent" }, { m: "A", x: [W(CREW_NAME_MAX + 1)], e: "tent" }, { m: "A", x: Array.from({ length: CREW_MAX + 1 }, () => "B"), e: "tent" }, { m: "A", x: ["B"], e: "tent", d: "2024-02-30" }, { m: "A", x: Array.from({ length: CREW_MAX }, () => W(CREW_NAME_MAX)), e: "tent" }],
  // The crew round the foot holds 44 characters: four names of eight at most.
  longest: { m: "Ã".repeat(MISSION_MAX), x: ["Ã".repeat(8), "Ã".repeat(8), "Ã".repeat(8), "Ã".repeat(8)], e: "compass", d: "2024-08-03" },
  fuzz,
});
