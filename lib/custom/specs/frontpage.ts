/**
 * Your Front Page: a newspaper's front page with you on it. The Daily (your
 * name) in blackletter, the day and the price, your headline huge in the
 * condensed, a standfirst under it (optional), and three columns of our
 * deadpan copy (FRONTPAGE_COPY: thirty paragraphs, your name in some of
 * them), chosen and ordered by a seed of the page. Drawn by
 * lib/custom/templates/frontpage.
 */
import { fitText, type Fit } from "../kit";
import { label, parseDate, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** Whose paper: The Daily (n). */
  n: string;
  /** The headline. */
  h: string;
  /** The standfirst (optional). */
  s?: string;
  /** The day (optional: the late edition). */
  d?: string;
  cap?: Cap;
}

export const NAME = "Your Front Page";
export const PAPER_NAME_MAX = 12;
export const HEADLINE_MAX = 48;
export const STANDFIRST_MAX = 110;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

/** The headline's box: set in the condensed, bold, capitals, as large as fits the width and the height (so the columns keep their room). */
export const HEADLINE = { width: 256, height: 78, size: 40, floor: 18, maxLines: 3, leading: 1.04 };
export function headlineFit(h: string): Fit | null {
  for (let size = HEADLINE.size; size >= HEADLINE.floor; size--) {
    const f = fitText(h.toUpperCase(), HEADLINE.width, { family: "condensed", bold: true, size, floor: size, maxLines: HEADLINE.maxLines });
    if (f && f.lines.length * f.size * HEADLINE.leading <= HEADLINE.height) return f;
  }
  return null;
}
/** The standfirst's box: the serif, two lines at most. */
export const STANDFIRST = { width: 250, size: 8.5, floor: 7, maxLines: 2 };
export const standfirstFit = (s: string) => fitText(s, STANDFIRST.width, { family: "serif", size: STANDFIRST.size, floor: STANDFIRST.floor, maxLines: STANDFIRST.maxLines });

/** Our headlines, offered as the field is typed in. */
export const HEADLINES = [
  "Local girl turns ten, takes it well",
  "Man, 40, still has all his own hair",
  "Woman finishes the crossword, in pen",
  "Grandad finally finds the remote",
  "Family survives the whole holiday",
  "Dad’s barbecue a qualified success",
  "Retirement begins, nobody surprised",
  "First day at school goes to plan",
  "Degree awarded, parents relieved",
  "New baby arrives, household reorganised",
];

/**
 * The columns' copy: ours, a paragraph at a time, {n} where the name goes.
 * The page takes as many as fit, in an order seeded by the page.
 */
export const FRONTPAGE_COPY = [
  "{n} was unavailable for comment on Tuesday, having been, by all accounts, extremely busy with something else.",
  "A spokesperson for {n} confirmed the news, then asked whether anyone had seen the other charger.",
  "Witnesses described the scene as calm, orderly and very slightly damp, which is about as good as it gets round here.",
  "The council has yet to respond. A letter was sent in March and is thought to be in a pile somewhere.",
  "Experts agree it is too early to say. Some said it was too late to say, but they were not the same experts.",
  "Neighbours reported hearing cheering at about half past seven, and again, more faintly, at about eight.",
  "{n} is understood to have taken the whole thing in stride, pausing only to put the kettle on.",
  "Asked what came next, {n} said the plan was to have a sit down and see how everyone felt about it.",
  "Weather: overcast, with bright spells for anyone who deserves them. Winds light, opinions strong.",
  "The family issued a short statement. It read, in full: we always knew. It was then pinned to the fridge.",
  "In other news, the good biscuits have been found. They were behind the tins, where nobody ever looks.",
  "Local residents describe {n} as punctual, thoughtful and, on at least one occasion, right about the parking.",
  "Figures released this morning show a sharp rise in people saying well done, up from none to several.",
  "A small crowd gathered. It then dispersed, as crowds do, towards the sandwiches.",
  "Correspondents on the ground report that morale is high, tea is plentiful and the chairs are adequate.",
  "Historians will no doubt look back on this day. For now, they have been asked to wait in the hall.",
  "The mood at home was described by one insider as quietly jubilant, with a chance of cake later.",
  "Critics were divided. Half called it a triumph. The other half were in the garden and missed it.",
  "{n} thanked everyone involved, and several people who were not involved but had turned up anyway.",
  "Traffic on the stairs was heavy throughout the afternoon but eased by teatime.",
  "It is not the first time {n} has made the front page. It is, however, the first time on purpose.",
  "Our reporter asked for a quote. {n} said no, then relented and said something about the dog.",
  "Readers wishing to send congratulations may do so in person, by post, or by doing the washing up.",
  "This paper understands that further announcements are expected, possibly after lunch.",
  "Letters to the editor on the subject have been mostly positive. One was about the hedge.",
  "A full inquiry has been ruled out on the grounds that everyone already knows what happened.",
  "Scientists say the odds were long. {n} says the odds were fine and the scientists should relax.",
  "Photographs of the event will be shown to anyone who stands still long enough.",
  "Sport: nobody won anything, but everyone ran about a bit, which was felt to be the main thing.",
  "Continued on page two, which has not yet been written but is expected to be quite good.",
];

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!label(p.n, PAPER_NAME_MAX)) return null;
  if (!label(p.h, HEADLINE_MAX) || !headlineFit(p.h as string)) return null;
  if (p.s !== undefined && (!label(p.s, STANDFIRST_MAX) || !standfirstFit(p.s as string))) return null;
  if (p.d !== undefined && !parseDate(p.d)) return null;
  return { n: p.n as string, h: p.h as string, ...(p.s !== undefined ? { s: p.s as string } : {}), ...(p.d !== undefined ? { d: p.d as string } : {}) };
}

export const detail = (p: Params) => `The Daily ${p.n}`;

export const PRODUCT: ProductMeta<Params> = {
  line: "The front page of a newspaper that only ever covers you.",
  from: "Your name and your headline",
  group: "form",
  base: "type-data",
  bases: ["type-data", "poster"],
  wordsHint: "Noa",
  hints: { dense: "Try a shorter headline.", faint: "Try a longer headline." },
  example: { n: "Noa", h: "Local girl turns ten, takes it well", s: "Cake described as adequate. Party runs late. Neighbours consulted, found to be mostly fine about it.", d: "2019-06-02" },
};
