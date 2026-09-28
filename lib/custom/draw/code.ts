/**
 * Text in the machine's and the hand's codes: the punched card (IBM 029
 * Hollerith), five-hole paper tape (ITA2), bytes as eight bits, Morse and
 * braille. Every table is the standard's own, so a name punched or tapped
 * here reads true on the real thing; the catalogue draws its fixed messages
 * with the same functions a template uses for a customer's.
 */
import { INK, dot, circle, f1, line, path, polyline, text } from "../kit";

/* ------------------------------------------------------------------ */
/* Punched card, paper tape, binary                                     */
/* ------------------------------------------------------------------ */

/** IBM 029 punch rows for a character: 12, 11, 0–9 (row index 0 = 12, 1 = 11, 2 = 0 … 11 = 9). A character the keypunch has no code for is left blank. */
export function hollerith(ch: string): number[] {
  const row = (d: number) => d + 2;
  if (/[0-9]/.test(ch)) return [row(+ch)];
  if (/[A-I]/.test(ch)) return [0, row(ch.charCodeAt(0) - 64)];
  if (/[J-R]/.test(ch)) return [1, row(ch.charCodeAt(0) - 73)];
  if (/[S-Z]/.test(ch)) return [row(0), row(ch.charCodeAt(0) - 81)];
  const special: Record<string, number[]> = { " ": [], ",": [row(0), row(3), row(8)], ".": [0, row(3), row(8)], "-": [1], "=": [row(6), row(8)], "(": [0, row(5), row(8)], ")": [1, row(5), row(8)], "+": [0, row(6), row(8)], "*": [1, row(4), row(8)], "/": [row(0), row(1)], "'": [row(5), row(8)] };
  return special[ch] ?? [];
}

/**
 * An 80-column card punched with a line of text (upper-cased, cut at 80), set
 * on its side: columns run down the print, rows across. `printed: false`
 * leaves the typed letters off the card's edge (the holes alone); `flat`
 * writes the card's printed digits one by one instead of as an SVG pattern
 * (the browser's canvas renderer draws no patterns).
 */
export function punchCard(line1: string, { printed = true, flat = false }: { printed?: boolean; flat?: boolean } = {}): string {
  const X0 = 44, Y0 = 26, colH = 3.4, rowW = 17.4;
  const W = 12 * rowW + 16, H = 80 * colH + 10;
  let s = path(polyline([[X0, Y0 + 14], [X0 + 14, Y0], [X0 + W, Y0], [X0 + W, Y0 + H], [X0, Y0 + H]], true), 1.3);
  const labels = ["12", "11", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  labels.forEach((l, r) => (s += text(X0 + 8 + r * rowW + rowW / 2, Y0 + H + 9, l, 5)));
  // The printed digits 0–9 in every column, as one repeating tile (a card has 800 of them).
  const id = `card${line1.length}${line1.charCodeAt(line1.length - 1)}`;
  let tile = "";
  for (let r = 2; r < 12; r++) tile += text(8 + r * rowW + rowW / 2, 2.6, labels[r], 2.6);
  if (flat) for (let c = 0; c < 80; c++) for (let r = 2; r < 12; r++) s += text(X0 + 8 + r * rowW + rowW / 2, Y0 + 5 + c * colH + 2.6, labels[r], 2.6);
  else {
    s += `<defs><pattern id="${id}" x="${X0}" y="${f1(Y0 + 5)}" width="${f1(W)}" height="${colH}" patternUnits="userSpaceOnUse">${tile}</pattern></defs>`;
    s += `<rect x="${X0}" y="${f1(Y0 + 5)}" width="${f1(W)}" height="${f1(80 * colH)}" fill="url(#${id})"/>`;
  }
  const txt = line1.toUpperCase().padEnd(80, " ");
  for (let c = 0; c < 80; c++) {
    const y = Y0 + 5 + c * colH;
    const punched = new Set(hollerith(txt[c]));
    for (const r of punched) {
      const x = X0 + 8 + r * rowW + rowW / 2;
      // A hole: a clean slot in the card (the digit under it is punched away).
      s += `<rect x="${f1(x - 2.6)}" y="${f1(y + 0.2)}" width="5.2" height="2.8" fill="${INK}"/>`;
    }
    if (printed && txt[c] !== " ") s += text(X0 + 3.5, y + 2.6, txt[c], 3, { anchor: "middle" });
  }
  return s;
}

/** ITA2 (Baudot–Murray) letters: holes 1–5, 1 punched. */
export const ITA2: Record<string, string> = { A: "11000", B: "10011", C: "01110", D: "10010", E: "10000", F: "10110", G: "01011", H: "00101", I: "01100", J: "11010", K: "11110", L: "01001", M: "00111", N: "00110", O: "00011", P: "01101", Q: "11101", R: "01010", S: "10100", T: "00001", U: "11100", V: "01111", W: "11001", X: "10111", Y: "10101", Z: "10001", " ": "00100" };

/**
 * Five-hole teleprinter tape punched with a message, running down the print,
 * the feed hole between holes 3 and 4. The tape grows with the message
 * (6.2 per character); a character outside the letters shift is left unpunched.
 */
export function paperTape(msg: string): string {
  const X = 150, pitch = 6.2, y0 = 28;
  const w = 6 * 9 + 12;
  const H = msg.length * pitch + 8;
  let s = line(X - w / 2, y0 - 6, X - w / 2, y0 + H, 1.2) + line(X + w / 2, y0 - 6, X + w / 2, y0 + H, 1.2);
  [...msg].forEach((ch, i) => {
    const y = y0 + i * pitch;
    const bits = ITA2[ch] ?? "00000";
    const xs = [-2.5, -1.5, -0.5, 0.9, 1.9].map((k) => X + k * 9 - 0.2);
    for (let b = 0; b < 5; b++) s += bits[b] === "1" ? dot(xs[b] - 2, y, 2.3) : "";
    s += dot(X + 0.2 * 9 - 2, y, 0.9);
    s += text(X + w / 2 + 8, y + 2, ch === " " ? "␣" : ch, 5, { anchor: "start" }) + text(X - w / 2 - 8, y + 2, bits, 3.8, { anchor: "end" });
  });
  return s;
}

/** Each character's eight-bit code as a row of discs (ones filled, zeros open), its hexadecimal value beside it; rows 19 apart from the top. `printed: false` leaves the letters out. */
export function binaryText(msg: string, { printed = true }: { printed?: boolean } = {}): string {
  let s = "";
  [...msg].forEach((ch, i) => {
    const y = 44 + i * 19;
    const bits = ch.charCodeAt(0).toString(2).padStart(8, "0");
    if (printed) s += text(48, y + 4, ch === " " ? "SP" : ch, 9, { bold: true });
    [...bits].forEach((b, k) => (s += b === "1" ? dot(80 + k * 22, y, 6) : `<circle cx="${f1(80 + k * 22)}" cy="${f1(y)}" r="6" fill="none" stroke="${INK}" stroke-width="1"/>`));
    s += text(262, y + 3, ch.charCodeAt(0).toString(16).toUpperCase(), 7, { anchor: "start" });
  });
  return s;
}

/* ------------------------------------------------------------------ */
/* Morse and braille                                                    */
/* ------------------------------------------------------------------ */

/** International Morse code for the letters and digits. */
export const MORSE: Record<string, string> = { A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.", "0": "-----" };

/** A text in Morse, one code per character ("" for a space or a character Morse has no code for here). */
export const morseEncode = (s: string): string[] => [...s.toUpperCase()].map((ch) => MORSE[ch] ?? "");

/**
 * One character's dots and dashes on a line, drawn to their proportions (a
 * dash three dots long), starting at x and centred on y. Returns the marks and
 * the x where the next character may start.
 */
export function morseMarks(x: number, y: number, code: string): { svg: string; x: number } {
  let s = "";
  let cx = x;
  for (const sym of code) {
    if (sym === ".") (s += dot(cx + 1.8, y, 1.8)), (cx += 7);
    else (s += `<rect x="${f1(cx)}" y="${f1(y - 1.8)}" width="11" height="3.6" rx="1.8" fill="${INK}"/>`), (cx += 15);
  }
  return { svg: s, x: cx };
}

/** A text as one line of Morse from x: characters a letter gap apart, words a wider gap (the timing's 3 and 7 units, roughly). */
export function morseLine(x: number, y: number, s: string, gap = 8): string {
  let svg = "";
  let cx = x;
  for (const code of morseEncode(s)) {
    if (!code) {
      cx += gap * 1.5;
      continue;
    }
    const m = morseMarks(cx, y, code);
    svg += m.svg;
    cx = m.x + gap;
  }
  return svg;
}

/** Braille letters: the raised dots of each six-dot cell (1–3 down the left, 4–6 down the right). */
export const BRAILLE: Record<string, string> = { a: "1", b: "12", c: "14", d: "145", e: "15", f: "124", g: "1245", h: "125", i: "24", j: "245", k: "13", l: "123", m: "134", n: "1345", o: "135", p: "1234", q: "12345", r: "1235", s: "234", t: "2345", u: "136", v: "1236", w: "2456", x: "1346", y: "13456", z: "1356" };
/** The number sign, which makes the letters a–j that follow it read as 1–9 and 0. */
export const BRAILLE_NUMBER = "3456";

/**
 * A text as braille cells (dot numbers, "" for a blank cell): letters as
 * themselves, a run of digits after one number sign, a space as a blank cell.
 * Characters braille has no cell for here are left out.
 */
export function brailleEncode(s: string): string[] {
  const cells: string[] = [];
  let numeric = false;
  for (const ch of s.toLowerCase()) {
    if (/[0-9]/.test(ch)) {
      if (!numeric) cells.push(BRAILLE_NUMBER), (numeric = true);
      cells.push(BRAILLE["jabcdefghi"[+ch]]);
      continue;
    }
    numeric = false;
    if (ch === " ") cells.push("");
    else if (BRAILLE[ch]) cells.push(BRAILLE[ch]);
  }
  return cells;
}

/** One braille cell at (x, y), its top-left dot: raised dots filled (radius r), the others marked as small rings; dots `pitch` apart. */
export function brailleCell(x: number, y: number, dots: string, pitch = 9, r = 3, ring = 1.2): string {
  let s = "";
  for (let k = 1; k <= 6; k++) {
    const [dx, dy] = [k <= 3 ? 0 : pitch, ((k - 1) % 3) * pitch];
    s += dots.includes(String(k)) ? dot(x + dx, y + dy, r) : circle(x + dx, y + dy, ring, 0.5);
  }
  return s;
}

/** A text as one line of braille cells from x, a cell every `advance` along; a space is left empty. */
export function brailleLine(x: number, y: number, s: string, advance = 24, pitch = 9, r = 3): string {
  return brailleEncode(s)
    .map((dots, i) => (dots ? brailleCell(x + i * advance, y, dots, pitch, r) : ""))
    .join("");
}
