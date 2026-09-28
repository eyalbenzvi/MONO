/**
 * Terminal (Part 3, the Retrofuturist): the machine's own characters — the
 * ASCII table, punched cards in IBM 029 (Hollerith) code, five-hole paper
 * tape in ITA2 (Baudot–Murray), seven-segment digits, box-drawing
 * characters. Every code is the standard's own.
 */
import type { FeatureKey } from "../../../types/shirt";
import { INK, caption, dot, line, path, polyline, text, type Set7Design } from "./kit";
import { binaryText, paperTape, punchCard } from "../../../lib/custom/draw/code";

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

/** A 5 × 7 dot-matrix face (rows top to bottom, 5 bits each), as on character LCDs and printers. */
const MATRIX: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"], B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"], C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"], D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"], F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"], G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"], H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"], J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"], K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"], L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"], N: ["10001", "10001", "11001", "10101", "10011", "10001", "10001"], O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"], P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"], R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"], S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"], T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"], V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"], W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"], X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "10001", "01010", "00100", "00100", "00100"], Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};

function dotMatrix(): string {
  let s = "";
  Object.entries(MATRIX).forEach(([, rows], i) => {
    const col = i % 6, row = Math.floor(i / 6);
    const x0 = 36 + col * 40, y0 = 40 + row * 56;
    rows.forEach((bits, r) => [...bits].forEach((b, c) => (s += b === "1" ? dot(x0 + c * 5.4, y0 + r * 5.4, 2) : dot(x0 + c * 5.4, y0 + r * 5.4, 0.5))));
  });
  return s;
}

function tableRows(rows: string[][], top = 50): string {
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
  const chars = widths.reduce((a, b) => a + b, 0) + 2 * (widths.length - 1);
  const size = Math.min(10, 244 / (0.6 * chars), 240 / (rows.length * 1.6));
  const x0 = 150 - (chars * size * 0.6) / 2;
  let s = "";
  rows.forEach((r, i) => {
    let x = x0;
    r.forEach((cell, c) => {
      s += text(x, top + i * size * 1.6, cell, size, { anchor: "start", bold: i === 0 });
      x += (widths[c] + 2) * size * 0.6;
    });
  });
  return s;
}

export function terminalSet(): Set7Design[] {
  const out: Set7Design[] = [];
  const add = (title: string, key: string, body: string, description: string, cap: [string, string?, string?], subject?: string, extra: Partial<Record<FeatureKey, number>> = {}) =>
    out.push({ body: body + caption(330, cap[0], cap[1], cap[2]), variant: "terminal-data", category: "terminal", title, subject: subject ?? title, description, features: { ...FEAT, ...extra }, sigKey: `terminal-${key}` });
  add("ASCII Table", "ascii", asciiTable(), "All 128 codes of 7-bit ASCII in eight columns of sixteen, the control characters by their names, as the 1967 standard set them.", ["ASCII", "128 codes, 00 to 7F"], "ASCII Character Table");
  add("Punched Card, HELLO, WORLD", "card-hello", punchCard("HELLO, WORLD"), "An 80-column punched card carrying HELLO, WORLD in IBM 029 keypunch code: each letter a zone punch in rows 12, 11 or 0 and a digit punch.", ["Punched Card", "IBM 029 code · HELLO, WORLD"]);
  add("Punched Card, a FORTRAN Loop", "card-fortran", punchCard("      DO 10 I = 1, 100"), "An 80-column punched card carrying the FORTRAN statement DO 10 I = 1, 100, starting in column 7 as FORTRAN required, in IBM 029 keypunch code.", ["Punched Card", "IBM 029 code · DO 10 I = 1, 100"]);
  add("Paper Tape, ITA2", "tape", paperTape("THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG"), "Five-hole teleprinter tape punched with a pangram in ITA2, the Baudot–Murray code: five holes per character, the small feed hole between the third and fourth.", ["Paper Tape", "ITA2 five-hole code"], "Teleprinter Paper Tape");
  add("Seven-Segment Digits", "7seg", sevenSegment(), "The ten digits of a seven-segment display, lit segments filled and the rest outlined, with the segments each digit uses, a to g.", ["Seven Segments", "The ten digits, segments a to g"], "Seven-Segment Display Digits");
  add("Punched Card, a COBOL Line", "card-cobol", punchCard("       IDENTIFICATION DIVISION."), "An 80-column punched card carrying IDENTIFICATION DIVISION., the first line of every COBOL program, in columns 8 on, in IBM 029 keypunch code.", ["Punched Card", "IBM 029 code · IDENTIFICATION DIVISION."]);
  add("5 × 7 Dot-Matrix Alphabet", "dotmatrix", dotMatrix(), "The alphabet in a five-by-seven dot matrix, the grid of character LCDs and dot-matrix printers, lit dots full and the rest pinpricks.", ["Dot Matrix", "A to Z in five by seven"], "Dot-Matrix Alphabet");
  add("HELLO in Binary", "binary-hello", binaryText("HELLO, WORLD"), "HELLO, WORLD spelled in eight-bit ASCII: each character's code as eight bits, ones filled and zeros open, its hexadecimal value beside it.", ["ASCII in Binary", "HELLO, WORLD, eight bits a letter"], "Binary ASCII Text");
  add("ANSI Escape Codes", "ansi-sgr", tableRows([["Code", "Effect"], ["ESC[0m", "reset"], ["ESC[1m", "bold"], ["ESC[2m", "faint"], ["ESC[3m", "italic"], ["ESC[4m", "underline"], ["ESC[5m", "slow blink"], ["ESC[7m", "reverse video"], ["ESC[8m", "conceal"], ["ESC[9m", "crossed out"], ["ESC[30–37m", "foreground colour"], ["ESC[40–47m", "background colour"], ["ESC[2J", "clear screen"], ["ESC[H", "cursor home"]]), "Select Graphic Rendition and screen codes of ANSI X3.64 (ECMA-48), the escape sequences terminals still obey.", ["ANSI Escapes", "ECMA-48 · ESC = 0x1B"], "ANSI Escape Code Table");
  add("Unix Signals", "signals", tableRows([["No", "Signal", "Default"], ["1", "SIGHUP", "terminate"], ["2", "SIGINT", "terminate"], ["3", "SIGQUIT", "core dump"], ["4", "SIGILL", "core dump"], ["5", "SIGTRAP", "core dump"], ["6", "SIGABRT", "core dump"], ["7", "SIGBUS", "core dump"], ["8", "SIGFPE", "core dump"], ["9", "SIGKILL", "terminate"], ["10", "SIGUSR1", "terminate"], ["11", "SIGSEGV", "core dump"], ["12", "SIGUSR2", "terminate"], ["13", "SIGPIPE", "terminate"], ["14", "SIGALRM", "terminate"], ["15", "SIGTERM", "terminate"]]), "The first fifteen POSIX signals with their Linux numbers and default actions, from the hangup to the polite request to terminate.", ["Unix Signals", "Linux numbering, 1 to 15"], "Unix Signal Table");
  add("HTTP Status Codes", "http", tableRows([["Code", "Reason"], ["100", "Continue"], ["200", "OK"], ["201", "Created"], ["204", "No Content"], ["301", "Moved Permanently"], ["302", "Found"], ["304", "Not Modified"], ["400", "Bad Request"], ["401", "Unauthorized"], ["403", "Forbidden"], ["404", "Not Found"], ["429", "Too Many Requests"], ["500", "Internal Server Error"], ["503", "Service Unavailable"]]), "The HTTP status codes met most often, with their reason phrases as RFC 9110 gives them.", ["HTTP Status", "RFC 9110 reason phrases"], "HTTP Status Code Table");
  add("File Permissions in Octal", "chmod", tableRows([["Octal", "rwx", "Meaning"], ["0", "---", "none"], ["1", "--x", "execute"], ["2", "-w-", "write"], ["3", "-wx", "write, execute"], ["4", "r--", "read"], ["5", "r-x", "read, execute"], ["6", "rw-", "read, write"], ["7", "rwx", "read, write, execute"], ["", "", ""], ["755", "rwxr-xr-x", "owner all, others read"], ["644", "rw-r--r--", "owner writes, all read"]]), "Unix file permissions: each octal digit the sum of read 4, write 2 and execute 1, with the two modes most files carry.", ["chmod", "Read 4 · write 2 · execute 1"], "Unix File Permission Table");
  add("Box-Drawing Characters", "boxdraw", boxDrawing(), "Box-drawing characters from the Unicode range U+2500 to U+257F: light, heavy, double and rounded lines, corners, tees and crosses.", ["Box Drawing", "Unicode 2500–257F"], "Box-Drawing Character Chart", { typography: 0.7 });
  return out;
}
