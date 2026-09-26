/**
 * ASCII Art: pixel-font banners typed out in characters, ray-marched 3D
 * solids shaded with a character ramp, hand-drawn ASCII pieces and ASCII
 * landscapes. Everything sits on a monospace grid; each run of characters
 * is pinned with textLength so columns line up in any monospace font.
 */
import { IH, IW, X0, Y0, an, int, n1, pick, range, type Generator, type Rng } from "../core";
import { MONO, esc, pixelTextRows, textEl, wrap } from "../art";
import { CX } from "../svg";
import { ASCII_ART, BANNER_CAPTIONS, BANNER_WORDS, SCENE_CAPTIONS, SHADE_CAPTIONS } from "../copy3";

/** Advance of one monospace cell, as a fraction of font size. */
const CELL = 0.6;

/** Render text rows on a monospace grid (top-left at x0,y0). */
export function asciiBlock(lines: string[], x0: number, y0: number, fs: number, ink: string, lh = 1, weight = 700) {
  const cw = fs * CELL;
  let out = "";
  lines.forEach((line, r) => {
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const run = m[0];
      const fit = run.length > 1 ? ` textLength="${n1(run.length * cw)}" lengthAdjust="spacingAndGlyphs"` : "";
      out += `<text x="${n1(x0 + m.index * cw)}" y="${n1(y0 + (r + 0.8) * fs * lh)}"${fit}>${esc(run)}</text>`;
    }
  });
  return `<g font-size="${n1(fs)}" font-weight="${weight}" ${MONO} fill="${ink}">${out}</g>`;
}

/** A box of + - | characters exactly filling the print area. */
function asciiFrame(ink: string, fs = 11) {
  const cols = Math.floor(IW / (fs * CELL));
  const rows = Math.floor(IH / fs);
  const lines = Array.from({ length: rows }, (_, r) =>
    r === 0 || r === rows - 1 ? `+${"-".repeat(cols - 2)}+` : `|${" ".repeat(cols - 2)}|`,
  );
  const x0 = X0 + (IW - cols * fs * CELL) / 2;
  return asciiBlock(lines, x0, Y0 + (IH - rows * fs) / 2, fs, ink, 1, 400);
}

const mono = (txt: string, x: number, y: number, size: number, ink: string, anchor: "start" | "middle" | "end" = "middle", maxW = IW - 24) =>
  textEl(txt, x, y, size, { fill: ink, font: MONO, anchor, maxW });


/* ------------------------------------------------------------------ */
/* Banner — big letters built from characters                          */
/* ------------------------------------------------------------------ */

export const asciiBanner: Generator = (rng, ink) => {
  const words = pick(rng, BANNER_WORDS);
  const fillMode = pick(rng, ["#", "@", "$", "letter", "8", "%"]);
  const shadowChar = rng() < 0.5 ? pick(rng, ["/", ":", "."]) : "";
  const framed = rng() < 0.5;
  const caption = pick(rng, BANNER_CAPTIONS);

  // Pixel-font rows → character rows (+1 row/col for the drop shadow).
  const block: string[] = [];
  words.forEach((word, wi) => {
    const rows = pixelTextRows(word);
    const width = rows[0].length + 1;
    const grid = Array.from({ length: 8 }, () => Array<string>(width).fill(" "));
    rows.forEach((row, r) =>
      [...row].forEach((cell, c) => {
        if (cell === "X") grid[r][c] = fillMode === "letter" ? word[Math.floor(c / 6)] : fillMode;
        else if (shadowChar && r > 0 && c > 0 && rows[r - 1][c - 1] === "X") grid[r][c] = shadowChar;
      }),
    );
    if (shadowChar) rows[6].split("").forEach((cell, c) => cell === "X" && (grid[7][c + 1] = shadowChar));
    if (wi > 0) block.push("");
    block.push(...grid.map((g) => g.join("")));
  });
  const cols = Math.max(...block.map((l) => l.length));
  const availH = IH - (framed ? 120 : 96);
  const fs = Math.min((IW - (framed ? 40 : 16)) / (cols * CELL), availH / block.length, 22);
  const bw = cols * fs * CELL;
  const bh = block.length * fs;
  let body = framed ? asciiFrame(ink) : "";
  const inset = framed ? 22 : 4;
  body += mono(`$ banner "${words.join(" ").toLowerCase()}"`, X0 + inset, Y0 + inset + 12, 10, ink, "start");
  body += asciiBlock(block, CX - bw / 2, Y0 + (IH - bh) / 2, fs, ink);
  body += mono(`> ${caption}`, CX, Y0 + IH - inset - 4, 10, ink);
  const density = Math.min(1, 0.4 + (fillMode === "letter" ? 0 : 0.1) + (shadowChar ? 0.1 : 0) + words.length * 0.05);
  return {
    body,
    variant: "ascii-banner",
    sig: { key: `banner-${words.join("-")}`, vec: [] },
    description: `“${words.join(" ")}” in giant letters typed out of ${fillMode === "letter" ? "its own letters" : `“${fillMode}” characters`}${shadowChar ? ", with a drop shadow" : ""}. ${caption[0].toUpperCase()}${caption.slice(1)}.`,
    complexity: 0.4,
    features: {
      typography: range(rng, 0.8, 0.92), retro: range(rng, 0.8, 0.95), wit: range(rng, 0.55, 0.8), density, halftone_raster: range(rng, 0.15, 0.3),
      geometric: range(rng, 0.25, 0.4), contrast: range(rng, 0.6, 0.8), dark_industrial: range(rng, 0.35, 0.5), clean_minimal: range(rng, 0.3, 0.45), line_art: 0.1,
    },
  };
};

/* ------------------------------------------------------------------ */
/* Shade — ray-marched solids, lit with a character ramp               */
/* ------------------------------------------------------------------ */

type V3 = [number, number, number];
const len3 = (p: V3) => Math.hypot(p[0], p[1], p[2]);
const SOLIDS = ["sphere", "donut", "cube", "capsule", "octa"] as const;
type Solid = (typeof SOLIDS)[number];

function sdf(shape: Solid, [x, y, z]: V3): number {
  switch (shape) {
    case "sphere":
      return len3([x, y, z]) - 1;
    case "donut":
      return Math.hypot(Math.hypot(x, z) - 0.72, y) - 0.34;
    case "cube": {
      const q: V3 = [Math.abs(x) - 0.6, Math.abs(y) - 0.6, Math.abs(z) - 0.6];
      return len3([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]) + Math.min(Math.max(...q), 0) - 0.12;
    }
    case "capsule":
      return len3([x, y - Math.max(-0.55, Math.min(0.55, y)), z]) - 0.45;
    case "octa":
      return (Math.abs(x) + Math.abs(y) + Math.abs(z) - 1.15) * 0.57735;
  }
}

function rotate([x, y, z]: V3, a: number, b: number): V3 {
  // Rx(a) then Ry(b)
  const y1 = y * Math.cos(a) - z * Math.sin(a);
  const z1 = y * Math.sin(a) + z * Math.cos(a);
  return [x * Math.cos(b) + z1 * Math.sin(b), y1, -x * Math.sin(b) + z1 * Math.cos(b)];
}

const RAMPS = [" .:-=+*#%@", " .,:;ox%#@", " .-:=+*%#@", " .'^:;!|I#"];

function shadeGrid(rng: Rng, shape: Solid, cols: number, rows: number, fs: number, lh: number) {
  const a = range(rng, 0.3, 1.2);
  const b = range(rng, 0.2, 1.3);
  const lx = range(rng, -0.7, 0.7);
  const L: V3 = [lx, 0.65, -1];
  const ll = len3(L);
  const light: V3 = [L[0] / ll, L[1] / ll, L[2] / ll];
  const ramp = pick(rng, RAMPS);
  const stars = rng() < 0.35;
  const cw = fs * CELL;
  const ch = fs * lh;
  const scale = Math.min(cols * cw, rows * ch) / 2.45;
  const f = (p: V3) => sdf(shape, rotate(p, a, b));
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) * cw - (cols * cw) / 2) / scale;
      const y = -((r + 0.5) * ch - (rows * ch) / 2) / scale;
      let t = 0;
      let hit = false;
      for (let i = 0; i < 64 && t < 6; i++) {
        const d = f([x, y, -3 + t]);
        if (d < 0.002) {
          hit = true;
          break;
        }
        t += d;
      }
      if (!hit) {
        line += stars && rng() < 0.025 ? pick(rng, [".", "*", "+"]) : " ";
        continue;
      }
      const p: V3 = [x, y, -3 + t];
      const e = 0.002;
      const n: V3 = [
        f([p[0] + e, p[1], p[2]]) - f([p[0] - e, p[1], p[2]]),
        f([p[0], p[1] + e, p[2]]) - f([p[0], p[1] - e, p[2]]),
        f([p[0], p[1], p[2] + e]) - f([p[0], p[1], p[2] - e]),
      ];
      const nl = len3(n) || 1;
      const diffuse = Math.max(0, (n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) / nl);
      const bright = 0.1 + 0.9 * diffuse;
      line += ramp[1 + Math.min(ramp.length - 2, Math.floor(bright * (ramp.length - 1)))];
    }
    lines.push(line);
  }
  return { lines, a, b, lx };
}

export const asciiShade: Generator = (rng, ink) => {
  const shape = pick(rng, SOLIDS);
  const cols = 40;
  const fs = IW / (cols * CELL);
  const rows = 28;
  const { lines, a, b, lx } = shadeGrid(rng, shape, cols, rows, fs, 1);
  const caption = pick(rng, SHADE_CAPTIONS[shape]);
  let body = asciiBlock(lines, X0, Y0 + 6, fs, ink, 1, 700);
  body += mono(`$ ./render --shape=${shape} --light=${lx < 0 ? "left" : "right"}`, X0, Y0 + IH - 22, 10, ink, "start");
  body += mono(caption, X0, Y0 + IH - 6, 10, ink, "start");
  return {
    body,
    variant: "ascii-shade",
    sig: { key: `shade-${shape}`, vec: shape === "sphere" ? [(lx + 0.7) / 1.4] : [(a - 0.3) / 0.9, (b - 0.2) / 1.1] },
    description: `${an(shape === "octa" ? "octahedron" : shape === "donut" ? "doughnut" : shape).replace(/^a/, "A")} rendered in 3D with nothing but characters, lit from the ${lx < 0 ? "left" : "right"}. ${caption[0].toUpperCase()}${caption.slice(1)}.`,
    complexity: 0.55,
    features: {
      geometric: range(rng, 0.68, 0.85), halftone_raster: range(rng, 0.55, 0.72), typography: range(rng, 0.42, 0.58), retro: range(rng, 0.7, 0.86), abstract: range(rng, 0.35, 0.5),
      density: range(rng, 0.5, 0.65), contrast: range(rng, 0.55, 0.7), dark_industrial: range(rng, 0.4, 0.55), clean_minimal: range(rng, 0.25, 0.4), wit: range(rng, 0.25, 0.42), line_art: 0.08,
    },
  };
};

/* ------------------------------------------------------------------ */
/* Art — hand-drawn ASCII pieces                                       */
/* ------------------------------------------------------------------ */

const ART_NATURE: Record<string, number> = { cat: 0.4, owl: 0.5, whale: 0.55, dog: 0.35, snail: 0.5, cactus: 0.55, coffee: 0.05, rocket: 0, robot: 0, house: 0.1, ghost: 0, ufo: 0 };

export const asciiArt: Generator = (rng, ink) => {
  const name = pick(rng, Object.keys(ASCII_ART));
  const piece = ASCII_ART[name];
  const style = pick(rng, ["plain", "boxed", "window"] as const);
  const caption = pick(rng, piece.captions);
  const art = piece.art.split("\n").filter((l, i, all) => l.trim() || (i > 0 && i < all.length - 1));
  const indent = Math.min(...art.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
  const lines = art.map((l) => l.slice(indent));
  const cols = Math.max(...lines.map((l) => l.length));
  const lh = 1.1;
  const pad = style === "boxed" ? 2 : 0;
  const fs = Math.min(26, (IW - 56) / ((cols + pad * 2) * CELL), 210 / ((lines.length + pad * 2) * lh));
  const block = style === "boxed"
    ? [`+${"-".repeat(cols + 2)}+`, `|${" ".repeat(cols + 2)}|`, ...lines.map((l) => `| ${l.padEnd(cols)} |`), `|${" ".repeat(cols + 2)}|`, `+${"-".repeat(cols + 2)}+`]
    : lines;
  const bCols = Math.max(...block.map((l) => l.length));
  const bw = bCols * fs * CELL;
  const bh = block.length * fs * lh;
  const capLines = wrap(caption, 30);
  const capH = capLines.length * 16;
  const top = Y0 + (IH - bh - capH - 36) / 2 + (style === "window" ? 14 : 0);
  let body = "";
  if (style === "window") {
    body += `<rect x="${X0 + 4}" y="${Y0 + 8}" width="${IW - 8}" height="${IH - 16}" rx="6" fill="none" stroke="${ink}" stroke-width="3"/>`;
    body += `<path d="M${X0 + 4} ${Y0 + 34} H${X0 + IW - 4}" stroke="${ink}" stroke-width="3"/>`;
    body += mono(`[ ${name}.txt ]`, CX, Y0 + 26, 11, ink);
    body += mono("[x]", X0 + IW - 14, Y0 + 26, 11, ink, "end");
  }
  body += asciiBlock(block, CX - bw / 2, top, fs, ink, lh);
  capLines.forEach((l, i) => (body += mono(l, CX, top + bh + 34 + i * 16, 12, ink, "middle", IW - 40)));
  return {
    body,
    variant: "ascii-art",
    sig: { key: `art-${name}`, vec: [] },
    description: `Hand-typed ASCII ${name}${style === "boxed" ? " in a character frame" : style === "window" ? " in a terminal window" : ""}: “${caption}”.`,
    complexity: 0.35,
    features: {
      pictorial: range(rng, 0.6, 0.75), typography: range(rng, 0.48, 0.6), retro: range(rng, 0.8, 0.92), wit: range(rng, 0.65, 0.85), line_art: range(rng, 0.45, 0.6),
      clean_minimal: range(rng, 0.5, 0.65), density: range(rng, 0.22, 0.38), contrast: range(rng, 0.55, 0.7), nature: ART_NATURE[name] ?? 0, geometric: 0.15,
      dark_industrial: range(rng, 0.2, 0.35),
    },
  };
};

/* ------------------------------------------------------------------ */
/* Scene — landscapes typed out                                        */
/* ------------------------------------------------------------------ */

type Grid = string[][];
const put = (g: Grid, r: number, c: number, ch: string) => {
  if (r >= 0 && r < g.length && c >= 0 && c < g[0].length) g[r][c] = ch;
};

function walk(rng: Rng, cols: number, base: number, amp: number, jag: number) {
  const h: number[] = [];
  let y = base + range(rng, -amp, amp) * 0.5;
  for (let c = 0; c < cols; c++) {
    y += range(rng, -1, 1) * jag;
    y = Math.max(base - amp, Math.min(base + amp * 0.5, y));
    h.push(Math.round(y));
  }
  return h;
}

function sceneGrid(rng: Rng, type: string, cols: number, rows: number, aspect: number): { g: Grid; param: number } {
  const g: Grid = Array.from({ length: rows }, () => Array<string>(cols).fill(" "));
  const starfield = (maxRow: number, p: number) => {
    for (let r = 0; r < maxRow; r++) for (let c = 0; c < cols; c++) if (rng() < p) g[r][c] = pick(rng, [".", ".", "*", "+", "'"]);
  };
  const disc = (cr: number, cc: number, rad: number, ch: (r: number, c: number) => string | null) => {
    for (let r = Math.floor(cr - rad); r <= cr + rad; r++)
      for (let c = Math.floor(cc - rad / aspect); c <= cc + rad / aspect; c++) {
        const d = Math.hypot((c - cc) * aspect, r - cr);
        if (d <= rad) {
          const v = ch(r, c);
          if (v) put(g, r, c, v);
        }
      }
  };
  if (type === "moonsea") {
    const hz = int(rng, 15, 19);
    starfield(hz - 1, 0.035);
    const mc = range(rng, cols * 0.25, cols * 0.75);
    const rad = range(rng, 3.2, 4.6);
    const mr = range(rng, rad + 1.5, hz - rad - 3);
    disc(mr, mc, rad, () => (rng() < 0.12 ? "o" : "@"));
    for (let c = 0; c < cols; c++) g[hz][c] = "-";
    for (let r = hz + 1; r < rows; r++) {
      const k = r - hz;
      const w = (rad / aspect) * (1 - k * 0.04);
      for (let c = 0; c < cols; c++) {
        if (Math.abs(c - mc) < w && rng() < 0.8) g[r][c] = "=";
        else if (rng() < 0.3) g[r][c] = rng() < 0.7 ? "~" : "-";
      }
    }
    return { g, param: (mc - cols * 0.25) / (cols * 0.5) };
  }
  if (type === "mountains") {
    const layers = int(rng, 2, 4);
    starfield(8, 0.03);
    const sc = range(rng, 4, cols - 4);
    disc(range(rng, 3, 6), sc, 2.2, () => "@");
    const chars = { 2: [":", "#"], 3: [".", ":", "#"], 4: [".", ":", "+", "#"] }[layers]!;
    for (let k = 0; k < layers; k++) {
      const base = 12 + k * (12 / layers);
      const h = walk(rng, cols, base, 6 - k, 1.1);
      for (let c = 0; c < cols; c++) {
        for (let r = h[c] + 1; r < rows; r++) g[r][c] = chars[k];
        const prev = h[c - 1] ?? h[c];
        g[h[c]][c] = h[c] < prev ? "/" : h[c] > prev ? "\\" : k === layers - 1 ? "^" : "_";
      }
    }
    return { g, param: (layers - 2) / 2 };
  }
  if (type === "sunset") {
    const hz = int(rng, 15, 18);
    const rad = range(rng, 6, 9);
    const sc = range(rng, cols * 0.35, cols * 0.65);
    disc(hz, sc, rad, (r) => (r > hz ? null : (hz - r) % 3 === 0 && r > hz - rad * 0.7 ? null : "#"));
    for (let i = 0; i < int(rng, 2, 4); i++) put(g, int(rng, 1, hz - rad - 2), int(rng, 2, cols - 3), "v");
    for (let c = 0; c < cols; c++) g[hz][c] = "_";
    for (let r = hz + 1; r < rows; r++) {
      const w = (rad / aspect) * (1 - (r - hz) * 0.06);
      for (let c = 0; c < cols; c++) {
        if (Math.abs(c - sc) < w && (r - hz) % 2 === 1) g[r][c] = "=";
        else if (rng() < 0.22) g[r][c] = "~";
      }
    }
    return { g, param: (sc - cols * 0.35) / (cols * 0.3) };
  }
  // city
  starfield(10, 0.03);
  // crescent moon: a disc minus an offset disc
  const mr = range(rng, 3, 5);
  const mc = range(rng, 5, cols - 5);
  disc(mr, mc, 2.6, (r, c) => (Math.hypot((c - mc - 2.2) * aspect, r - mr + 0.6) < 2.3 ? null : "@"));
  const ground = rows - 2;
  let c = 0;
  let tall = 0;
  while (c < cols) {
    const w = int(rng, 3, 7);
    const h = int(rng, 6, 20);
    tall = Math.max(tall, h);
    const top = ground - h;
    for (let x = c; x < Math.min(cols, c + w); x++) {
      for (let r = top; r <= ground; r++) {
        const edge = x === c || x === c + w - 1;
        g[r][x] = r === top ? "_" : edge ? "|" : (r - top) % 2 === 0 && (x - c) % 2 === 1 ? (rng() < 0.55 ? "#" : ".") : " ";
      }
    }
    if (h > 15 && w >= 5) for (let r = top - 3; r < top; r++) put(g, r, c + Math.floor(w / 2), "|");
    c += w;
  }
  for (let x = 0; x < cols; x++) g[rows - 1][x] = "=";
  return { g, param: (tall - 6) / 14 };
}

export const asciiScene: Generator = (rng, ink) => {
  const type = pick(rng, ["moonsea", "mountains", "sunset", "city"] as const);
  const framed = rng() < 0.45;
  const cols = framed ? 36 : 40;
  const fs = (IW - (framed ? 26 : 0)) / (cols * CELL);
  const rows = 26;
  const { g, param } = sceneGrid(rng, type, cols, rows, (fs * CELL) / fs);
  const caption = pick(rng, SCENE_CAPTIONS[type]);
  let body = framed ? asciiFrame(ink) : "";
  const x0 = X0 + (IW - cols * fs * CELL) / 2;
  body += asciiBlock(g.map((r) => r.join("")), x0, Y0 + (framed ? 18 : 4), fs, ink, 1, 700);
  body += mono(`// ${caption}`, CX, Y0 + IH - (framed ? 20 : 6), 10, ink);
  const nature = type === "city" ? 0.1 : range(rng, 0.6, 0.8);
  return {
    body,
    variant: "ascii-scene",
    sig: { key: `scene-${type}`, vec: [param] },
    description: `${{ moonsea: "Moonrise over the sea", mountains: "A mountain range", sunset: "A striped sunset over water", city: "A night skyline" }[type]}, typed out in ASCII. ${caption[0].toUpperCase()}${caption.slice(1)}.`,
    complexity: 0.5,
    features: {
      pictorial: range(rng, 0.6, 0.75), nature, architectural: type === "city" ? range(rng, 0.45, 0.6) : 0.05, retro: range(rng, 0.75, 0.9), typography: range(rng, 0.38, 0.5),
      halftone_raster: range(rng, 0.3, 0.45), density: range(rng, 0.45, 0.6), wit: range(rng, 0.25, 0.4), contrast: range(rng, 0.55, 0.7), line_art: 0.2,
      dark_industrial: range(rng, 0.35, 0.5), clean_minimal: range(rng, 0.25, 0.4),
    },
  };
};
