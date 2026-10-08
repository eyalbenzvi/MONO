/**
 * The moon's phase for every day of a year, month by month, at 00:00 UTC.
 * Drawn as seen from the north (waxing lit on the right); from the south the
 * lit side is the other one, so every moon is mirrored.
 */
import { moonPhase } from "../astro";
import { INK, STROKE, caption, captionLines, circle, dot, f1, julian, line, shortMonth, text, type Lines } from "../kit";
import type { Cap } from "../specKit";

/**
 * The lit part of a small moon (as seen from the north: waxing lit on the right; `south` mirrors it).
 * `minGap`: the narrowest dark sliver left showing between a gibbous moon's fill and its outline
 * (a hairline there reads as a doubled rim); 0, as drawn before.
 */
export function moonShape(cx: number, cy: number, r: number, k: number, waxing: boolean, south = false, outline = 0.45, minGap = 0): string {
  const s = circle(cx, cy, r, outline);
  if (k < 0.03) return s;
  if (k > 0.97) return s + dot(cx, cy, r);
  let rx = Math.abs(1 - 2 * k) * r;
  if (minGap > 0 && k > 0.5) rx = Math.min(rx, r - outline / 2 - minGap);
  const top = `${f1(cx)} ${f1(cy - r)}`, bottom = `${f1(cx)} ${f1(cy + r)}`;
  // Seen from the south the lit side swaps: the same shape as a waning (waxing) moon from the north.
  const right = waxing !== south;
  const d = right
    ? `M${top}A${f1(r)} ${f1(r)} 0 0 1 ${bottom}A${f1(rx)} ${f1(r)} 0 0 ${k > 0.5 ? 1 : 0} ${top}Z`
    : `M${top}A${f1(r)} ${f1(r)} 0 0 0 ${bottom}A${f1(rx)} ${f1(r)} 0 0 ${k > 0.5 ? 0 : 1} ${top}Z`;
  return s + `<path d="${d}" fill="${INK}"/>`;
}

export interface MoonInput {
  year: number;
  south?: boolean;
  /** The customer's words: the caption's first line (the year moves to the next). */
  words?: string;
  /** The Make print's calendar (the live area, house type and strokes); absent, the catalogue's, byte for byte. */
  make?: boolean;
  /** A day ringed and named under its moon (the catalogue's 1969: 20 July, Apollo 11); its moons drawn with a clean rim. */
  mark?: { mo: number; d: number; label: string };
}

/** The caption's lines (ours): the words and the year, or the year alone; the side it's seen from. */
export function moonCaption({ year, south = false, words }: MoonInput): Lines {
  const side = south ? "Waxing lit on the left, as seen from the south" : "Waxing lit on the right, as seen from the north";
  return words ? [words, `${year} · every day at 00:00 UTC`, side] : [`Moon ${year}`, "Every day at 00:00 UTC", side];
}

/** The year's calendar of moons and its caption (with the visitor's own lines, `cap`): the print's body (white ink, unwrapped). */
export function moonBody(input: MoonInput, cap?: Cap): string {
  const { year, south = false } = input;
  if (input.make) return makeCalendar(year, south) + caption(318, ...captionLines(moonCaption(input), cap));
  // The catalogue's 1969 marks its reason: the day of the first landing.
  const mark = input.mark ?? (year === 1969 ? { mo: 7, d: 20, label: "20 JULY · APOLLO 11" } : undefined);
  let body = "";
  const X = 42, DX = 7.6, Y = 62, DY = 19.5, R = 3.4;
  for (const d of [1, 5, 10, 15, 20, 25, 30]) body += text(X + (d - 1) * DX, Y - 10, String(d), 5.5);
  for (let mo = 1; mo <= 12; mo++) {
    const y = Y + (mo - 1) * DY;
    body += text(X - 12, y + 2, shortMonth(mo), 6, { anchor: "end" });
    const days = new Date(Date.UTC(year, mo, 0)).getUTCDate();
    for (let d = 1; d <= days; d++) {
      const { k, waxing } = moonPhase(julian(year, mo, d, 0, 0));
      body += moonShape(X + (d - 1) * DX, y, R, k, waxing, south, 0.45, mark ? 0.6 : 0);
    }
  }
  if (mark) {
    const { mo, d, label } = mark;
    const [x, y] = [X + (d - 1) * DX, Y + (mo - 1) * DY];
    // A pointer above the day and a line down to its name, clear of the neighbouring moons.
    body += `<path d="M${f1(x - 2.2)} ${f1(y - R - 4.6)}L${f1(x + 2.2)} ${f1(y - R - 4.6)}L${f1(x)} ${f1(y - R - 1.4)}Z" fill="${INK}"/>`;
    body += line(x, y + R + 1.4, x, y + R + 4.6, 0.6) + text(x, y + R + 10, label, 4.8, { bold: true, spacing: 0.4 });
  }
  body += caption(318, ...captionLines(moonCaption(input), cap));
  return body;
}

/**
 * The Make print's calendar: the grid spread over the live area (the months'
 * names at its left edge, day 31 at its right), a hairline rule under the
 * days and one closing the table, the days and months in tracked Plex, and
 * the moons' outlines on the hairline of the stroke scale.
 */
function makeCalendar(year: number, south: boolean): string {
  const [L, RIGHT, R] = [22, 278, 3.2];
  const X = 41.5, DX = (RIGHT - R - X) / 30, Y = 60, DY = 20;
  let body = "";
  const head = Y - 14;
  for (const d of [1, 5, 10, 15, 20, 25, 30]) body += text(X + (d - 1) * DX, head, String(d), 5, { spacing: 0.3 });
  body += line(L, head + 4.5, RIGHT, head + 4.5, STROKE.hairline);
  for (let mo = 1; mo <= 12; mo++) {
    const y = Y + (mo - 1) * DY;
    body += text(L, y + (0.698 * 5.5) / 2, shortMonth(mo), 5.5, { anchor: "start", spacing: 0.66 });
    const days = new Date(Date.UTC(year, mo, 0)).getUTCDate();
    for (let d = 1; d <= days; d++) {
      const { k, waxing } = moonPhase(julian(year, mo, d, 0, 0));
      body += moonShape(X + (d - 1) * DX, y, R, k, waxing, south, STROKE.hairline);
    }
  }
  body += line(L, Y + 11 * DY + 10, RIGHT, Y + 11 * DY + 10, STROKE.hairline);
  return body;
}
