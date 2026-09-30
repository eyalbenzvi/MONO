import { expect, it } from "vitest";
import { productSuite } from "./productSuite";
import { CLAUSES_MAX, CLAUSES_MIN, CLAUSE_MAX, HEAD_MAX, ITEMS_MAX, ITEM_MAX, QUOTE_MAX, RECEIPT_ITEMS, REVIEWER_MAX, REVIEW_QUOTES, TERMS_CLAUSES, quoteFit, termsFit } from "@/lib/custom/specs/receipt";
import { lexiconRefusal } from "./lexiconOf";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
const rnd = mulberry32(0x5ec1);
const pick = <T,>(xs: readonly T[], n: number) => Array.from({ length: n }, () => xs[Math.floor(rnd() * xs.length)]);
const fuzz: Record<string, unknown>[] = [
  { k: "receipt", h: "A", x: ["B"], d: "2016-08-14" },
  { k: "receipt", h: W(HEAD_MAX), x: Array.from({ length: ITEMS_MAX }, () => W(ITEM_MAX)), d: "2100-12-31" },
  { k: "terms", h: "Rules", x: ["Be kind.", "Be home.", "Be quiet."] },
  { k: "terms", h: W(HEAD_MAX), x: TERMS_CLAUSES.slice(0, CLAUSES_MAX), d: "1900-01-01" },
  { k: "review", n: 1, q: "OK", by: "A" },
  { k: "review", n: 5, q: REVIEW_QUOTES[0], by: W(REVIEWER_MAX), y: 2016 },
];
for (let i = 0; i < 30; i++) {
  if (i % 3 === 0) fuzz.push({ k: "receipt", h: ["Noa & Dan", "The Levins", W(HEAD_MAX)][i % 3 ? 1 : 0], x: pick(RECEIPT_ITEMS, 1 + Math.floor(rnd() * ITEMS_MAX)), d: `20${10 + (i % 15)}-0${1 + (i % 9)}-1${i % 9}` });
  else if (i % 3 === 1) fuzz.push({ k: "terms", h: ["The Terms of Us", "House Rules", "Rules"][i % 3], x: pick(TERMS_CLAUSES, CLAUSES_MIN + Math.floor(rnd() * (CLAUSES_MAX - CLAUSES_MIN + 1))), ...(i % 2 ? { d: "2016-08-14" } : {}) });
  else fuzz.push({ k: "review", n: 1 + (i % 5), q: pick(REVIEW_QUOTES, 1)[0], by: ["Noa", "Dan", "Jean-Luc O'Neill"][i % 3], ...(i % 2 ? { y: 1990 + i } : {}) });
}

productSuite({
  slug: "receipt",
  refuse: [
    {}, { k: "bill", h: "A", x: ["B"], d: "2016-08-14" },
    { k: "receipt", h: "A", x: ["B"] }, { k: "receipt", h: "A", x: [], d: "2016-08-14" }, { k: "receipt", h: "A", x: Array.from({ length: ITEMS_MAX + 1 }, () => "B"), d: "2016-08-14" }, { k: "receipt", h: "A", x: [W(ITEM_MAX + 1)], d: "2016-08-14" }, { k: "receipt", h: "A", x: ["B"], d: "2016-08-14", n: 5 },
    { k: "terms", h: "A", x: ["a", "b"] }, { k: "terms", h: "A", x: Array.from({ length: CLAUSES_MAX + 1 }, () => "a") }, { k: "terms", h: "A", x: ["a", "b", W(CLAUSE_MAX + 1)] }, { k: "terms", x: ["a", "b", "c"] },
    { k: "review", n: 0, q: "OK", by: "A" }, { k: "review", n: 6, q: "OK", by: "A" }, { k: "review", n: 5, q: W(QUOTE_MAX + 1), by: "A" }, { k: "review", n: 5, q: "OK" }, { k: "review", n: 5, q: "OK", by: "A", h: "B" }, { k: "review", n: 5, q: "OK", by: "A", y: 2101 },
  ],
  // Six clauses of forty-eight characters in two-byte letters (the worst case, 900; eight receipt items so, 618): the link is the clauses themselves.
  linkMax: 920,
  longest: { k: "terms", h: "Ã".repeat(HEAD_MAX), x: Array.from({ length: CLAUSES_MAX }, () => "Ãããããã ".repeat(7).trim().slice(0, CLAUSE_MAX)), d: "2016-08-14" },
  fuzz,
});

it("our sixty lines fit, print and pass the lexicon", () => {
  expect(RECEIPT_ITEMS.length + TERMS_CLAUSES.length + REVIEW_QUOTES.length).toBe(60);
  for (const l of [...RECEIPT_ITEMS, ...TERMS_CLAUSES, ...REVIEW_QUOTES]) expect(lexiconRefusal(l), l).toBeNull();
  for (const l of RECEIPT_ITEMS) expect(l.length, l).toBeLessThanOrEqual(ITEM_MAX);
  for (const l of TERMS_CLAUSES) expect(l.length, l).toBeLessThanOrEqual(CLAUSE_MAX);
  for (const l of REVIEW_QUOTES) expect(l.length, l).toBeLessThanOrEqual(QUOTE_MAX);
  for (const q of REVIEW_QUOTES) expect(quoteFit(q), q).not.toBeNull();
  expect(termsFit(TERMS_CLAUSES.slice(0, CLAUSES_MAX))).not.toBeNull();
  // Any six of our clauses fit together (the longest six).
  expect(termsFit([...TERMS_CLAUSES].sort((a, b) => b.length - a.length).slice(0, CLAUSES_MAX))).not.toBeNull();
});
