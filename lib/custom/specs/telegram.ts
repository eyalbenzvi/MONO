/**
 * Your Telegram: a telegram form, filled in. To, from, the day it was sent
 * and a message of up to TELEGRAM_MAX characters, set in capitals on pasted
 * strips with every full stop printed as STOP. Drawn by
 * lib/custom/templates/telegram.
 */
import { textWidth, wrapWords, type Fit } from "../kit";
import { cleanWords, label, parseDate, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** Who it's to. */
  to: string;
  /** Who it's from (absent: no sender). */
  fr?: string;
  /** The day it was sent (absent: the form's date left blank). */
  d?: string;
  /** The message as typed (the words' rule, TELEGRAM_MAX characters); it prints in capitals. */
  m: string;
  cap?: Cap;
}

export const NAME = "Your Telegram";
export const TELEGRAM_MAX = 160;
export const TELEGRAM_NAME_MAX = 20;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

/** The message as the clerk sets it: capitals, and each full stop a word of its own. */
export const telegramWords = (m: string) =>
  m
    .toUpperCase()
    .replace(/\.+(\s|$)/g, " STOP ")
    .replace(/\s+/g, " ")
    .trim();

/** The strips' box: their width, and the height the message has. */
export const STRIPS = { w: 222, h: 124 };
/** A strip's pitch, in its type size (the strip and the gap under it). */
export const STRIP_PITCH = 2.15;

/**
 * The message set on strips: the largest size (11 down to 7) whose lines fit
 * the box; null when even the smallest can't (the editor says so).
 */
export function telegramFit(m: string): Fit | null {
  const words = telegramWords(m);
  for (let size = 11; size >= 7; size -= 0.5) {
    const lines = wrapWords(words, STRIPS.w, size);
    if (lines && lines.length * size * STRIP_PITCH <= STRIPS.h && lines.every((l) => textWidth(l, size) <= STRIPS.w)) return { lines, size };
  }
  return null;
}

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!label(p.to, TELEGRAM_NAME_MAX)) return null;
  if (p.fr !== undefined && !label(p.fr, TELEGRAM_NAME_MAX)) return null;
  if (p.d !== undefined && !parseDate(p.d)) return null;
  if (typeof p.m !== "string" || cleanWords(p.m, TELEGRAM_MAX) !== p.m || !telegramFit(p.m)) return null;
  return { to: p.to as string, ...(p.fr !== undefined ? { fr: p.fr as string } : {}), ...(p.d !== undefined ? { d: p.d as string } : {}), m: p.m };
}

export const detail = (p: Params) => `To ${p.to}`;

export const PRODUCT: ProductMeta<Params> = {
  line: "A telegram, with the full stops charged as words.",
  from: "A message of up to 160 characters",
  group: "form",
  base: "terminal-data",
  bases: ["terminal-data"],
  hints: { dense: "Try a shorter message.", faint: "Try a longer message." },
  example: { to: "Noa", fr: "Dad", d: "2019-06-02", m: "Arrived safely. Weather fair. Hotel has a lift. Miss you already. Home Tuesday." },
};
