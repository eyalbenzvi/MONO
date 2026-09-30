/**
 * Your First Message: the first messages between two people as chat bubbles,
 * theirs on the left and yours on the right, MESSAGES_MIN to MESSAGES_MAX with their
 * times, a divider with the day and a read line. Generic bubbles, no app's
 * look. Drawn by lib/custom/templates/message.
 */
import { fitText, type Fit } from "../kit";
import { int, label, parseDate, parseTime, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

/** A message: whose (0 theirs, on the left; 1 yours), what, and when ("21:04"). */
export type Message = [side: 0 | 1, text: string, time: string];

export interface Params {
  m: Message[];
  /** Who it's with, at the top (optional). */
  n?: string;
  /** The day, on the divider (optional). */
  d?: string;
  cap?: Cap;
}

export const NAME = "Your First Message";
/** A first exchange: two messages at least (one alone left the frame empty and read as flat to the gate). */
export const MESSAGES_MIN = 2;
export const MESSAGES_MAX = 6;
export const MESSAGE_MAX = 48;
export const WITH_MAX = 16;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

/** A bubble's widest text, and the height the bubbles share. */
export const BUBBLE_W = 168;
export const THREAD_H = 184;

/** The messages set together: one size for all (12 down to 8), each on at most four lines, the thread within its height; null when it can't be. */
export function threadFit(m: readonly Message[]): { size: number; fits: Fit[] } | null {
  for (let size = 12; size >= 8; size -= 0.5) {
    const fits = m.map(([, t]) => fitText(t, BUBBLE_W, { size, floor: size, maxLines: 4, family: "serif" }));
    if (fits.some((f) => !f)) continue;
    const h = fits.reduce((a, f) => a + f!.lines.length * size * 1.25 + size * 1.1 + size * 1.25, 0);
    if (h <= THREAD_H) return { size, fits: fits as Fit[] };
  }
  return null;
}

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!Array.isArray(p.m) || p.m.length < MESSAGES_MIN || p.m.length > MESSAGES_MAX) return null;
  for (const e of p.m as unknown[]) if (!Array.isArray(e) || e.length !== 3 || !int(e[0], 0, 1) || !label(e[1], MESSAGE_MAX) || !parseTime(e[2])) return null;
  const m = (p.m as Message[]).map(([s, t, h]) => [s, t, h] as Message);
  if (!threadFit(m)) return null;
  if (p.n !== undefined && !label(p.n, WITH_MAX)) return null;
  if (p.d !== undefined && !parseDate(p.d)) return null;
  return { m, ...(p.n !== undefined ? { n: p.n as string } : {}), ...(p.d !== undefined ? { d: p.d as string } : {}) };
}

export const detail = (p: Params) => (p.n ? `With ${p.n}` : `${p.m.length} messages`);

export const PRODUCT: ProductMeta<Params> = {
  line: "The first messages you sent each other, kept.",
  from: "Your first messages",
  group: "people",
  base: "type-data",
  bases: ["type-data"],
  wordsHint: "Dan",
  hints: { dense: "Try fewer or shorter messages.", faint: "Try another message or two." },
  example: {
    n: "Dan",
    d: "2016-08-14",
    m: [
      [0, "Hi. Was that you with the umbrella?", "21:02"],
      [1, "It was. Sorry about your shoes.", "21:04"],
      [0, "They were old shoes.", "21:04"],
      [1, "Coffee, to make up for them?", "21:07"],
      [0, "Go on then.", "21:12"],
    ],
  },
};
