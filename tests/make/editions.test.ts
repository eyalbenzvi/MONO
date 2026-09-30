import { productSuite } from "./productSuite";
import { EDITIONS_MAX, EDITION_NAME_MAX, ROLE_MAX } from "@/lib/custom/specs/editions";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
const rnd = mulberry32(0xed17);
const names = ["Dana", "Avi", "Maya", "Noa", "Ari", "Tamar", "O'Neill", "Zoë", "Jean-Luc", "Bo", W(EDITION_NAME_MAX), "Mmmmmmmmmmmmmm", "i"];
const fuzz: Record<string, unknown>[] = [
  { x: [["A"]], r: "Me" },
  { x: Array.from({ length: EDITIONS_MAX }, () => [W(EDITION_NAME_MAX), 2000]), r: W(ROLE_MAX), e: 1900 },
  { x: Array.from({ length: EDITIONS_MAX }, (_, i) => [`N${i}`]), r: "Mum" },
];
for (let i = 0; i < 36; i++) {
  const n = 1 + Math.floor(rnd() * EDITIONS_MAX);
  fuzz.push({ x: Array.from({ length: n }, () => (rnd() < 0.7 ? [names[Math.floor(rnd() * names.length)], 1900 + Math.floor(rnd() * 201)] : [names[Math.floor(rnd() * names.length)]])), r: ["Grandpa", "Mum", "Savta", W(ROLE_MAX), "The Levins"][i % 5], ...(i % 3 ? { e: 1950 + i } : {}) });
}

productSuite({
  slug: "editions",
  refuse: [{}, { r: "Mum" }, { x: [], r: "Mum" }, { x: [["A"]] }, { x: [["A", 1899]], r: "Mum" }, { x: [["A", 2020, 1]], r: "Mum" }, { x: [[" A"]], r: "Mum" }, { x: [[W(EDITION_NAME_MAX + 1)]], r: "Mum" }, { x: [["A"]], r: W(ROLE_MAX + 1) }, { x: [["A"]], r: "Mum", e: 2101 }, { x: Array.from({ length: EDITIONS_MAX + 1 }, () => ["A"]), r: "Mum" }, { x: [["אבא"]], r: "Mum" }],
  // Eight names of fourteen letters, each two bytes in UTF-8 (the worst case), and their years: the link is the names themselves, as Your Family Tree's (its bound 1,000).
  linkMax: 560,
  longest: { x: Array.from({ length: EDITIONS_MAX }, () => ["Ã".repeat(EDITION_NAME_MAX), 2000]), r: "Ã".repeat(ROLE_MAX), e: 1952 },
  fuzz,
});
