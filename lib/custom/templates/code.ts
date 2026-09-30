/**
 * Your Name: a name in one of the machine's or the hand's codes (the
 * catalogue's Terminal and Type prints, lib/custom/draw/code), filling the
 * print area: every code runs the name again and again (across the card's 80
 * columns, down a loop of tape, along lines of type), so a short name still
 * makes a whole print. The
 * plain letters sit small in the caption; "Keep it secret" leaves them out
 * everywhere (the code alone, and the code's own name as the title).
 */
import { CAP, STROKE, caption, captionLines, circle, dot, f1, line, path, polyline, text, turnedText, type Lines, house } from "../kit";
import { ITA2, binaryText, brailleCell, brailleEncode, morseEncode, morseMarks, punchCard } from "../draw/code";
import { CODE_NAMES, type CodeKind, type CodeParams } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";
import type { CustomSpec } from "../spec";

/** The area a code fills (above the caption). */
const BOX = { x: 22, y: 22, w: 256, h: 286 };
const STANDARD: Record<CodeKind, string> = {
  card: "IBM 029 · 80 columns",
  tape: "ITA2 · five holes",
  morse: "International Morse",
  braille: "Six-dot braille",
  binary: "ASCII · eight bits",
};

/** A block drawn at its own size, scaled (at most `max`) and centred into BOX. */
function fitted(body: string, bb: { x: number; y: number; w: number; h: number }, max = 4): string {
  const k = Math.min(BOX.w / bb.w, BOX.h / bb.h, max);
  const tx = BOX.x + (BOX.w - bb.w * k) / 2 - bb.x * k;
  const ty = BOX.y + (BOX.h - bb.h * k) / 2 - bb.y * k;
  return `<g transform="translate(${f1(tx)} ${f1(ty)}) scale(${Math.round(k * 1000) / 1000})">${body}</g>`;
}

/** The name, then a space, again and again until at least `n` characters (at least once whole); a name of one or two characters runs on without the space. */
const loop = (x: string, n: number) => {
  const sep = x.length < 3 ? "" : " ";
  let s = x;
  while (s.length < n) s += `${sep}${x}`;
  return s;
};

/** ITA2's figures shift: the same five holes read as digits and signs after FIGS (11011), letters again after LTRS (11111). */
const FIGURES: Record<string, string> = {
  "1": "11101", "2": "11001", "3": "10000", "4": "01010", "5": "00001", "6": "10101", "7": "11100", "8": "01100", "9": "00011", "0": "01101",
  "-": "11000", "?": "10011", ":": "01110", "(": "11110", ")": "01001", ".": "00111", ",": "00110", "'": "11010", "/": "10111", "+": "10001", "=": "01111",
};
const LTRS = "11111";
const FIGS = "11011";

/** Frames of tape for a text: letters, figures after a shift, the shift punched too. */
function tapeFrames(s: string): { bits: string; ch: string | null }[] {
  const out: { bits: string; ch: string | null }[] = [];
  let figs = false;
  for (const ch of s) {
    if (ch === " ") out.push({ bits: ITA2[" "], ch: null });
    else if (ITA2[ch]) {
      if (figs) out.push({ bits: LTRS, ch: null }), (figs = false);
      out.push({ bits: ITA2[ch], ch });
    } else if (FIGURES[ch]) {
      if (!figs) out.push({ bits: FIGS, ch: null }), (figs = true);
      out.push({ bits: FIGURES[ch], ch });
    }
  }
  return out;
}

/**
 * The tape as it lies on the bench: one length folded flat into four strips
 * (two 45° folds turn it back each time, so it rises and falls), the name
 * punched all the way along. Holes on the tape's own 0.1-inch grid, across
 * and along (five code holes, the small feed hole between the third and the
 * fourth); a pointed leader where it starts, a straight cut where it ends,
 * feed holes only along the folds. Each strip's letters beside it.
 */
function tape(x: string, printed: boolean): string {
  const p = 5.4, W = 7 * p, strips = 4;
  const [top, bottom] = [30, 302];
  const yT = top + W, yB = bottom - W;
  // Strips spread across the live area (the letters sit in the gaps).
  const D = (244 - W) / (strips - 1);
  const x0 = 150 - (3 * D) / 2;
  const cx = (k: number) => x0 + k * D;
  const U = [-2.5, -1.5, -0.5, 1.5, 2.5];
  const [rHole, rFeed] = [0.36 * p, 0.23 * p];
  const frames = tapeFrames(loop(x, 240));
  let at = 0;
  let s = "";
  const lw = STROKE.fine;
  for (let k = 0; k < strips; k++) {
    const down = k % 2 === 0;
    const c = cx(k), L = c - W / 2, R = c + W / 2;
    // The strip's run: the first starts at the top with its leader, the last ends at the top; the rest turn in folds.
    const y1 = k === 0 || k === strips - 1 ? top : yT;
    const y2 = yB;
    const lead = k === 0 ? W / 2 : 0;
    const n = Math.floor((y2 - y1 - lead) / p);
    // The edges (each strip's own; the folds join them).
    s += line(L, k === 0 ? y1 + W / 2 : y1, L, y2, lw) + line(R, k === 0 ? y1 + W / 2 : y1, R, y2, lw);
    if (k === 0) s += path(polyline([[L, y1 + W / 2], [c, y1], [R, y1 + W / 2]]), lw);
    if (k === strips - 1) s += line(L, y1, R, y1, lw);
    for (let i = 0; i < n; i++) {
      // Frames step along the tape's travel: down a falling strip, up a rising one.
      const y = down ? y2 - (n - i - 0.5) * p : y2 - (i + 0.5) * p;
      const sgn = down ? 1 : -1;
      s += dot(c + sgn * 0.5 * p, y, rFeed);
      const leader = k === 0 && i < 3;
      const f = leader ? undefined : frames[at++ % frames.length];
      if (!f) continue;
      U.forEach((u, b) => {
        if (f.bits[b] === "1") s += dot(c + sgn * u * p, y, rHole);
      });
      // The letters ride with the tape: upright beside a falling strip, turned over (on its other side) beside a rising one.
      if (printed && f.ch) s += down ? text(R + 3.5, y + (CAP.plex * 4.6) / 2, f.ch, 4.6, { anchor: "start" }) : turnedText(f.ch, L - 3.5 - 1.4, y, 180, 4.6);
    }
    // The fold into the next strip: along the bottom after a falling strip, the top after a rising one.
    if (k < strips - 1) {
      const n2 = cx(k + 1);
      const [yi, yo] = down ? [yB, yB + W] : [yT, yT - W];
      const [Li, Ri] = [n2 - W / 2, n2 + W / 2];
      s += line(L, yi, L, yo, lw) + line(Ri, yi, Ri, yo, lw) + line(L, yo, Ri, yo, lw) + line(R, yi, Li, yi, lw);
      // The creases, and the feed holes running between them.
      s += line(R, yi, L, yo, STROKE.hairline) + line(Li, yi, Ri, yo, STROKE.hairline);
      const yf = (yi + yo) / 2 + 0.5 * p;
      for (let fx = R + p; fx < Li - p / 2; fx += p) s += dot(fx, yf, rFeed);
    }
  }
  return s;
}

function morse(x: string): string {
  // A stream of the name on strips of register tape, as a telegraph's inker printed it: one strip a row.
  const width = 168, rowH = 15, rows = 14;
  let s = "";
  for (let r = 0; r < rows; r++) s += line(-2, r * rowH - 5, width + 2, r * rowH - 5, 0.5) + line(-2, r * rowH + 5, width + 2, r * rowH + 5, 0.5);
  let [cx, row] = [0, 0];
  const stream = loop(x, 1);
  outer: for (let rep = 0; rep < 40; rep++)
    for (const code of morseEncode(`${stream} `)) {
      if (!code) {
        cx += 14;
        continue;
      }
      const w = [...code].reduce((a, c) => a + (c === "." ? 7 : 15), 0);
      if (cx + w > width) (row++, (cx = 0));
      if (row >= rows) break outer;
      const m = morseMarks(cx, row * rowH, code);
      s += m.svg;
      cx = m.x + 8;
    }
  return fitted(s, { x: -2, y: -6, w: width + 4, h: rows * rowH }, 1.6);
}

function braille(x: string, printed: boolean): string {
  const cols = 6, rows = 7, adv = 34, rowH = 40, pitch = 10.5;
  const cells: { dots: string; ch: string }[] = [];
  const chars = loop(x, cols * rows);
  // Encoded character by character so each cell knows its letter (a digit's number sign has none).
  let numeric = false;
  for (const ch of chars) {
    const enc = brailleEncode(numeric && /[0-9]/.test(ch) ? `1${ch}` : ch);
    const own = numeric && /[0-9]/.test(ch) ? enc.slice(-1) : enc;
    numeric = /[0-9]/.test(ch);
    own.forEach((dots, i) => cells.push({ dots, ch: i === own.length - 1 ? ch : "" }));
    if (cells.length >= cols * rows) break;
  }
  let s = "";
  cells.slice(0, cols * rows).forEach(({ dots, ch }, i) => {
    const [cx, cy] = [(i % cols) * adv, Math.floor(i / cols) * rowH];
    // Every cell shows its six places (the slate's grid): raised dots filled, the rest as rings.
    s += dots ? brailleCell(cx, cy, dots, pitch, 3.6, 1.6) : [0, 1, 2].map((r) => circle(cx, cy + r * pitch, 1.6, 0.5) + circle(cx + pitch, cy + r * pitch, 1.6, 0.5)).join("");
    // The letter just under its own cell (clear of the row below).
    if (printed && ch.trim()) s += text(cx + pitch / 2, cy + 2 * pitch + 5.6 + CAP.plex * 5.6, ch, 5.6);
  });
  return fitted(s, { x: -6, y: -6, w: (cols - 1) * adv + pitch + 12, h: rows * rowH }, 1.4);
}

function binary(x: string, printed: boolean): string {
  const msg = loop(x, 10).slice(0, 13);
  return fitted(binaryText(msg, { printed }), { x: 34, y: 34, w: 250, h: msg.length * 19 + 2 }, 1.3);
}

/** The print's body (white ink, unwrapped). */
export function codeBody(p: CodeParams): string {
  const printed = p.h !== 1;
  const art =
    p.k === "card" ? punchCard(loop(p.x, 80).slice(0, 80), { printed, flat: true }) : p.k === "tape" ? tape(p.x, printed) : p.k === "morse" ? morse(p.x) : p.k === "braille" ? braille(p.x, printed) : binary(p.x, printed);
  return art + caption(338, ...captionLines(codeCaption(p), p.cap));
}

/** The caption's lines (ours): the name (or the code's, when it's kept secret) and the code. */
export function codeCaption(p: CodeParams): Lines {
  const printed = p.h !== 1;
  return [printed ? p.x : CODE_NAMES[p.k], printed ? `${CODE_NAMES[p.k]} · ${STANDARD[p.k]}` : STANDARD[p.k]];
}

export const captionOf = (spec: CustomSpec) => codeCaption((spec as { p: CodeParams }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(codeBody((spec as { p: CodeParams }).p), color));
