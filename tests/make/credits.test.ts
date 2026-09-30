import { productSuite } from "./productSuite";
import { CREDITS_MAX, CREDITS_MIN, CREDIT_NAME_MAX, FAMILY_MAX, ROLE_MAX } from "@/lib/custom/specs/credits";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
const rnd = mulberry32(0xc4ed);
const roles = ["Directed by", "Produced by", "Catering", "Stunts", "Continuity", "Noise", "Best boy", "Key grip", W(ROLE_MAX), "Lighting"];
const names = ["Mum", "Dad", "Savta", "Ari", "Noa", "Max the dog", W(CREDIT_NAME_MAX), "Jean-Luc", "i"];
const fuzz: Record<string, unknown>[] = [
  { f: "Li", x: [["By", "Me"], ["a", "b"]] },
  { f: W(FAMILY_MAX), x: Array.from({ length: CREDITS_MAX }, () => [W(ROLE_MAX), W(CREDIT_NAME_MAX)]), y: 2100 },
];
for (let i = 0; i < 36; i++) {
  const n = CREDITS_MIN + Math.floor(rnd() * (CREDITS_MAX - CREDITS_MIN + 1));
  fuzz.push({ f: ["Cohen", "Levi", W(FAMILY_MAX), "O'Neill-Smith"][i % 4], x: Array.from({ length: n }, () => [roles[Math.floor(rnd() * roles.length)], names[Math.floor(rnd() * names.length)]]), ...(i % 2 ? { y: 1990 + i } : {}) });
}

productSuite({
  slug: "credits",
  refuse: [{}, { f: "Cohen" }, { f: "Cohen", x: [["By", "Me"]] }, { x: [["By", "Me"], ["a", "b"]] }, { f: "Cohen", x: [["By"], ["a", "b"]] }, { f: "Cohen", x: [["By", ""], ["a", "b"]] }, { f: W(FAMILY_MAX + 1), x: [["By", "Me"], ["a", "b"]] }, { f: "Cohen", x: [[W(ROLE_MAX + 1), "Me"], ["a", "b"]] }, { f: "Cohen", x: Array.from({ length: CREDITS_MAX + 1 }, () => ["a", "b"]) }, { f: "Cohen", x: [["By", "Me"], ["a", "b"]], y: 1899 }],
  // Twelve roles of twelve characters and names of thirteen in two-byte letters (the worst case): the link is the credits themselves.
  linkMax: 1040,
  longest: { f: "Ã".repeat(FAMILY_MAX), x: Array.from({ length: CREDITS_MAX }, () => ["Ã".repeat(ROLE_MAX), "Ã".repeat(CREDIT_NAME_MAX)]), y: 2026 },
  fuzz,
});
