/**
 * Your Name: a name in one of the machine's or the hand's codes (the
 * catalogue's Terminal and Type prints, lib/custom/draw/code), filling the
 * print area: every code runs the name again and again (across the card's 80
 * columns, down a loop of tape, along lines of type), so a short name still
 * makes a whole print. The
 * plain letters sit small in the caption; "Keep it secret" leaves them out
 * everywhere (the code alone, and the code's own name as the title).
 */
import { caption, circle, dot, f1, line, text } from "../kit";
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

function tape(x: string, printed: boolean): string {
  const frames = tapeFrames(loop(x, 34)).slice(0, 44);
  const pitch = 6.2, y0 = 0, X = 0, w = 66;
  const H = frames.length * pitch + 8;
  let s = line(X - w / 2, y0 - 6, X - w / 2, y0 + H, 1.2) + line(X + w / 2, y0 - 6, X + w / 2, y0 + H, 1.2);
  frames.forEach(({ bits, ch }, i) => {
    const y = y0 + i * pitch;
    const xs = [-2.5, -1.5, -0.5, 0.9, 1.9].map((k) => X + k * 9 - 0.2);
    for (let b = 0; b < 5; b++) if (bits[b] === "1") s += dot(xs[b] - 2, y, 2.3);
    s += dot(X + 0.2 * 9 - 2, y, 0.9);
    // The holes written out on the left (the tape's own code, not the letters), as the catalogue's tape has them.
    s += text(X - w / 2 - 8, y + 2, bits, 3.8, { anchor: "end" });
    if (printed && ch) s += text(X + w / 2 + 8, y + 2, ch, 5, { anchor: "start" });
  });
  return fitted(s, { x: -w / 2 - 22, y: -8, w: w + 38, h: H + 10 }, 1.4);
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
    if (printed && ch.trim()) s += text(cx + pitch / 2, cy + 3 * pitch + 6, ch, 6);
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
  const title = printed ? p.x : CODE_NAMES[p.k];
  const sub = printed ? `${CODE_NAMES[p.k]} · ${STANDARD[p.k]}` : STANDARD[p.k];
  return art + caption(338, title, sub);
}

export const render = (spec: CustomSpec, color: BaseColor) => wrap(codeBody((spec as { p: CodeParams }).p), color);
