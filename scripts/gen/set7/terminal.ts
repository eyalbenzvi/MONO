/**
 * Terminal (Part 3, the Retrofuturist): the machine's own characters — the
 * ASCII table, punched cards in IBM 029 (Hollerith) code, five-hole paper
 * tape in ITA2 (Baudot–Murray), seven-segment digits, box-drawing
 * characters. Every code is the standard's own.
 */
import type { FeatureKey } from "../../../types/shirt";
import { INK, caption, dot, f1, line, path, polyline, text, type Set7Design } from "./kit";

const FEAT = { retro: 0.85, typography: 0.55, geometric: 0.5, clean_minimal: 0.45, dark_industrial: 0.35, abstract: 0.3, density: 0.4, contrast: 0.8, line_art: 0.3 };

const CONTROL = ["NUL", "SOH", "STX", "ETX", "EOT", "ENQ", "ACK", "BEL", "BS", "HT", "LF", "VT", "FF", "CR", "SO", "SI", "DLE", "DC1", "DC2", "DC3", "DC4", "NAK", "SYN", "ETB", "CAN", "EM", "SUB", "ESC", "FS", "GS", "RS", "US"];

function asciiTable(): string {
  // 8 columns of 16: hex code and character.
  let s = "";
  const cw = 32, rh = 15.5, x0 = 150 - (8 * cw) / 2, y0 = 44;
  for (let c = 0; c < 8; c++) {
    s += text(x0 + c * cw + cw / 2, y0 - 8, `${c}x`, 6, { bold: true });
    for (let r = 0; r < 16; r++) {
      const code = c * 16 + r;
      const ch = code < 32 ? CONTROL[code] : code === 32 ? "SP" : code === 127 ? "DEL" : String.fromCharCode(code);
      const y = y0 + r * rh;
      s += text(x0 + c * cw + 3, y + 3, r.toString(16).toUpperCase(), 4.5, { anchor: "start" }) + text(x0 + c * cw + cw - 3, y + 3.5, ch, code < 33 || code === 127 ? 5 : 8, { anchor: "end", bold: code >= 33 && code < 127 });
    }
    if (c) s += line(x0 + c * cw, y0 - 4, x0 + c * cw, y0 + 16 * rh - 6, 0.5);
  }
  s += line(x0, y0 - 4, x0 + 8 * cw, y0 - 4, 0.8);
  return s;
}

/** IBM 029 punch rows for a character: 12, 11, 0–9 (row index 0 = 12, 1 = 11, 2 = 0 … 11 = 9). */
function hollerith(ch: string): number[] {
  const row = (d: number) => d + 2;
  if (/[0-9]/.test(ch)) return [row(+ch)];
  if (/[A-I]/.test(ch)) return [0, row(ch.charCodeAt(0) - 64)];
  if (/[J-R]/.test(ch)) return [1, row(ch.charCodeAt(0) - 73)];
  if (/[S-Z]/.test(ch)) return [row(0), row(ch.charCodeAt(0) - 81)];
  const special: Record<string, number[]> = { " ": [], ",": [row(0), row(3), row(8)], ".": [0, row(3), row(8)], "-": [1], "=": [row(6), row(8)], "(": [0, row(5), row(8)], ")": [1, row(5), row(8)], "+": [0, row(6), row(8)], "*": [1, row(4), row(8)], "/": [row(0), row(1)], "'": [row(5), row(8)] };
  return special[ch] ?? [];
}

function punchCard(line1: string): string {
  // The 80-column card on its side: columns run down the print, rows across.
  const X0 = 44, Y0 = 26, colH = 3.4, rowW = 17.4;
  const W = 12 * rowW + 16, H = 80 * colH + 10;
  let s = path(polyline([[X0, Y0 + 14], [X0 + 14, Y0], [X0 + W, Y0], [X0 + W, Y0 + H], [X0, Y0 + H]], true), 1.3);
  const labels = ["12", "11", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  labels.forEach((l, r) => (s += text(X0 + 8 + r * rowW + rowW / 2, Y0 + H + 9, l, 5)));
  const txt = line1.toUpperCase().padEnd(80, " ");
  for (let c = 0; c < 80; c++) {
    const y = Y0 + 5 + c * colH;
    const punched = new Set(hollerith(txt[c]));
    for (let r = 0; r < 12; r++) {
      const x = X0 + 8 + r * rowW + rowW / 2;
      if (punched.has(r)) s += `<rect x="${f1(x - 2.6)}" y="${f1(y + 0.4)}" width="5.2" height="2.4" fill="${INK}"/>`;
      else if (r >= 2) s += text(x, y + 2.6, labels[r], 2.6);
    }
    if (txt[c] !== " ") s += text(X0 + 3.5, y + 2.6, txt[c], 3, { anchor: "middle" });
  }
  return s;
}

function paperTape(msg: string): string {
  // ITA2 (Baudot–Murray), holes 1–5, the feed hole between 3 and 4. Tape runs down the print.
  const code: Record<string, string> = { A: "11000", B: "10011", C: "01110", D: "10010", E: "10000", F: "10110", G: "01011", H: "00101", I: "01100", J: "11010", K: "11110", L: "01001", M: "00111", N: "00110", O: "00011", P: "01101", Q: "11101", R: "01010", S: "10100", T: "00001", U: "11100", V: "01111", W: "11001", X: "10111", Y: "10101", Z: "10001", " ": "00100" };
  const X = 150, pitch = 6.2, y0 = 28;
  const w = 6 * 9 + 12;
  const H = msg.length * pitch + 8;
  let s = line(X - w / 2, y0 - 6, X - w / 2, y0 + H, 1.2) + line(X + w / 2, y0 - 6, X + w / 2, y0 + H, 1.2);
  [...msg].forEach((ch, i) => {
    const y = y0 + i * pitch;
    const bits = code[ch];
    const xs = [-2.5, -1.5, -0.5, 0.9, 1.9].map((k) => X + k * 9 - 0.2);
    for (let b = 0; b < 5; b++) s += bits[b] === "1" ? dot(xs[b] - 2, y, 2.3) : "";
    s += dot(X + 0.2 * 9 - 2, y, 0.9);
    s += text(X + w / 2 + 8, y + 2, ch === " " ? "␣" : ch, 5, { anchor: "start" }) + text(X - w / 2 - 8, y + 2, bits, 3.8, { anchor: "end" });
  });
  return s;
}

function sevenSegment(): string {
  // Segments a–g for each digit (a top, b top right, c bottom right, d bottom, e bottom left, f top left, g middle).
  const on = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];
  const segW = 22, segT = 5;
  const seg = (x: number, y: number, horizontal: boolean, lit: boolean) => {
    const L = segW, t = segT / 2;
    const pts: [number, number][] = horizontal
      ? [[x, y], [x + t, y - t], [x + L - t, y - t], [x + L, y], [x + L - t, y + t], [x + t, y + t]]
      : [[x, y], [x + t, y + t], [x + t, y + L - t], [x, y + L], [x - t, y + L - t], [x - t, y + t]];
    return lit ? `<path d="${polyline(pts, true)}" fill="${INK}"/>` : path(polyline(pts, true), 0.5);
  };
  let s = "";
  on.forEach((segs, i) => {
    const col = i % 5, row = Math.floor(i / 5);
    const x = 30 + col * 50, y = 70 + row * 110;
    s += seg(x + 2, y, true, segs.includes("a")) + seg(x + segW + 2, y + 2, false, segs.includes("b")) + seg(x + segW + 2, y + segW + 4, false, segs.includes("c")) + seg(x + 2, y + 2 * segW + 6, true, segs.includes("d")) + seg(x, y + segW + 4, false, segs.includes("e")) + seg(x, y + 2, false, segs.includes("f")) + seg(x + 2, y + segW + 3, true, segs.includes("g"));
    s += text(x + segW / 2 + 1, y + 2 * segW + 22, segs.length > 6 ? segs : segs, 4.5);
  });
  s += text(150, 45, "a b c d e f g", 6);
  return s;
}

function boxDrawing(): string {
  const rows = ["─ │ ┌ ┐ └ ┘", "├ ┤ ┬ ┴ ┼", "═ ║ ╔ ╗ ╚ ╝", "╠ ╣ ╦ ╩ ╬", "━ ┃ ┏ ┓ ┗ ┛", "╭ ╮ ╰ ╯ ╱ ╲ ╳", "╴ ╵ ╶ ╷ ╸ ╹ ╺ ╻"];
  let s = "";
  rows.forEach((r, i) => (s += text(150, 64 + i * 28, r, 16)));
  s += text(150, 290, "U+2500 – U+257F", 7);
  return s;
}

export function terminalSet(): Set7Design[] {
  const out: Set7Design[] = [];
  const add = (title: string, key: string, body: string, description: string, cap: [string, string?, string?], subject?: string, extra: Partial<Record<FeatureKey, number>> = {}) =>
    out.push({ body: body + caption(330, cap[0], cap[1], cap[2]), variant: "terminal-data", category: "terminal", title, subject: subject ?? title, description, features: { ...FEAT, ...extra }, sigKey: `terminal-${key}` });
  add("ASCII Table", "ascii", asciiTable(), "All 128 codes of 7-bit ASCII in eight columns of sixteen, the control characters by their names, as the 1967 standard set them.", ["ASCII", "128 codes, 00 to 7F"], "ASCII Character Table");
  add("Punched Card, HELLO, WORLD", "card-hello", punchCard("HELLO, WORLD"), "An 80-column punched card carrying HELLO, WORLD in IBM 029 keypunch code: each letter a zone punch in rows 12, 11 or 0 and a digit punch.", ["Punched Card", "IBM 029 code · HELLO, WORLD"], "IBM Punched Card");
  add("Punched Card, a FORTRAN Loop", "card-fortran", punchCard("      DO 10 I = 1, 100"), "An 80-column punched card carrying the FORTRAN statement DO 10 I = 1, 100, starting in column 7 as FORTRAN required, in IBM 029 keypunch code.", ["Punched Card", "IBM 029 code · DO 10 I = 1, 100"], "IBM Punched Card");
  add("Paper Tape, ITA2", "tape", paperTape("THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG"), "Five-hole teleprinter tape punched with a pangram in ITA2, the Baudot–Murray code: five holes per character, the small feed hole between the third and fourth.", ["Paper Tape", "ITA2 five-hole code"], "Teleprinter Paper Tape");
  add("Seven-Segment Digits", "7seg", sevenSegment(), "The ten digits of a seven-segment display, lit segments filled and the rest outlined, with the segments each digit uses, a to g.", ["Seven Segments", "The ten digits, segments a to g"], "Seven-Segment Display Digits");
  add("Box-Drawing Characters", "boxdraw", boxDrawing(), "Box-drawing characters from the Unicode range U+2500 to U+257F: light, heavy, double and rounded lines, corners, tees and crosses.", ["Box Drawing", "Unicode 2500–257F"], "Box-Drawing Character Chart", { typography: 0.7 });
  return out;
}
