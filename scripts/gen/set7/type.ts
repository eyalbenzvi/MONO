/**
 * Type (Part 3, the Minimalist): real data set in type on a plain grid —
 * standard scales and alphabets, SI definitions, measured facts. Digits of
 * π, e, √2 and φ are computed here (BigInt), never typed in; the rest are
 * standard, published values.
 */
import { readFileSync } from "node:fs";
import type { FeatureKey } from "../../../types/shirt";
import nodePath from "node:path";
import { INK, caption, circle, dot, f1, line, rect, text, type Set7Design } from "./kit";

const FEAT = { typography: 0.9, clean_minimal: 0.75, geometric: 0.35, line_art: 0.3, abstract: 0.15, density: 0.35, contrast: 0.8, classic: 0.3, retro: 0.15 };

/** A table on the grid: left-aligned columns, a rule under the head, sized to the widest row. */
function table(rows: string[][], opts: { head?: string[]; top?: number; bottom?: number; align?: ("start" | "end")[] } = {}): string {
  const top = opts.top ?? 44, bottom = opts.bottom ?? 292;
  const all = opts.head ? [opts.head, ...rows] : rows;
  const cols = Math.max(...all.map((r) => r.length));
  const widths = Array.from({ length: cols }, (_, c) => Math.max(...all.map((r) => (r[c] ?? "").length)));
  const gap = 2;
  const chars = widths.reduce((a, b) => a + b, 0) + gap * (cols - 1);
  const rowH0 = (bottom - top) / (all.length + (opts.head ? 0.6 : 0));
  const size = Math.min(10, 244 / (0.6 * chars), rowH0 / 1.45);
  const rowH = Math.min(rowH0, size * 2);
  const cw = size * 0.6;
  const width = chars * cw;
  const x0 = 150 - width / 2;
  let s = "";
  let y = top + size;
  const setRow = (r: string[], bold = false) => {
    let x = x0;
    r.forEach((cell, c) => {
      const end = opts.align?.[c] === "end";
      s += text(end ? x + widths[c] * cw : x, y, cell, size, { anchor: end ? "end" : "start", bold });
      x += (widths[c] + gap) * cw;
    });
    y += rowH;
  };
  if (opts.head) {
    setRow(opts.head, true);
    s += line(x0, y - rowH + size * 0.55, x0 + width, y - rowH + size * 0.55, 0.8);
    y += rowH * 0.6 - rowH * 0.3;
  }
  for (const r of rows) setRow(r);
  return s;
}

/** Digits set in a block, row by row, spaced to the grid. */
function digitBlock(lead: string, digits: string, cols: number, rows: number, top = 50): string {
  let s = "";
  const size = 8, pitch = 244 / cols;
  for (let r = 0; r < rows; r++) {
    const chunk = r === 0 ? lead + digits.slice(0, cols - lead.length) : digits.slice(r * cols - lead.length, (r + 1) * cols - lead.length);
    for (let c = 0; c < chunk.length; c++) s += text(28 + c * pitch + pitch / 2, top + r * 12.4, chunk[c], size);
  }
  return s;
}

/* Computed constants: n decimal places, as a string of digits. */
const TEN = 10n;
function atanInv(x: bigint, scale: bigint): bigint {
  let sum = 0n, term = scale / x, k = 1n, sign = 1n;
  const x2 = x * x;
  while (term !== 0n) {
    sum += (sign * term) / k;
    term /= x2;
    k += 2n;
    sign = -sign;
  }
  return sum;
}
function piDigits(n: number): string {
  const scale = TEN ** BigInt(n + 10);
  const pi = 16n * atanInv(5n, scale) - 4n * atanInv(239n, scale);
  return pi.toString().slice(1, n + 1);
}
function eDigits(n: number): string {
  const scale = TEN ** BigInt(n + 10);
  let sum = 0n, term = scale;
  for (let k = 1n; term !== 0n; k++) {
    sum += term;
    term /= k;
  }
  return sum.toString().slice(1, n + 1);
}
function isqrt(v: bigint): bigint {
  let x = BigInt(Math.floor(Math.sqrt(Number(v.toString().slice(0, 15))))) * TEN ** BigInt(Math.max(0, Math.floor((v.toString().length - 15) / 2)));
  if (x === 0n) x = 1n;
  for (;;) {
    const y = (x + v / x) / 2n;
    if (y >= x && y - x <= 1n) {
      while (x * x > v) x--;
      while ((x + 1n) * (x + 1n) <= v) x++;
      return x;
    }
    x = y;
  }
}
const sqrt2Digits = (n: number) => isqrt(2n * TEN ** BigInt(2 * (n + 5))).toString().slice(1, n + 1);
const phiDigits = (n: number) => ((TEN ** BigInt(n + 5) + isqrt(5n * TEN ** BigInt(2 * (n + 5)))) / 2n).toString().slice(1, n + 1);

const ELEMENTS = "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og".split(" ");

/** Where element Z sits in the 18-column table: [row, column] (rows 8 and 9 are the f-block). */
function cell(z: number): [number, number] {
  if (z === 1) return [0, 0];
  if (z === 2) return [0, 17];
  const starts = [3, 11, 19, 37, 55, 87];
  for (let p = 5; p >= 0; p--) {
    const z0 = starts[p];
    if (z < z0) continue;
    const i = z - z0, row = p + 1;
    if (p <= 1) return i < 2 ? [row, i] : [row, i + 10];
    if (p <= 3) return [row, i];
    // Periods 6 and 7: two s, then the f-block (15) below, then groups 4–18.
    if (i < 2) return [row, i];
    if (i < 17) return [row === 5 ? 8 : 9, i - 2 + 2];
    return [row, i - 17 + 3];
  }
  return [0, 0];
}

function periodicTable(): string {
  if (ELEMENTS.length !== 118) throw new Error("periodic table: expected 118 elements");
  const cw = 14, ch = 17, x0 = 150 - (18 * cw) / 2, y0 = 60;
  let s = "";
  ELEMENTS.forEach((sym, k) => {
    const [r, c] = cell(k + 1);
    const y = y0 + r * ch + (r >= 8 ? 8 : 0);
    const x = x0 + c * cw;
    s += rect(x + 0.6, y + 0.6, cw - 1.2, ch - 1.2, 0.6) + text(x + cw / 2, y + ch / 2 + 1.5, sym, 5.2, { bold: true }) + text(x + 2, y + 4.8, String(k + 1), 2.9, { anchor: "start" });
  });
  return s;
}

function morse(): string {
  const code: [string, string][] = Object.entries({ A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.", "0": "-----" }).sort((a, b) => (/\d/.test(a[0]) ? 1 : 0) - (/\d/.test(b[0]) ? 1 : 0) || (a[0] === "0" ? 1 : b[0] === "0" ? -1 : a[0].localeCompare(b[0])));
  let s = "";
  code.forEach(([ch, m], i) => {
    const col = Math.floor(i / 18), row = i % 18;
    const x = 36 + col * 124, y = 46 + row * 14;
    s += text(x, y + 3, ch, 8, { bold: true, anchor: "start" });
    let cx = x + 16;
    for (const sym of m) {
      if (sym === ".") (s += dot(cx + 1.8, y, 1.8)), (cx += 7);
      else (s += `<rect x="${f1(cx)}" y="${f1(y - 1.8)}" width="11" height="3.6" rx="1.8" fill="${INK}"/>`), (cx += 15);
    }
  });
  return s;
}

function braille(): string {
  const dots: Record<string, string> = { a: "1", b: "12", c: "14", d: "145", e: "15", f: "124", g: "1245", h: "125", i: "24", j: "245", k: "13", l: "123", m: "134", n: "1345", o: "135", p: "1234", q: "12345", r: "1235", s: "234", t: "2345", u: "136", v: "1236", w: "2456", x: "1346", y: "13456", z: "1356" };
  let s = "";
  Object.entries(dots).forEach(([ch, d], i) => {
    const col = i % 6, row = Math.floor(i / 6);
    const x = 50 + col * 40, y = 52 + row * 50;
    for (let k = 1; k <= 6; k++) {
      const [dx, dy] = [k <= 3 ? 0 : 9, ((k - 1) % 3) * 9];
      s += d.includes(String(k)) ? dot(x + dx, y + dy, 3) : circle(x + dx, y + dy, 1.2, 0.5);
    }
    s += text(x + 4.5, y + 33, ch.toUpperCase(), 7, { bold: true });
  });
  return s;
}

function isoPaper(): string {
  // A0 is 841 × 1189 mm; halving the long side gives the next size, at the same proportion.
  const k = 196 / 841;
  let [x, y, w, h] = [150 - (841 * k) / 2, 30, 841 * k, 1189 * k];
  let s = rect(x, y, w, h, 1.4);
  for (let i = 1; i <= 9; i++) {
    // Split along the long side: the first half is A(i), the second is split again.
    let kept: [number, number, number, number];
    if (h >= w) {
      s += line(x, y + h / 2, x + w, y + h / 2, i < 5 ? 1 : 0.7);
      kept = [x, y, w, h / 2];
      [y, h] = [y + h / 2, h / 2];
    } else {
      s += line(x + w / 2, y, x + w / 2, y + h, i < 5 ? 1 : 0.7);
      kept = [x, y, w / 2, h];
      [x, w] = [x + w / 2, w / 2];
    }
    if (i <= 6) s += text(kept[0] + kept[2] / 2, kept[1] + kept[3] / 2 + 3, `A${i}`, Math.max(5, 16 - i * 2), { bold: true });
  }
  return s;
}

function compassRose(): string {
  const names = ["N", "NbE", "NNE", "NEbN", "NE", "NEbE", "ENE", "EbN", "E", "EbS", "ESE", "SEbE", "SE", "SEbS", "SSE", "SbE", "S", "SbW", "SSW", "SWbS", "SW", "SWbW", "WSW", "WbS", "W", "WbN", "WNW", "NWbW", "NW", "NWbN", "NNW", "NbW"];
  const CX = 150, CY = 160;
  let s = circle(CX, CY, 96, 1) + circle(CX, CY, 92, 0.5);
  names.forEach((n, i) => {
    const a = (i / 32) * Math.PI * 2;
    const major = i % 8 === 0, half = i % 4 === 0;
    const r = major ? 88 : half ? 70 : i % 2 === 0 ? 56 : 44;
    s += line(CX, CY, CX + Math.sin(a) * r, CY - Math.cos(a) * r, major ? 1.6 : half ? 1 : 0.6);
    const rt = 110 + (i % 2 ? 0 : 0);
    s += `<text x="${f1(CX + Math.sin(a) * rt)}" y="${f1(CY - Math.cos(a) * rt + 2)}" fill="${INK}" font-size="${major ? 8 : 5}" font-family="DejaVu Sans Mono, monospace" text-anchor="middle"${major ? ` font-weight="bold"` : ""} transform="rotate(${f1((i / 32) * 360)} ${f1(CX + Math.sin(a) * rt)} ${f1(CY - Math.cos(a) * rt)})">${n}</text>`;
  });
  return s;
}

function qwerty(): string {
  const rows: [string, number][] = [["`1234567890-=", 0], ["QWERTYUIOP[]\\", 1.5], ["ASDFGHJKL;'", 1.75], ["ZXCVBNM,./", 2.25]];
  const u = 17, x0 = 150 - (14.5 * u) / 2, y0 = 110;
  let s = "";
  rows.forEach(([keys, off], r) => {
    [...keys].forEach((k, i) => {
      const x = x0 + (off + i) * u, y = y0 + r * u;
      s += `<rect x="${f1(x + 0.8)}" y="${f1(y + 0.8)}" width="${f1(u - 1.6)}" height="${f1(u - 1.6)}" rx="2" fill="none" stroke="${INK}" stroke-width=".8"/>` + text(x + u / 2, y + u / 2 + 2.5, k, 7, { bold: true });
    });
  });
  s += `<rect x="${f1(x0 + 3.75 * u + 0.8)}" y="${f1(y0 + 4 * u + 0.8)}" width="${f1(6.25 * u - 1.6)}" height="${f1(u - 1.6)}" rx="2" fill="none" stroke="${INK}" stroke-width=".8"/>`;
  return s;
}

export function typeSet(): Set7Design[] {
  const out: Set7Design[] = [];
  const add = (title: string, key: string, body: string, description: string, cap: [string, string?, string?], extra: Partial<Record<FeatureKey, number>> = {}, subject?: string) =>
    out.push({ body: body + caption(cap[0].length > 24 ? 332 : 322, cap[0], cap[1], cap[2]), variant: "type-data", category: "type", title, subject: subject ?? title, description, features: { ...FEAT, ...extra }, sigKey: `type-${key}` });

  add("Beaufort Wind Scale", "beaufort", table(
    [["0", "Calm", "<1"], ["1", "Light air", "1–3"], ["2", "Light breeze", "4–6"], ["3", "Gentle breeze", "7–10"], ["4", "Moderate breeze", "11–16"], ["5", "Fresh breeze", "17–21"], ["6", "Strong breeze", "22–27"], ["7", "Near gale", "28–33"], ["8", "Gale", "34–40"], ["9", "Strong gale", "41–47"], ["10", "Storm", "48–55"], ["11", "Violent storm", "56–63"], ["12", "Hurricane force", "64+"]],
    { head: ["F", "Description", "Knots"], align: ["end", "start", "end"] },
  ), "The Beaufort scale of wind force, 0 to 12, with its descriptions and wind speeds in knots.", ["Beaufort Scale", "Wind force and speed in knots"]);

  add("Shipping Forecast Areas", "shipping", table(
    ((a) => Array.from({ length: 16 }, (_, i) => [a[i], a[i + 16] ?? ""]))(["Viking", "North Utsire", "South Utsire", "Forties", "Cromarty", "Forth", "Tyne", "Dogger", "Fisher", "German Bight", "Humber", "Thames", "Dover", "Wight", "Portland", "Plymouth", "Biscay", "Trafalgar", "FitzRoy", "Sole", "Lundy", "Fastnet", "Irish Sea", "Shannon", "Rockall", "Malin", "Hebrides", "Bailey", "Fair Isle", "Faeroes", "Southeast Iceland"]),
  ), "The 31 sea areas of the BBC Shipping Forecast, in the order they are read, as they have been named since 2002.", ["Shipping Forecast", "The 31 sea areas, in broadcast order"]);

  add("NATO Phonetic Alphabet", "nato", table(
    ((w) => Array.from({ length: 13 }, (_, i) => [w[i][0], w[i], w[i + 13][0], w[i + 13]]))(["Alfa", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "X-ray", "Yankee", "Zulu"]),
  ), "The ICAO / NATO radiotelephony spelling alphabet, Alfa to Zulu, with the official spellings Alfa and Juliett.", ["Spelling Alphabet", "ICAO · NATO"]);

  add("Morse Code", "morse", morse(), "International Morse code for the letters and digits, dots and dashes drawn to their proportions.", ["Morse Code", "International, letters and digits"], { geometric: 0.55 });

  add("Periodic Table of the Elements", "periodic", periodicTable(), "All 118 elements in the standard 18-column periodic table, with the lanthanides and actinides set below, each with its atomic number.", ["Periodic Table", "118 elements, hydrogen to oganesson"], { geometric: 0.6, density: 0.5 });

  add("Cloud Genera", "clouds", table(
    [["High", "Cirrus", "Ci"], ["", "Cirrocumulus", "Cc"], ["", "Cirrostratus", "Cs"], ["Middle", "Altocumulus", "Ac"], ["", "Altostratus", "As"], ["", "Nimbostratus", "Ns"], ["Low", "Stratocumulus", "Sc"], ["", "Stratus", "St"], ["", "Cumulus", "Cu"], ["", "Cumulonimbus", "Cb"]],
    { head: ["Étage", "Genus", ""] },
  ), "The ten cloud genera of the WMO International Cloud Atlas, by height, with their abbreviations.", ["Cloud Genera", "WMO International Cloud Atlas"], { nature: 0.3 });

  {
    let body = "";
    const pangram = "The quick brown fox jumps over the lazy dog";
    let y = 48;
    for (const size of [5, 6, 7, 8, 9, 10, 12, 14, 18, 24]) {
      const words = pangram.split(" ");
      let lineStr = "";
      for (const w of words) {
        if ((lineStr + " " + w).trim().length * size * 0.6 > 244) break;
        lineStr = (lineStr + " " + w).trim();
      }
      body += text(28, y, `${size}`, 5, { anchor: "start" }) + text(44, y, lineStr, size, { anchor: "start" });
      y += size * 1.35 + 5;
    }
    add("Pangram, Ten Sizes", "pangram", body, "The pangram “The quick brown fox jumps over the lazy dog” set in one monospace face at ten sizes, smallest to largest, each line as long as its size allows.", ["Pangram", "One face, ten sizes"]);
  }

  add("Pi to 500 Places", "pi", digitBlock("3.", piDigits(498), 25, 20), "The first 500 digits of π, computed from Machin's formula and set 25 to a line.", ["π", "The first 500 digits"], { geometric: 0.45, density: 0.55 }, "Digits of Pi");
  add("e to 500 Places", "e", digitBlock("2.", eDigits(498), 25, 20), "The first 500 digits of Euler's number e, computed from its series and set 25 to a line.", ["e", "The first 500 digits"], { geometric: 0.45, density: 0.55 }, "Digits of Euler's Number");
  add("Square Root of Two to 500 Places", "sqrt2", digitBlock("1.", sqrt2Digits(498), 25, 20), "The first 500 digits of the square root of two, computed and set 25 to a line.", ["√2", "The first 500 digits"], { geometric: 0.45, density: 0.55 }, "Digits of the Square Root of Two");
  add("Golden Ratio to 500 Places", "phi", digitBlock("1.", phiDigits(498), 25, 20), "The first 500 digits of the golden ratio φ, (1 + √5) / 2, computed and set 25 to a line.", ["φ", "The first 500 digits"], { geometric: 0.45, density: 0.55 }, "Digits of the Golden Ratio");

  add("Braille Alphabet", "braille", braille(), "The 26 letters of the braille alphabet, each a cell of six dot positions with the raised dots filled.", ["Braille", "The alphabet in six-dot cells"], { geometric: 0.6 });

  add("ISO 216 Paper Sizes", "iso216", isoPaper(), "The ISO 216 A series: A0 of one square metre, each size half the one before at the same proportion, one to the square root of two.", ["ISO 216", "A0 = 1 m², each size half the last", "A4 = 210 × 297 mm"], { geometric: 0.7, architectural: 0.2 });

  {
    const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B", "C"];
    add("Equal Temperament, One Octave", "semitones", table(
      names.map((n, i) => [`${n}${i === 12 ? 5 : 4}`, (440 * 2 ** ((i - 9) / 12)).toFixed(2), `2^${i}/12`.replace("2^0/12", "1").replace("2^12/12", "2"), `${i * 100}`]),
      { head: ["Note", "Hz", "Ratio", "Cents"], align: ["start", "end", "end", "end"] },
    ), "The chromatic octave from middle C in twelve-tone equal temperament, tuned to A4 = 440 Hz: each semitone the twelfth root of two above the last.", ["Equal Temperament", "A4 = 440 Hz"]);
  }

  add("Mohs Scale of Hardness", "mohs", table(
    [["1", "Talc"], ["2", "Gypsum"], ["3", "Calcite"], ["4", "Fluorite"], ["5", "Apatite"], ["6", "Orthoclase"], ["7", "Quartz"], ["8", "Topaz"], ["9", "Corundum"], ["10", "Diamond"]],
    { align: ["end", "start"] },
  ), "Friedrich Mohs's scale of mineral hardness: ten minerals, each scratching the ones before it.", ["Mohs Scale", "Each scratches the ones above"], { nature: 0.3 });

  add("Saffir–Simpson Hurricane Scale", "saffir", table(
    [["1", "64–82", "74–95"], ["2", "83–95", "96–110"], ["3", "96–112", "111–129"], ["4", "113–136", "130–156"], ["5", "137+", "157+"]],
    { head: ["Cat", "Knots", "mph"], align: ["end", "end", "end"], top: 120, bottom: 250 },
  ), "The Saffir–Simpson hurricane wind scale: five categories by one-minute sustained wind, in knots and miles per hour.", ["Saffir–Simpson", "Sustained wind, one minute"]);

  add("Enhanced Fujita Scale", "fujita", table(
    [["EF0", "65–85"], ["EF1", "86–110"], ["EF2", "111–135"], ["EF3", "136–165"], ["EF4", "166–200"], ["EF5", "200+"]],
    { head: ["", "mph"], align: ["start", "end"], top: 110, bottom: 260 },
  ), "The Enhanced Fujita scale of tornado damage, EF0 to EF5, with its three-second gust speeds in miles per hour.", ["Enhanced Fujita", "Tornado scale, 3-second gust"]);

  add("Greek Alphabet", "greek", table(
    ((g: string[][]) => g)([["Α", "α", "alpha"], ["Β", "β", "beta"], ["Γ", "γ", "gamma"], ["Δ", "δ", "delta"], ["Ε", "ε", "epsilon"], ["Ζ", "ζ", "zeta"], ["Η", "η", "eta"], ["Θ", "θ", "theta"], ["Ι", "ι", "iota"], ["Κ", "κ", "kappa"], ["Λ", "λ", "lambda"], ["Μ", "μ", "mu"], ["Ν", "ν", "nu"], ["Ξ", "ξ", "xi"], ["Ο", "ο", "omicron"], ["Π", "π", "pi"], ["Ρ", "ρ", "rho"], ["Σ", "σ", "sigma"], ["Τ", "τ", "tau"], ["Υ", "υ", "upsilon"], ["Φ", "φ", "phi"], ["Χ", "χ", "chi"], ["Ψ", "ψ", "psi"], ["Ω", "ω", "omega"]].reduce<string[][]>((rows, r, i, a) => (i < 12 ? [...rows, [...r, "", ...a[i + 12]]] : rows), [])),
  ), "The 24 letters of the Greek alphabet, capital and small, with their names.", ["Greek Alphabet", "24 letters"]);

  add("SI Base Units", "si-base", table(
    [["s", "second", "time"], ["m", "metre", "length"], ["kg", "kilogram", "mass"], ["A", "ampere", "electric current"], ["K", "kelvin", "temperature"], ["mol", "mole", "amount of substance"], ["cd", "candela", "luminous intensity"]],
    { top: 90, bottom: 260 },
  ), "The seven base units of the International System of Units, with their symbols and the quantities they measure.", ["SI Base Units", "The seven"]);

  add("SI Prefixes", "si-prefix", table(
    [["Q", "quetta", "30"], ["R", "ronna", "27"], ["Y", "yotta", "24"], ["Z", "zetta", "21"], ["E", "exa", "18"], ["P", "peta", "15"], ["T", "tera", "12"], ["G", "giga", "9"], ["M", "mega", "6"], ["k", "kilo", "3"], ["h", "hecto", "2"], ["da", "deca", "1"], ["d", "deci", "−1"], ["c", "centi", "−2"], ["m", "milli", "−3"], ["μ", "micro", "−6"], ["n", "nano", "−9"], ["p", "pico", "−12"], ["f", "femto", "−15"], ["a", "atto", "−18"], ["z", "zepto", "−21"], ["y", "yocto", "−24"], ["r", "ronto", "−27"], ["q", "quecto", "−30"]].map(([s, n, e]) => [s, n, `10^${e}`]),
    { align: ["end", "start", "end"], top: 36 },
  ), "All 24 SI prefixes, quetta to quecto, with their powers of ten (the four newest added in 2022).", ["SI Prefixes", "10^30 to 10^−30"]);

  {
    const fib = [0n, 1n];
    while (fib.length < 40) fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
    add("Fibonacci Numbers", "fibonacci", table(Array.from({ length: 20 }, (_, i) => [`F${i}`, fib[i].toString(), `F${i + 20}`, fib[i + 20].toString()]), { align: ["start", "end", "start", "end"] }), "The first forty Fibonacci numbers, each the sum of the two before, computed from F0 = 0 and F1 = 1.", ["Fibonacci", "F0 to F39"], { geometric: 0.4 });
  }
  {
    const primes: number[] = [];
    for (let n = 2; n < 1000; n++) if (primes.every((p) => p * p > n || n % p)) primes.push(n);
    let body = "";
    primes.forEach((p, i) => (body += text(34 + (i % 12) * 21, 46 + Math.floor(i / 12) * 17.5, String(p), 7)));
    add("Primes below 1000", "primes", body, `All ${primes.length} prime numbers below one thousand, computed and set in rows of twelve.`, ["Primes", `The ${primes.length} below 1000`], { geometric: 0.45, density: 0.5 });
  }

  add("Points of the Compass", "compass", compassRose(), "All thirty-two points of the mariner's compass, north by east to north by west, each named on its ray.", ["Points of the Compass", "All 32, by quarter point"], { geometric: 0.75, classic: 0.5 });

  add("Defining Constants of the SI", "si-constants", table(
    [["ΔνCs", "9 192 631 770 Hz"], ["c", "299 792 458 m/s"], ["h", "6.626 070 15 × 10^−34 J s"], ["e", "1.602 176 634 × 10^−19 C"], ["k", "1.380 649 × 10^−23 J/K"], ["NA", "6.022 140 76 × 10^23 /mol"], ["Kcd", "683 lm/W"]],
    { top: 90, bottom: 260 },
  ), "The seven exact constants that have defined the SI units since 2019, from the caesium frequency to the luminous efficacy.", ["Exact Constants", "The SI since 20 May 2019"]);

  add("Powers of Two", "powers2", table(Array.from({ length: 17 }, (_, i) => [`2^${i}`, (2n ** BigInt(i)).toString(), `2^${i + 16}`, (2n ** BigInt(i + 16)).toString()]), { align: ["start", "end", "start", "end"] }), "The powers of two from 2^0 to 2^32, computed.", ["Powers of Two", "1 to 4 294 967 296"], { retro: 0.4 });

  add("QWERTY Keyboard", "qwerty", qwerty(), "The QWERTY layout of the four character rows of a US keyboard, the keys staggered as on the machine, with the space bar.", ["QWERTY", "US layout, character rows"], { retro: 0.5, geometric: 0.5 });

  add("The Ten Brightest Stars", "brightest", table(
    [["Sirius", "−1.46"], ["Canopus", "−0.74"], ["Alpha Centauri", "−0.27"], ["Arcturus", "−0.05"], ["Vega", "0.03"], ["Capella", "0.08"], ["Rigel", "0.13"], ["Procyon", "0.34"], ["Achernar", "0.46"], ["Betelgeuse", "0.50*"]],
    { head: ["Star", "Mag"], align: ["start", "end"] },
  ), "The ten brightest stars of the night sky with their apparent visual magnitudes; Betelgeuse varies.", ["Brightest Stars", "Apparent magnitude · *variable"], { nature: 0.35 });

  {
    const cons: { latin: string }[] = JSON.parse(readFileSync(nodePath.resolve(__dirname, "..", "..", "..", "data", "sky", "constellations.json"), "utf8"));
    const names = [...new Set(cons.map((c) => c.latin.replace(/ (Caput|Cauda)$/, "")))].sort();
    add("The 88 Constellations", "constellations", table(Array.from({ length: Math.ceil(names.length / 3) }, (_, i) => [names[i], names[i + 30] ?? "", names[i + 60] ?? ""]), { top: 36 }), `The ${names.length} constellations recognised by the International Astronomical Union, Andromeda to Vulpecula, in their Latin names.`, ["88 Constellations", "IAU, in Latin"], { nature: 0.3 });
  }

  add("The Fourteen Eight-Thousanders", "8000", table(
    [["Everest", "8849"], ["K2", "8611"], ["Kangchenjunga", "8586"], ["Lhotse", "8516"], ["Makalu", "8485"], ["Cho Oyu", "8188"], ["Dhaulagiri I", "8167"], ["Manaslu", "8163"], ["Nanga Parbat", "8126"], ["Annapurna I", "8091"], ["Gasherbrum I", "8080"], ["Broad Peak", "8051"], ["Gasherbrum II", "8035"], ["Shishapangma", "8027"]],
    { head: ["Peak", "m"], align: ["start", "end"] },
  ), "The fourteen mountains higher than 8,000 metres, all in the Himalaya and Karakoram, with their heights (Everest as surveyed in 2020).", ["Eight-Thousanders", "Metres above sea level"], { nature: 0.45 });

  add("Seas of the Moon", "maria", table(
    ((m) => Array.from({ length: 10 }, (_, i) => [m[i], m[i + 10] ?? ""]))(["Imbrium", "Serenitatis", "Tranquillitatis", "Crisium", "Fecunditatis", "Nectaris", "Nubium", "Humorum", "Frigoris", "Vaporum", "Cognitum", "Insularum", "Smythii", "Marginis", "Undarum", "Spumans", "Orientale", "Australe", "Moscoviense", "Ingenii"]),
    { head: ["Mare", ""] },
  ), "The lunar maria by their IAU names, from the Ocean of Storms to the Sea of Ingenuity: the dark basalt plains of the moon.", ["Lunar Maria", "IAU names"], { nature: 0.3 });

  add("Roman Numerals", "roman", table(
    [["I", "1"], ["V", "5"], ["X", "10"], ["L", "50"], ["C", "100"], ["D", "500"], ["M", "1000"], ["", ""], ["IV", "4"], ["IX", "9"], ["XL", "40"], ["XC", "90"], ["CD", "400"], ["CM", "900"], ["", ""], ["MMXXVI", "2026"]],
    { align: ["end", "end"] },
  ), "The seven Roman numerals, the six subtractive pairs, and the year 2026 written with them.", ["Roman Numerals", "Seven letters, six pairs"], { classic: 0.6 });

  add("Hexadecimal Digits", "hex", table(Array.from({ length: 16 }, (_, i) => [i.toString(16).toUpperCase(), i.toString(2).padStart(4, "0"), String(i)]), { head: ["Hex", "Binary", "Dec"], align: ["end", "end", "end"] }), "The sixteen hexadecimal digits, 0 to F, with their four-bit binary and decimal values.", ["Hexadecimal", "Sixteen digits, four bits"], { retro: 0.5 });

  add("Typographic Units", "typo-units", table(
    [["1 point", "1/72 inch", "0.3528 mm"], ["1 pica", "12 points", "4.2333 mm"], ["1 inch", "6 picas", "25.4 mm"], ["1 Didot point", "", "0.376 mm"], ["1 cicero", "12 Didot points", "4.512 mm"], ["1 em", "the type size", ""], ["1 en", "half an em", ""]],
    { top: 90, bottom: 260 },
  ), "The typesetter's units: the DTP point and pica, the Didot point and cicero, the em and the en.", ["Typographic Units", "Point, pica, cicero, em"]);

  return out;
}
