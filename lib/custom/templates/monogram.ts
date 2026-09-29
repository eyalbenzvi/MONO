/**
 * Your Monogram: the initials as interlaced ribbons (lib/custom/draw/monogram,
 * a constructed alphabet: the print font's outlines aren't read, and no other
 * font is licensed here), drawn like the catalogue's ornament designs
 * (rosettes, guilloche): fine double lines, one ink. Three arrangements:
 * side by side and woven ("lace"), one above another in a cascade ("stack"),
 * or woven small inside a round seal whose band is a guilloche
 * (lib/custom/draw/ornament), as a watch dial or a banknote's. The year, when
 * given, sits under it between two rules.
 */
import { INK, captionLines, line, text, type Lines } from "../kit";
import { GLYPHS, interlace, meeting, placedStrokes, type Placed } from "../draw/monogram";
import { guilloche } from "../draw/ornament";
import type { CustomSpec } from "../spec";
import type { Params } from "../specs/monogram";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const CX = 150;

/** The ribbon for letters of cap height h: `share` of it wide, edges a little heavier on big letters, an inline inside, a clear gap at each crossing. */
const ribbon = (h: number, share: number) => {
  const width = h * share;
  return { width, edge: width > 14 ? 1.1 : 0.9, gap: Math.max(1.4, width * 0.16), inner: width > 14 ? width * 0.42 : 0, hair: 0.5 };
};

/** How well a pair interlocks at one placement: a few clean crossings, nothing running alongside, nothing touching without crossing; less overlap preferred. */
function pairScore(a: Placed, b: Placed, width: number, lap: number, mustCross = true): number {
  const m = meeting(a, b, width);
  return Math.min(m.crossings, 4) * 10 - m.poor * 14 - (mustCross && m.crossings === 0 ? 30 : 0) - m.parallel * 0.6 - m.touch * 1.2 - Math.abs(lap) * 12;
}

/** The letters' extent, ribbons included: [x0, y0, x1, y1]. */
function extent(letters: Placed[], width: number): [number, number, number, number] {
  const pts = letters.flatMap((p) => placedStrokes(p).flat());
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  return [Math.min(...xs) - width / 2, Math.min(...ys) - width / 2, Math.max(...xs) + width / 2, Math.max(...ys) + width / 2];
}

/** Letters scaled and moved so their extent is centred on (cx, cy) within w × h. */
function centre(letters: Placed[], width: number, cx: number, cy: number, w: number, h: number): Placed[] {
  const [x0, y0, x1, y1] = extent(letters, width);
  const k = Math.min(w / (x1 - x0), h / (y1 - y0));
  return letters.map((p) => ({ ch: p.ch, x: cx + (p.x - (x0 + x1) / 2) * k, y: cy + (p.y - (y0 + y1) / 2) * k, h: p.h * k }));
}

/**
 * Letters side by side, each interlocking with the last: for each pair the
 * overlap is searched for the placement that crosses a few times, runs
 * nothing alongside and ends no stroke on the other letter. Three letters
 * set in the classic way, the middle one larger. Returns them fitted and
 * centred, with the ribbon width in print units.
 */
function row(chars: string[], cx: number, cy: number, w: number, h: number, share: number): { letters: Placed[]; width: number } {
  const size = chars.length === 3 ? [0.78, 1, 0.78] : chars.map(() => 1);
  const width = share * 100 * Math.min(...size);
  const letters: Placed[] = [];
  chars.forEach((ch, i) => {
    const hh = 100 * size[i], y = -hh / 2;
    if (!i) return letters.push({ ch, x: 0, y, h: hh });
    const prev = letters[i - 1];
    const pw = (GLYPHS[prev.ch].w * prev.h) / 100;
    let best: { p: Placed; score: number } | null = null;
    for (let lap = 0.06; lap <= 0.75; lap += 0.03) {
      const p = { ch, x: prev.x + pw * (1 - lap), y, h: hh };
      let score = pairScore(prev, p, width, lap);
      if (i === 2) score += pairScore(letters[0], p, width, 0) > -20 ? -25 : 0;
      if (!best || score > best.score + 0.5) best = { p, score };
    }
    letters.push(best!.p);
  });
  const placed = centre(letters, width, cx, cy, w, h);
  return { letters: placed, width: (width * placed[0].h) / letters[0].h };
}

/** Letters one above another, alternately left and right, each interlocking with the one above (offset and overlap searched); centred. */
function stack(chars: string[], cx: number, cy: number, w: number, h: number, share: number): { letters: Placed[]; width: number } {
  const width = share * 100;
  const letters: Placed[] = [];
  chars.forEach((ch, i) => {
    const wd = GLYPHS[ch].w;
    if (!i) return letters.push({ ch, x: -wd / 2, y: 0, h: 100 });
    const prev = letters[i - 1];
    let best: { p: Placed; score: number } | null = null;
    for (let lap = -0.24; lap <= 0.45; lap += 0.04)
      for (const off of [0.18, 0.26, 0.1, 0.34, 0.42, 0.5, 0.02]) {
        const side = i % 2 ? 1 : -1;
        const p = { ch, x: -wd / 2 + side * off * 100, y: prev.y + 100 * (1 - lap), h: 100 };
        // A stack needn't weave: it may simply sit, as long as nothing touches or runs alongside.
        const score = pairScore(prev, p, width, lap, false) - (i === 2 ? Math.max(0, -pairScore(letters[0], p, width, 0, false)) : 0);
        if (!best || score > best.score + 0.5) best = { p, score };
      }
    letters.push(best!.p);
  });
  const placed = centre(letters, width, cx, cy, w, h);
  return { letters: placed, width: (width * placed[0].h) / 100 };
}

/** A guilloche medallion behind the letters (their ribbons' ground hides it where they pass), as an engraver sets a cipher on a rose. */
const medallion = (cy: number) => guilloche({ lobes: 9, strands: 4, amps: [0.5, 0.36], cx: CX, cy, inner: 58, span: 64 });

/** The year between two rules, at y. */
function year(y: number, at: number, halfWidth: number): string {
  const s = String(y);
  const tw = s.length * (0.602 * 11 + 4);
  return text(CX + 2, at, s, 11, { bold: true, spacing: 4 }) + line(CX - halfWidth, at - 4, CX - tw / 2 - 8, at - 4, 0.8) + line(CX + tw / 2 + 8, at - 4, CX + halfWidth, at - 4, 0.8);
}

export function monogramBody(p: Params): string {
  const chars = [...p.x];
  const three = chars.length === 3;
  const dated = p.y !== undefined;
  let s = "";
  let placed: { letters: Placed[]; width: number };
  if (p.s === "seal") {
    const cy = 162;
    // The seal: an outer ring, a guilloche band, an inner ring; the letters woven inside.
    s += `<circle cx="${CX}" cy="${cy}" r="124" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
    s += `<circle cx="${CX}" cy="${cy}" r="120" fill="none" stroke="${INK}" stroke-width=".6"/>`;
    s += guilloche({ lobes: 14, strands: 3, amps: [0.42], cx: CX, cy, inner: 94, span: 24 });
    s += `<circle cx="${CX}" cy="${cy}" r="92" fill="none" stroke="${INK}" stroke-width="1"/>`;
    placed = row(chars, CX, cy, three ? 150 : 136, 118, 0.12);
  } else if (p.s === "stack") {
    const cy = dated ? 160 : 171;
    s += medallion(cy);
    placed = stack(chars, CX, cy, 200, dated ? 262 : 280, 0.13);
  } else {
    const cy = dated ? 160 : 172;
    s += medallion(cy);
    placed = row(chars, CX, cy, 232, 220, 0.11);
  }
  s += interlace(placed.letters, ribbonFor(placed.width));
  if (dated) s += year(p.y!, 322, p.s === "seal" ? 80 : p.s === "stack" ? 70 : 90);
  // The caption: the letters, spaced, at the foot; the visitor's own lines under them, smaller.
  const [l1, l2, l3] = captionLines(monogramCaption(p), p.cap);
  if (l1) s += text(CX, 356, l1, 7, { spacing: 2 });
  if (l2) s += text(CX, 367, l2, 6);
  if (l3) s += text(CX, 377, l3, 6);
  return s;
}

/** The caption's lines (ours): the letters, spaced; nothing under them until the visitor writes it. */
export const monogramCaption = (p: Params): Lines => [[...p.x].join(" · "), undefined, undefined];

export const captionOf = (spec: CustomSpec) => monogramCaption((spec as { p: Params }).p);

/** The ribbon at a given width in print units. */
const ribbonFor = (width: number) => ribbon(width, 1);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(monogramBody((spec as { p: Params }).p), color);
