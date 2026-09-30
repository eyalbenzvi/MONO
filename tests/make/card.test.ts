import { productSuite } from "./productSuite";
import { CARD_CONTACT_MAX, CARD_LINE_MAX, CARD_NAME_MAX, CARD_STYLES } from "@/lib/custom/specs/card";

const W = (n: number) => "W".repeat(n);
const lines = [
  ["Maya Cohen", "Head of Snacks", "The Kitchen", "Available most evenings"],
  ["Al", "Me", "Us", undefined],
  [W(CARD_NAME_MAX), W(CARD_LINE_MAX), W(CARD_LINE_MAX), W(CARD_CONTACT_MAX)],
  ["Jean-Luc O'Neill", "Chief Worrier", "Family Ltd.", "Ring twice"],
  ["Dad", "Keeper of the Remote", "The Sofa", undefined],
  ["i", "i", "i", "i"],
  ["Savta", "Director of Soup", "Friday Nights & Co.", "Doors open at six"],
  ["Noa", "Intern, unpaid", "Big Sister Holdings", undefined],
];
const fuzz = CARD_STYLES.flatMap((s) => lines.map(([n, ti, co, ct]) => ({ n, ti, co, ...(ct ? { ct } : {}), s })));

productSuite({
  slug: "card",
  refuse: [{}, { n: "Maya", ti: "Boss", co: "Home" }, { n: "Maya", ti: "Boss", s: "classic" }, { n: "Maya", ti: "Boss", co: "Home", s: "gold" }, { n: W(CARD_NAME_MAX + 1), ti: "Boss", co: "Home", s: "classic" }, { n: "Maya", ti: W(CARD_LINE_MAX + 1), co: "Home", s: "classic" }, { n: "Maya", ti: "Boss", co: "Home", ct: W(CARD_CONTACT_MAX + 1), s: "classic" }, { n: "Maya", ti: "Boss", co: "Home", ct: "", s: "classic" }, { n: "Maya", ti: "Boss", co: "Home", ct: "a@b", s: "classic" }],
  longest: { n: "Ã".repeat(CARD_NAME_MAX), ti: "Ã".repeat(CARD_LINE_MAX), co: "Ã".repeat(CARD_LINE_MAX), ct: "Ã".repeat(CARD_CONTACT_MAX), s: "classic" },
  // Four free lines (116 characters) in two-byte letters, the worst case: the link is the card's own words.
  linkMax: 420,
  fuzz,
});
