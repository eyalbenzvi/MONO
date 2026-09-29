import { expect, it } from "vitest";
import { productSuite } from "./productSuite";
import { LABEL_CREDITS, LABEL_LINE_MAX, LABEL_MEDIUMS, LABEL_NAME_MAX, LABEL_PLACE_MAX, creditFit, mediumFit } from "@/lib/custom/specs/label";
import { accession } from "@/lib/custom/templates/label";
import { lexiconRefusal } from "./lexiconOf";

const W = (n: number) => "W".repeat(n);
const fuzz: Record<string, unknown>[] = [
  { n: "Al", md: "Tea" },
  { n: W(LABEL_NAME_MAX), b: 1900, pl: W(LABEL_PLACE_MAX), md: "Pencil on the wall, since removed, twice", cr: "Lent by the artist, who wants it back, x", d: "2100-12-31" },
];
LABEL_MEDIUMS.forEach((md, i) => fuzz.push({ n: ["Maya Cohen", "Dad", "Jean-Luc O'Neill", W(LABEL_NAME_MAX)][i % 4], ...(i % 2 ? { b: 1950 + i } : {}), ...(i % 3 ? { pl: "Tel Aviv" } : {}), md, cr: LABEL_CREDITS[i], ...(i % 4 ? { d: "2019-06-02" } : {}) }));

productSuite({
  slug: "label",
  refuse: [{}, { n: "Maya" }, { md: "Tea" }, { n: W(LABEL_NAME_MAX + 1), md: "Tea" }, { n: "Maya", md: W(LABEL_LINE_MAX + 1) }, { n: "Maya", md: "Tea", b: 1899 }, { n: "Maya", md: "Tea", pl: "" }, { n: "Maya", md: "Tea", cr: "" }, { n: "Maya", md: "Tea", d: "2019-02-29" }, { n: "Maya", md: "WWWWWWWWW WWWWWWWWWW WWWWWWWWWW WWWWWWWW" }],
  // Four free lines (124 characters) in two-byte letters, the worst case: the link is the label's own words (in plain letters, 275).
  linkMax: 440,
  longest: { n: "Ã".repeat(LABEL_NAME_MAX), b: 1990, pl: "Ã".repeat(LABEL_PLACE_MAX), md: "Ããããã ".repeat(7).trim().slice(0, LABEL_LINE_MAX), cr: "Ããããã ".repeat(7).trim().slice(0, LABEL_LINE_MAX), d: "2019-06-02" },
  fuzz,
});

it("our lines fit, print, and pass the lexicon", () => {
  expect(LABEL_MEDIUMS.length + LABEL_CREDITS.length).toBeGreaterThanOrEqual(40);
  for (const l of LABEL_MEDIUMS) expect(mediumFit(l), l).not.toBeNull();
  for (const l of LABEL_CREDITS) expect(creditFit(l), l).not.toBeNull();
  for (const l of [...LABEL_MEDIUMS, ...LABEL_CREDITS]) expect(lexiconRefusal(l), l).toBeNull();
});

it("the accession number is the year and the day of that year", () => {
  expect(accession("2019-06-02")).toBe("2019.153");
  expect(accession("2020-12-31")).toBe("2020.366");
  expect(accession("2021-01-01")).toBe("2021.001");
});
