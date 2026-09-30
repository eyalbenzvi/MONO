import { productSuite } from "./productSuite";
import { SAYER_MAX, SAYINGS_MAX, SAYINGS_MIN, SAYING_MAX, WORD_MAX } from "@/lib/custom/specs/sayings";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
const rnd = mulberry32(0x5a71);
const pool = ["Put a jumper on.", "Eat something.", "Call when you get there.", "It’s not a problem, it’s a situation.", "Who ate the last yoghurt?", "Mind the step.", "In my day we walked.", W(SAYING_MAX), "Yes.", "Because I said so, that’s why, OK?", "Ask your father."];
const fuzz: Record<string, unknown>[] = [
  { n: "A", x: ["a", "b", "c"] },
  { n: W(SAYER_MAX), x: Array.from({ length: SAYINGS_MAX }, () => W(SAYING_MAX)) },
  { k: "first", n: "A", o: "a" },
  { k: "first", n: W(SAYER_MAX), o: W(WORD_MAX), d: "2020-03-01" },
  { k: "first", n: "Noa", o: "Mama" },
];
for (let i = 0; i < 36; i++) {
  if (i % 4 === 3) fuzz.push({ k: "first", n: ["Noa", "Jean-Luc", W(SAYER_MAX)][i % 3], o: ["Dada", "Banana", "No", "Wwwwwwwwwwwwwwww", "Uh-oh"][i % 5], ...(i % 2 ? { d: "2021-07-14" } : {}) });
  else fuzz.push({ n: ["Savta", "Dad", W(SAYER_MAX), "Mr O'Neill"][i % 4], x: Array.from({ length: SAYINGS_MIN + Math.floor(rnd() * (SAYINGS_MAX - SAYINGS_MIN + 1)) }, () => pool[Math.floor(rnd() * pool.length)]) });
}

productSuite({
  slug: "sayings",
  refuse: [{}, { n: "Savta" }, { n: "Savta", x: ["a", "b"] }, { n: "Savta", x: Array.from({ length: SAYINGS_MAX + 1 }, () => "a") }, { n: "Savta", x: ["a", "b", W(SAYING_MAX + 1)] }, { n: W(SAYER_MAX + 1), x: ["a", "b", "c"] }, { k: "first", n: "Noa" }, { k: "first", n: "Noa", o: W(WORD_MAX + 1) }, { k: "first", n: "Noa", o: "Mama", d: "2020-13-01" }, { k: "first", n: "Noa", o: "Mama", x: ["a", "b", "c"] }, { n: "Savta", x: ["a", "b", "c"], o: "Mama" }, { k: "last", n: "Noa", o: "Mama" }, { n: "Savta", x: ["a", "b", "שלום"] }],
  // Seven sayings of forty characters in two-byte letters (the worst case): the link is the sayings themselves.
  linkMax: 900,
  longest: { n: "Ã".repeat(SAYER_MAX), x: Array.from({ length: SAYINGS_MAX }, () => "Ãããããããã ".repeat(4).trim().slice(0, SAYING_MAX)) },
  fuzz,
  // A word wider than the column can't be set: refused (the editor says it's too long).
  mayRefuse: (p) => ((p.x as string[] | undefined) ?? []).some((t) => t.split(" ").some((w) => w.length > 24)),
});
