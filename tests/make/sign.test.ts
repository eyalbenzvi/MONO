import { productSuite } from "./productSuite";
import { PICTOGRAMS } from "@/lib/custom/draw/pictograms";
import { ARC_MAX, PLAQUE_LINES, PLAQUE_LINE_MAX, SIGN_LINE_MAX, STREET_MAX } from "@/lib/custom/specs/sign";

const W = (n: number) => "W".repeat(n);
const fuzz: Record<string, unknown>[] = [
  { s: "street", n: "A" },
  { s: "street", n: W(STREET_MAX), l: W(SIGN_LINE_MAX) },
  { s: "street", n: "Maya Lane", l: "No through road" },
  { s: "street", n: "Rue de la Paix" },
  { s: "plaque", n: "A", x: ["b"] },
  { s: "plaque", n: W(ARC_MAX), x: Array.from({ length: PLAQUE_LINES }, () => W(PLAQUE_LINE_MAX)) },
  { s: "plaque", n: "Maya Cohen lived here", x: ["Reader of maps", "and eater of toast", "1990 to date"] },
  { s: "plaque", n: "Dad fell asleep here", x: ["Sunday, 3 p.m."] },
];
PICTOGRAMS.forEach((pc, i) => {
  fuzz.push({ s: "warning", pc, l: ["Hi", W(SIGN_LINE_MAX), "Not before the first coffee", "Mind the dog"][i % 4], ...(i % 2 ? { pn: 1 } : {}) });
  fuzz.push({ s: "warning", pc, l: "Caution: teenager", ...(i % 2 ? {} : { pn: 1 }) });
});

productSuite({
  slug: "sign",
  refuse: [
    {}, { s: "billboard", n: "A" }, { s: "street" }, { s: "street", n: W(STREET_MAX + 1) }, { s: "street", n: "A", x: ["b"] },
    { s: "plaque", n: "A" }, { s: "plaque", n: "A", x: [] }, { s: "plaque", n: "A", x: ["a", "b", "c", "d"] }, { s: "plaque", n: W(ARC_MAX + 1), x: ["b"] },
    { s: "warning", pc: "cat", l: "Hi" }, { s: "warning", pc: "mug" }, { s: "warning", pc: "mug", l: "Hi", pn: 2 }, { s: "warning", pc: "mug", l: "Hi", n: "A" },
  ],
  // The plaque's words and its three lines at their longest in two-byte letters (the worst case, 330): the link is the words themselves.
  linkMax: 420,
  longest: { s: "plaque", n: "Ã".repeat(ARC_MAX), x: Array.from({ length: PLAQUE_LINES }, () => "Ã".repeat(PLAQUE_LINE_MAX)) },
  fuzz,
});
