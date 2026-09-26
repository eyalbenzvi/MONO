/**
 * The original five generative families (catalog ids 1–1000). Do not change
 * the order of random draws here: the prints are expected to stay
 * byte-identical when the catalog is regenerated.
 */
import type { ShirtCategory } from "../../types/shirt";
import {
  IH, IW, M, W, H, X0, Y0,
  clamp01, int, n1, pick, polygon, pts, range, smooth,
  type Design, type Generator, type Rng, type Signature,
  POLYGON, an, scale, screen,
} from "./core";
import { MONO, SANS, measure, sizeToFit } from "./art";

/* a) Architectural grids & perspective ------------------------------ */

const facadeGrid: Generator = (rng, ink) => {
  const cols = int(rng, 4, 12);
  const rows = int(rng, 5, 16);
  const fillP = range(rng, 0.08, 0.65);
  const sw = pick(rng, [1, 1.5, 2, 3]);
  const cw = IW / cols;
  const ch = IH / rows;
  const gap = range(rng, 0.14, 0.32) * Math.min(cw, ch);
  let filled = 0;
  let cells = `<rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}"/>`;
  const bandRows = new Set(Array.from({ length: rows }, (_, r) => r).filter(() => rng() < 0.1));
  for (let r = 0; r < rows; r++) {
    if (bandRows.has(r)) {
      cells += `<rect x="${X0}" y="${n1(Y0 + r * ch + gap / 2)}" width="${IW}" height="${n1(ch - gap)}" fill="${ink}"/>`;
      filled += cols;
      continue;
    }
    for (let c = 0; c < cols; c++) {
      const on = rng() < fillP;
      if (on) filled++;
      cells += `<rect x="${n1(X0 + c * cw + gap / 2)}" y="${n1(Y0 + r * ch + gap / 2)}" width="${n1(cw - gap)}" height="${n1(ch - gap)}"${on ? ` fill="${ink}"` : ""}/>`;
    }
  }
  const fillRatio = filled / (cols * rows);
  const count = (cols * rows) / 192;
  const density = clamp01(count * 0.65 + fillRatio * 0.45);
  return {
    body: `<g fill="none" stroke="${ink}" stroke-width="${sw}">${cells}</g>`,
    variant: "facade",
    sig: { key: "facade", vec: [(cols - 4) / 8, (rows - 5) / 11, fillRatio] },
    description: `Brutalist facade grid of ${cols * rows > 80 ? "tight" : "wide"} bays, ${scale(fillRatio, 0.08, 0.65, ["mostly open", "half filled in", "heavily filled in"])}.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.55, 0.75),
      typography: 0.02,
      architectural: range(rng, 0.88, 1),
      abstract: range(rng, 0.05, 0.2),
      line_art: 0.25 + (1 - fillRatio) * 0.3,
      halftone_raster: cols * rows > 120 ? 0.2 : 0.06,
      density,
      contrast: 0.45 + fillRatio * 0.4 + (sw - 1) * 0.08,
      dark_industrial: 0.35 + density * 0.5,
      clean_minimal: 0.75 - density * 0.6,
    },
  };
};

const perspectiveCorridor: Generator = (rng, ink) => {
  const vx = W / 2 + range(rng, -70, 70);
  const vy = range(rng, 120, 280);
  const rays = int(rng, 14, 44);
  const frames = int(rng, 4, 14);
  const sw = pick(rng, [0.8, 1, 1.5, 2]);
  const border: [number, number][] = [];
  const per = Math.ceil(rays / 4);
  for (let i = 0; i < per; i++) {
    const t = i / per;
    border.push([X0 + t * IW, Y0], [X0 + IW, Y0 + t * IH], [X0 + IW - t * IW, Y0 + IH], [X0, Y0 + IH - t * IH]);
  }
  let d = "";
  for (const [x, y] of border) d += `M${n1(vx)},${n1(vy)} L${n1(x)},${n1(y)} `;
  let rects = "";
  const growth = range(rng, 0.62, 0.82);
  let s = 1;
  for (let i = 0; i < frames; i++) {
    s *= growth;
    const lerp = (a: number, b: number) => b + (a - b) * s;
    rects += `<rect x="${n1(lerp(X0, vx))}" y="${n1(lerp(Y0, vy))}" width="${n1(IW * s)}" height="${n1(IH * s)}"/>`;
  }
  const density = clamp01((rays / 44) * 0.6 + (frames / 14) * 0.4);
  return {
    body: `<g fill="none" stroke="${ink}" stroke-width="${sw}"><rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}"/><path d="${d.trim()}"/>${rects}</g>`,
    variant: "perspective",
    sig: { key: "perspective", vec: [(vx - 80) / 140, (vy - 120) / 160] },
    description: `One-point perspective corridor${frames > 7 ? ", frames receding deep into the distance" : ", a few frames receding into the distance"}${rays > 30 ? ", rays packed tight" : ""}.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.5, 0.7),
      typography: 0.02,
      architectural: range(rng, 0.8, 0.95),
      abstract: range(rng, 0.15, 0.3),
      line_art: range(rng, 0.68, 0.9),
      halftone_raster: 0.02,
      density,
      contrast: 0.45 + sw * 0.12,
      dark_industrial: 0.45 + density * 0.35,
      clean_minimal: 0.62 - density * 0.5,
    },
  };
};

const skyline: Generator = (rng, ink, ground) => {
  const towers = int(rng, 5, 13);
  const baseY = Y0 + IH - range(rng, 0, 40);
  let x = X0;
  let body = "";
  let area = 0;
  const widths = Array.from({ length: towers }, () => range(rng, 0.6, 1.6));
  const total = widths.reduce((a, b) => a + b, 0);
  const windowP = range(rng, 0.2, 0.7);
  for (const wRel of widths) {
    const w = (wRel / total) * IW;
    const h = range(rng, 0.25, 0.92) * (baseY - Y0);
    body += `<rect x="${n1(x)}" y="${n1(baseY - h)}" width="${n1(w - 1)}" height="${n1(h)}" fill="${ink}"/>`;
    area += w * h;
    // window grid knocked out in ground colour
    const wc = Math.max(1, Math.floor(w / 9));
    const wr = Math.floor(h / 12);
    for (let r = 0; r < wr; r++)
      for (let c = 0; c < wc; c++)
        if (rng() < windowP)
          body += `<rect x="${n1(x + 3 + c * ((w - 4) / wc))}" y="${n1(baseY - h + 5 + r * 12)}" width="${n1(Math.max(1.5, (w - 4) / wc - 3))}" height="5" fill="${ground}"/>`;
    x += w;
  }
  body += `<line x1="${X0}" y1="${n1(baseY)}" x2="${X0 + IW}" y2="${n1(baseY)}" stroke="${ink}" stroke-width="2"/>`;
  const coverage = area / (IW * IH);
  return {
    body,
    variant: "skyline",
    sig: { key: "skyline", vec: [(towers - 5) / 8, windowP] },
    description: `${towers > 8 ? "Crowded" : "Sparse"} solid skyline with knocked-out window grids.`,
    complexity: clamp01(coverage + windowP * 0.3),
    features: {
      geometric: range(rng, 0.55, 0.7),
      typography: 0.02,
      architectural: range(rng, 0.88, 1),
      abstract: range(rng, 0.05, 0.18),
      line_art: range(rng, 0.08, 0.25),
      halftone_raster: windowP * 0.3,
      density: clamp01(coverage * 0.8 + windowP * 0.3),
      contrast: range(rng, 0.78, 0.96),
      dark_industrial: 0.55 + coverage * 0.4,
      clean_minimal: 0.4 - coverage * 0.3,
    },
  };
};

const slabStack: Generator = (rng, ink) => {
  const slabs = int(rng, 4, 11);
  const cols = int(rng, 2, 6);
  let body = "";
  let y = Y0;
  let solid = 0;
  const heights = Array.from({ length: slabs }, () => range(rng, 0.5, 1.5));
  const total = heights.reduce((a, b) => a + b, 0);
  const sw = pick(rng, [1.5, 2, 3]);
  for (const hRel of heights) {
    const h = (hRel / total) * IH;
    const offset = range(rng, -18, 18);
    const isSolid = rng() < 0.45;
    if (isSolid) solid++;
    body += `<rect x="${n1(X0 + 10 + offset)}" y="${n1(y + 3)}" width="${n1(IW - 20)}" height="${n1(h - 6)}"${isSolid ? ` fill="${ink}"` : ""}/>`;
    if (!isSolid)
      for (let c = 1; c < cols; c++) {
        const cx = X0 + 10 + offset + (c / cols) * (IW - 20);
        body += `<line x1="${n1(cx)}" y1="${n1(y + 3)}" x2="${n1(cx)}" y2="${n1(y + h - 3)}"/>`;
      }
    y += h;
  }
  const solidRatio = solid / slabs;
  const density = clamp01(0.3 + solidRatio * 0.45 + (slabs / 11) * 0.25);
  return {
    body: `<g fill="none" stroke="${ink}" stroke-width="${sw}">${body}</g>`,
    variant: "slabs",
    sig: { key: "slabs", vec: [solidRatio, (slabs - 4) / 7] },
    description: `Cantilevered stack of concrete slabs, ${solid === 0 ? "all left open" : solid === slabs ? "all poured solid" : solid > slabs / 2 ? "mostly poured solid" : "a few poured solid"}.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.6, 0.8),
      typography: 0.02,
      architectural: range(rng, 0.78, 0.95),
      abstract: range(rng, 0.2, 0.35),
      line_art: 0.2 + (1 - solidRatio) * 0.35,
      halftone_raster: 0.03,
      density,
      contrast: 0.55 + solidRatio * 0.4,
      dark_industrial: 0.5 + solidRatio * 0.4,
      clean_minimal: 0.55 - solidRatio * 0.35,
    },
  };
};

/* b) Geometric & polygons ------------------------------------------- */

function shape(rng: Rng, cx: number, cy: number, r: number, ink: string, fill: boolean, sw: number, kinds?: string[]) {
  const kind = pick(rng, ["circle", "square", "triangle", "hex", "diamond"] as const);
  kinds?.push(kind);
  const style = fill ? `fill="${ink}"` : `fill="none" stroke="${ink}" stroke-width="${sw}"`;
  // Keep the whole shape inside the print margins (never cut off at the edge).
  const pad = r + sw;
  cx = Math.min(X0 + IW - pad, Math.max(X0 + pad, cx));
  cy = Math.min(Y0 + IH - pad, Math.max(Y0 + pad, cy));
  if (kind === "circle") return `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" ${style}/>`;
  const sides = kind === "triangle" ? 3 : kind === "hex" ? 6 : 4;
  const rot = kind === "square" ? Math.PI / 4 + range(rng, -0.3, 0.3) : kind === "diamond" ? 0 : range(rng, 0, Math.PI * 2);
  return `<polygon points="${pts(polygon(cx, cy, r, sides, rot))}" ${style}/>`;
}

const monoForm: Generator = (rng, ink) => {
  const n = int(rng, 1, 3);
  const sw = pick(rng, [2, 3, 4, 6]);
  let body = "";
  let filled = 0;
  const kinds: string[] = [];
  for (let i = 0; i < n; i++) {
    const fill = rng() < 0.5;
    if (fill) filled++;
    body += shape(rng, W / 2 + range(rng, -35, 35), H / 2 + range(rng, -50, 50), range(rng, 55, 115), ink, fill, sw, kinds);
  }
  const fillRatio = filled / n;
  return {
    body,
    variant: "monoform",
    sig: { key: `monoform-${n}-${kinds[0]}`, vec: [fillRatio] },
    description: `${n === 1 ? "A single" : n === 2 ? "Two overlapping" : "Three overlapping"} primary form${n > 1 ? "s" : ""}, reduced to pure geometry.`,
    complexity: 0.15 + n * 0.08,
    features: {
      geometric: range(rng, 0.88, 1),
      typography: 0,
      architectural: range(rng, 0.05, 0.18),
      abstract: range(rng, 0.45, 0.65),
      line_art: 0.1 + (1 - fillRatio) * 0.3,
      halftone_raster: 0,
      density: 0.1 + n * 0.07 + fillRatio * 0.12,
      contrast: 0.6 + fillRatio * 0.35,
      dark_industrial: range(rng, 0.08, 0.25),
      clean_minimal: range(rng, 0.82, 0.97),
    },
  };
};

const scatter: Generator = (rng, ink) => {
  const n = int(rng, 5, 14);
  const fillP = range(rng, 0.2, 0.8);
  const sw = pick(rng, [1.5, 2, 3]);
  let body = "";
  let filled = 0;
  for (let i = 0; i < n; i++) {
    const fill = rng() < fillP;
    if (fill) filled++;
    body += shape(rng, range(rng, X0 + 25, X0 + IW - 25), range(rng, Y0 + 25, Y0 + IH - 25), range(rng, 12, 55), ink, fill, sw);
  }
  const fillRatio = filled / n;
  const density = clamp01(0.3 + (n / 14) * 0.35 + fillRatio * 0.2);
  return {
    body,
    variant: "scatter",
    sig: { key: "scatter", vec: [fillRatio, (n - 5) / 9] },
    description: `${n < 8 ? "A handful of" : n < 11 ? "A dozen or so" : "A crowd of"} primitives scattered in a loose constellation.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.82, 0.96),
      typography: 0,
      architectural: range(rng, 0.03, 0.12),
      abstract: range(rng, 0.6, 0.8),
      line_art: 0.15 + (1 - fillRatio) * 0.3,
      halftone_raster: 0.05,
      density,
      contrast: 0.55 + fillRatio * 0.3,
      dark_industrial: range(rng, 0.15, 0.35),
      clean_minimal: 0.7 - density * 0.4,
    },
  };
};

const concentric: Generator = (rng, ink) => {
  const sides = int(rng, 3, 8);
  const rings = int(rng, 5, 18);
  const twist = range(rng, 0, 0.18) * (rng() < 0.5 ? -1 : 1);
  const sw = pick(rng, [1, 1.5, 2]);
  const maxR = range(rng, 105, 130);
  let body = "";
  for (let i = 0; i < rings; i++) {
    const r = maxR * (1 - i / rings);
    body += `<polygon points="${pts(polygon(W / 2, H / 2, r, sides, -Math.PI / 2 + i * twist))}"/>`;
  }
  const density = clamp01(0.25 + (rings / 18) * 0.55);
  return {
    body: `<g fill="none" stroke="${ink}" stroke-width="${sw}">${body}</g>`,
    variant: "concentric",
    sig: { key: `concentric-${sides}-${Math.abs(twist) > 0.06 ? "spiral" : "straight"}`, vec: [] },
    description: `${rings > 12 ? "Dense" : "Open"} concentric ${POLYGON[sides]}s${twist ? ", twisting slowly inward" : ""}.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.9, 1),
      typography: 0,
      architectural: range(rng, 0.1, 0.25),
      abstract: range(rng, 0.5, 0.7),
      line_art: range(rng, 0.55, 0.78),
      halftone_raster: 0.03,
      density,
      contrast: 0.45 + sw * 0.12,
      dark_industrial: range(rng, 0.12, 0.3),
      clean_minimal: 0.75 - density * 0.35,
    },
  };
};

const truchet: Generator = (rng, ink) => {
  const cols = int(rng, 4, 10);
  const size = IW / cols;
  const rows = Math.floor(IH / size);
  const y0 = Y0 + (IH - rows * size) / 2;
  const fillP = range(rng, 0.35, 0.75);
  let d = "";
  let filled = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (rng() > fillP) continue;
      filled++;
      const x = X0 + c * size;
      const y = y0 + r * size;
      const corner = int(rng, 0, 3);
      const tri: [number, number][][] = [
        [[x, y], [x + size, y], [x, y + size]],
        [[x, y], [x + size, y], [x + size, y + size]],
        [[x + size, y], [x + size, y + size], [x, y + size]],
        [[x, y], [x + size, y + size], [x, y + size]],
      ];
      d += `M${pts(tri[corner]).replace(/ /g, " L")}Z`;
    }
  const fillRatio = filled / (rows * cols);
  const density = clamp01(0.35 + fillRatio * 0.4 + (cols / 10) * 0.2);
  return {
    body: `<path d="${d}" fill="${ink}"/><rect x="${X0}" y="${n1(y0)}" width="${IW}" height="${n1(rows * size)}" fill="none" stroke="${ink}" stroke-width="1.5"/>`,
    variant: "tiling",
    sig: { key: "tiling", vec: [(cols - 4) / 6] },
    description: `Truchet tiling of half-square triangles, ${cols * rows > 60 ? "fine-grained" : "bold and chunky"}.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.9, 1),
      typography: 0,
      architectural: range(rng, 0.2, 0.35),
      abstract: range(rng, 0.45, 0.6),
      line_art: 0.08,
      halftone_raster: cols >= 8 ? 0.25 : 0.1,
      density,
      contrast: range(rng, 0.78, 0.95),
      dark_industrial: 0.3 + density * 0.3,
      clean_minimal: 0.45 - density * 0.3,
    },
  };
};

/* c) Typography & coordinates --------------------------------------- */

const WORDS = [
  "VOID", "MONO", "RAW", "NULL", "GRID", "ECHO", "FORM", "MASS", "SLAB", "ZERO",
  "NOISE", "STATIC", "SIGNAL", "INDEX", "AXIS", "BLOCK", "UNIT", "DATA", "LOOP", "TONE",
];

const bigWord: Generator = (rng, ink) => {
  const word = pick(rng, WORDS);
  const vertical = rng() < 0.35;
  const outline = rng() < 0.35;
  const span = vertical ? IH : IW;
  // Sized from measured glyph widths (heavy M/W are much wider than average).
  const size = sizeToFit(word, span - 12, "sansBold", vertical ? 130 : 150, -2);
  const style = outline ? `fill="none" stroke="${ink}" stroke-width="2"` : `fill="${ink}"`;
  const text = vertical
    ? `<text x="0" y="0" transform="translate(${n1(W / 2 + size * 0.35)},${H / 2}) rotate(-90)" text-anchor="middle" font-size="${n1(size)}" font-weight="900" letter-spacing="-2" ${SANS} ${style}>${word}</text>`
    : `<text x="${W / 2}" y="${n1(H / 2 + size * 0.35)}" text-anchor="middle" font-size="${n1(size)}" font-weight="900" letter-spacing="-2" ${SANS} ${style}>${word}</text>`;
  const serial = `NO.${String(int(rng, 1, 999)).padStart(3, "0")}`;
  const caption = `<text x="${X0}" y="${Y0 + IH}" font-size="9" letter-spacing="2" ${MONO} fill="${ink}">MONO / ${serial} / MMXXVI</text><line x1="${X0}" y1="${Y0 + IH - 16}" x2="${X0 + IW}" y2="${Y0 + IH - 16}" stroke="${ink}" stroke-width="1"/>`;
  return {
    body: text + caption,
    variant: "word",
    sig: { key: `word-${word}-${vertical ? "v" : "h"}-${outline ? "o" : "f"}`, vec: [] },
    description: `"${word}" set ${vertical ? "vertically " : ""}in heavy grotesk${outline ? ", outlined" : ""}.`,
    complexity: 0.25,
    features: {
      geometric: range(rng, 0.15, 0.3),
      typography: range(rng, 0.9, 1),
      architectural: range(rng, 0.05, 0.15),
      abstract: range(rng, 0.05, 0.2),
      line_art: outline ? range(rng, 0.3, 0.45) : 0.08,
      halftone_raster: 0,
      density: range(rng, 0.15, 0.35),
      contrast: outline ? range(rng, 0.6, 0.75) : range(rng, 0.8, 0.96),
      dark_industrial: range(rng, 0.2, 0.45),
      clean_minimal: range(rng, 0.72, 0.9),
    },
  };
};

const coordinates: Generator = (rng, ink) => {
  const lat = range(rng, -80, 80);
  const lon = range(rng, -179, 179);
  const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}&#176; ${v >= 0 ? pos : neg}`;
  const lines = int(rng, 6, 18);
  const cx = range(rng, X0 + 60, X0 + IW - 60);
  const cy = range(rng, Y0 + 70, Y0 + 170);
  let body = `<g stroke="${ink}" stroke-width="1"><line x1="${X0}" y1="${n1(cy)}" x2="${X0 + IW}" y2="${n1(cy)}"/><line x1="${n1(cx)}" y1="${Y0}" x2="${n1(cx)}" y2="${n1(cy + 90)}"/><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(range(rng, 10, 26))}" fill="none"/></g>`;
  body += `<text x="${X0}" y="${n1(cy + 125)}" font-size="26" font-weight="700" ${SANS} fill="${ink}">${fmt(lat, "N", "S")}</text>`;
  body += `<text x="${X0}" y="${n1(cy + 155)}" font-size="26" font-weight="700" ${SANS} fill="${ink}">${fmt(lon, "E", "W")}</text>`;
  let y = cy + 185;
  for (let i = 0; i < lines && y < Y0 + IH; i++, y += 12) {
    const a = (lat + range(rng, -1, 1)).toFixed(3);
    const b = (lon + range(rng, -1, 1)).toFixed(3);
    body += `<text x="${X0}" y="${n1(y)}" font-size="8.5" ${MONO} fill="${ink}">${String(i + 1).padStart(2, "0")}  ${a}  ${b}  ${int(rng, 10, 999)}M</text>`;
  }
  const density = clamp01(0.3 + (lines / 18) * 0.35);
  return {
    body,
    variant: "coordinates",
    sig: { key: "coords", vec: [(lines - 6) / 12, (cx - X0 - 60) / (IW - 120), (cy - Y0 - 70) / 100] },
    description: `Survey sheet for ${fmt(lat, "N", "S").replace("&#176;", "°")}: a crosshair and a column of logged points.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.3, 0.5),
      typography: range(rng, 0.85, 0.95),
      architectural: range(rng, 0.2, 0.4),
      abstract: range(rng, 0.05, 0.15),
      line_art: range(rng, 0.3, 0.5),
      halftone_raster: 0.03,
      density,
      contrast: range(rng, 0.55, 0.72),
      dark_industrial: range(rng, 0.3, 0.5),
      clean_minimal: 0.75 - density * 0.4,
    },
  };
};

const repeatStack: Generator = (rng, ink) => {
  const word = pick(rng, WORDS);
  const lines = int(rng, 7, 16);
  const lh = IH / lines;
  const size = sizeToFit(word, IW, "sansBold", lh * 1.05, -1);
  const alt = rng() < 0.6;
  let body = "";
  for (let i = 0; i < lines; i++) {
    const outline = alt && i % 2 === 1;
    body += `<text x="${W / 2}" y="${n1(Y0 + (i + 1) * lh - lh * 0.12)}" text-anchor="middle" font-size="${n1(size)}" font-weight="900" letter-spacing="-1" ${SANS} ${outline ? `fill="none" stroke="${ink}" stroke-width="1.2"` : `fill="${ink}"`}>${word}</text>`;
  }
  const density = clamp01(0.55 + (lines / 16) * 0.35);
  return {
    body,
    variant: "repeat",
    sig: { key: `repeat-${word}-${alt ? "alt" : "solid"}`, vec: [(lines - 7) / 9] },
    description: `"${word}" stacked down the print${lines > 11 ? ", tightly" : ""}${alt ? ", alternating solid and outline" : ""}.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.2, 0.35),
      typography: range(rng, 0.95, 1),
      architectural: range(rng, 0.1, 0.25),
      abstract: range(rng, 0.1, 0.25),
      line_art: alt ? 0.3 : 0.08,
      halftone_raster: 0.08,
      density,
      contrast: range(rng, 0.75, 0.95),
      dark_industrial: 0.4 + density * 0.35,
      clean_minimal: 0.4 - density * 0.25,
    },
  };
};

const manifesto: Generator = (rng, ink) => {
  const heading = pick(rng, WORDS);
  const cols = int(rng, 2, 3);
  const rows = int(rng, 16, 28);
  const colW = (IW - (cols - 1) * 10) / cols;
  let body = `<text x="${X0}" y="${Y0 + 44}" font-size="46" font-weight="900" letter-spacing="-1" ${SANS} fill="${ink}">${heading}</text><rect x="${X0}" y="${Y0 + 54}" width="${IW}" height="4" fill="${ink}"/>`;
  const lh = (IH - 76) / rows;
  const perLine = Math.max(1, Math.floor(colW / 30));
  const fs = Math.min(8.5, lh * 0.8);
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const picked = Array.from({ length: perLine }, () => pick(rng, WORDS));
      // Drop trailing words that would run into the next column.
      while (picked.length > 1 && measure(picked.join(" "), fs, "mono", 0.5) > colW) picked.pop();
      const words = picked.join(" ");
      body += `<text x="${n1(X0 + c * (colW + 10))}" y="${n1(Y0 + 76 + (r + 1) * lh)}" font-size="${n1(fs)}" letter-spacing="0.5" ${MONO} fill="${ink}">${words}</text>`;
    }
  const density = clamp01(0.65 + (rows / 28) * 0.3);
  return {
    body,
    variant: "manifesto",
    sig: { key: `manifesto-${cols}`, vec: [(rows - 16) / 12] },
    description: `Manifesto layout: ${an(heading)} masthead over columns of dense type.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.15, 0.3),
      typography: range(rng, 0.9, 1),
      architectural: range(rng, 0.2, 0.35),
      abstract: range(rng, 0.05, 0.15),
      line_art: 0.1,
      halftone_raster: range(rng, 0.12, 0.28),
      density,
      contrast: range(rng, 0.55, 0.75),
      dark_industrial: 0.45 + density * 0.25,
      clean_minimal: 0.3 - density * 0.15,
    },
  };
};

/* d) Dot matrix & halftone ------------------------------------------ */

function dotGrid(
  rng: Rng,
  ink: string,
  step: number,
  radiusAt: (x: number, y: number) => number,
): { body: string; coverage: number; dots: number } {
  let body = "";
  let area = 0;
  let dots = 0;
  const cols = Math.floor(IW / step);
  const rows = Math.floor(IH / step);
  const ox = X0 + (IW - (cols - 1) * step) / 2;
  const oy = Y0 + (IH - (rows - 1) * step) / 2;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = ox + c * step;
      const y = oy + r * step;
      const rad = radiusAt(x, y);
      if (rad < 0.45) continue;
      dots++;
      area += Math.PI * rad * rad;
      body += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(rad)}"/>`;
    }
  return { body: `<g fill="${ink}">${body}</g>`, coverage: area / (IW * IH), dots };
}

const radialHalftone: Generator = (rng, ink) => {
  const step = int(rng, 11, 18);
  const cx = range(rng, X0, X0 + IW);
  const cy = range(rng, Y0, Y0 + IH);
  const invert = rng() < 0.4;
  const gamma = range(rng, 0.7, 1.8);
  const maxD = Math.hypot(Math.max(cx - X0, X0 + IW - cx), Math.max(cy - Y0, Y0 + IH - cy));
  const { body, coverage } = dotGrid(rng, ink, step, (x, y) => {
    const t = Math.hypot(x - cx, y - cy) / maxD;
    return (step / 2) * 0.98 * Math.pow(invert ? t : 1 - t, gamma);
  });
  return {
    body,
    variant: "radial",
    sig: { key: `radial-${invert ? "inv" : "std"}`, vec: [(cx - X0) / IW, (cy - Y0) / IH] },
    description: `Radial halftone burst on ${an(screen(step, 6, 16))} screen${invert ? ", inverted" : ""}.`,
    complexity: clamp01(coverage * 1.5 + (18 - step) / 14),
    features: {
      geometric: range(rng, 0.2, 0.35),
      typography: 0,
      architectural: range(rng, 0.02, 0.1),
      abstract: range(rng, 0.45, 0.65),
      line_art: 0.03,
      halftone_raster: range(rng, 0.9, 1),
      density: clamp01(coverage * 1.4 + 0.15),
      contrast: range(rng, 0.6, 0.85),
      dark_industrial: range(rng, 0.35, 0.6),
      clean_minimal: range(rng, 0.25, 0.45),
    },
  };
};

const linearHalftone: Generator = (rng, ink) => {
  const step = int(rng, 11, 17);
  const angle = pick(rng, [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4, range(rng, 0, Math.PI)]);
  const bands = int(rng, 1, 3);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const { body, coverage } = dotGrid(rng, ink, step, (x, y) => {
    const proj = ((x - W / 2) * dx + (y - H / 2) * dy) / 250 + 0.5;
    const t = 0.5 + 0.5 * Math.sin(proj * Math.PI * bands);
    return (step / 2) * 0.98 * t;
  });
  return {
    body,
    variant: "gradient",
    sig: { key: `gradient-${bands}`, vec: [(((angle % Math.PI) + Math.PI) % Math.PI) / Math.PI] },
    description: `Ordered halftone gradient${bands > 1 ? " in stacked bands" : ""} on ${an(screen(step, 6, 18))} screen.`,
    complexity: clamp01(coverage * 1.4 + (17 - step) / 12),
    features: {
      geometric: range(rng, 0.25, 0.4),
      typography: 0,
      architectural: range(rng, 0.05, 0.15),
      abstract: range(rng, 0.35, 0.55),
      line_art: 0.05,
      halftone_raster: range(rng, 0.92, 1),
      density: clamp01(coverage * 1.4 + 0.2),
      contrast: range(rng, 0.62, 0.82),
      dark_industrial: range(rng, 0.3, 0.55),
      clean_minimal: range(rng, 0.3, 0.5),
    },
  };
};

const dotMatrix: Generator = (rng, ink) => {
  const step = int(rng, 12, 18);
  const form = pick(rng, ["circle", "ring", "diamond", "bars", "cross"] as const);
  const cx = W / 2;
  const cy = H / 2;
  const R = range(rng, 80, 125);
  const on = (x: number, y: number) => {
    const d = Math.hypot(x - cx, y - cy);
    switch (form) {
      case "circle": return d < R;
      case "ring": return d < R && d > R * 0.55;
      case "diamond": return Math.abs(x - cx) + Math.abs(y - cy) < R * 1.2;
      case "bars": return Math.floor((y - Y0) / (step * 2)) % 2 === 0;
      case "cross": return Math.abs(x - cx) < R * 0.3 || Math.abs(y - cy) < R * 0.3;
    }
  };
  const offR = rng() < 0.5 ? step * 0.12 : 0;
  const { body, coverage } = dotGrid(rng, ink, step, (x, y) => (on(x, y) ? step * 0.4 : offR));
  return {
    body,
    variant: "matrix",
    sig: { key: `matrix-${form}-${offR > 0 ? "grid" : "clean"}`, vec: [] },
    description: `Dot-matrix ${form} on ${an(scale(step, 8, 18, ["fine", "chunky"]))} LED grid.`,
    complexity: clamp01(coverage * 1.5 + 0.2),
    features: {
      geometric: range(rng, 0.45, 0.65),
      typography: 0.05,
      architectural: range(rng, 0.05, 0.15),
      abstract: range(rng, 0.3, 0.5),
      line_art: 0.02,
      halftone_raster: range(rng, 0.85, 0.95),
      density: clamp01(coverage * 1.4 + 0.15),
      contrast: range(rng, 0.65, 0.85),
      dark_industrial: range(rng, 0.35, 0.55),
      clean_minimal: range(rng, 0.4, 0.6),
    },
  };
};

const stipple: Generator = (rng, ink) => {
  const count = int(rng, 350, 800);
  const clusters = int(rng, 1, 3);
  const centers = Array.from({ length: clusters }, () => [range(rng, X0 + 40, X0 + IW - 40), range(rng, Y0 + 40, Y0 + IH - 40), range(rng, 40, 110)]);
  let body = "";
  let area = 0;
  let placed = 0;
  for (let i = 0; i < count; i++) {
    const [cx, cy, spread] = pick(rng, centers);
    // Box–Muller for a gaussian cloud
    const u = Math.max(1e-6, rng());
    const v = rng();
    const g = Math.sqrt(-2 * Math.log(u));
    const x = cx + g * Math.cos(2 * Math.PI * v) * spread * 0.6;
    const y = cy + g * Math.sin(2 * Math.PI * v) * spread * 0.6;
    if (x < X0 || x > X0 + IW || y < Y0 || y > Y0 + IH) continue;
    const r = range(rng, 0.7, 2.1);
    area += Math.PI * r * r;
    placed++;
    body += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}"/>`;
  }
  const density = clamp01(0.3 + (placed / 800) * 0.5);
  return {
    body: `<g fill="${ink}">${body}</g>`,
    variant: "stipple",
    sig: { key: `stipple-${clusters}`, vec: [(placed - 300) / 500] },
    description: `Stippled grain cloud, hand-set dots gathering into ${clusters > 1 ? "separate masses" : "one mass"}${placed > 600 ? ", thick as static" : ", light and airy"}.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.05, 0.15),
      typography: 0,
      architectural: range(rng, 0.02, 0.08),
      abstract: range(rng, 0.62, 0.82),
      line_art: 0.05,
      halftone_raster: range(rng, 0.8, 0.94),
      density,
      contrast: clamp01(0.35 + area / (IW * IH) * 3),
      dark_industrial: range(rng, 0.45, 0.7),
      clean_minimal: range(rng, 0.2, 0.4),
    },
  };
};

/* e) Abstract line art & waves -------------------------------------- */

const ridgeLines: Generator = (rng, ink, ground) => {
  const lines = int(rng, 18, 42);
  const amp = range(rng, 20, 55);
  const sw = pick(rng, [1, 1.2, 1.5]);
  const peaks = int(rng, 1, 3);
  const peakX = Array.from({ length: peaks }, () => range(rng, X0 + 60, X0 + IW - 60));
  let body = "";
  const top = Y0 + 50;
  const gap = (IH - 60) / lines;
  for (let i = 0; i < lines; i++) {
    const base = top + i * gap;
    const p: [number, number][] = [];
    const phase = rng() * 10;
    for (let x = X0; x <= X0 + IW; x += 8) {
      let bump = 0;
      for (const px of peakX) bump += Math.exp(-((x - px) ** 2) / (2 * 26 ** 2));
      const noise = 0.5 + 0.5 * Math.sin(x * 0.11 + phase) * Math.sin(x * 0.037 + phase * 2);
      p.push([x, base - bump * amp * noise]);
    }
    body += `<path d="${smooth(p)} L${X0 + IW},${n1(base + 4)} L${X0},${n1(base + 4)}Z" fill="${ground}" stroke="${ink}" stroke-width="${sw}"/>`;
  }
  const density = clamp01(0.35 + (lines / 42) * 0.5);
  return {
    body,
    variant: "ridges",
    sig: { key: `ridges-${peaks}`, vec: [(lines - 18) / 24] },
    description: `Stacked ridge lines rising into ${peaks > 2 ? "a range of peaks" : peaks > 1 ? "twin peaks" : "a single peak"}, like a pulsar plot${lines > 30 ? ", densely layered" : ""}.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.05, 0.15),
      typography: 0,
      architectural: range(rng, 0.05, 0.15),
      abstract: range(rng, 0.7, 0.9),
      line_art: range(rng, 0.85, 1),
      halftone_raster: 0.05,
      density,
      contrast: range(rng, 0.55, 0.75),
      dark_industrial: range(rng, 0.35, 0.6),
      clean_minimal: 0.5 - density * 0.3,
    },
  };
};

const waveInterference: Generator = (rng, ink) => {
  const families = int(rng, 2, 3);
  const perFamily = int(rng, 8, 22);
  const sw = pick(rng, [0.8, 1, 1.4]);
  let body = "";
  for (let f = 0; f < families; f++) {
    const angle = f === 0 ? 0 : range(rng, -40, 40);
    const freq = range(rng, 0.015, 0.05);
    const amp = range(rng, 6, 24);
    let d = "";
    for (let i = 0; i < perFamily; i++) {
      const y0 = -60 + (i / perFamily) * (H + 120);
      const p: [number, number][] = [];
      for (let x = -60; x <= W + 60; x += 10) p.push([x, y0 + Math.sin(x * freq + i * 0.4) * amp]);
      d += smooth(p) + " ";
    }
    body += `<path d="${d.trim()}" transform="rotate(${n1(angle)} ${W / 2} ${H / 2})"/>`;
  }
  const density = clamp01(0.3 + ((families * perFamily) / 66) * 0.6);
  return {
    body: `<clipPath id="c"><rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}"/></clipPath><g clip-path="url(#c)" fill="none" stroke="${ink}" stroke-width="${sw}">${body}</g>`,
    variant: "interference",
    sig: { key: `interference-${families}`, vec: [(perFamily - 8) / 14] },
    description: `${families > 2 ? "Several" : "Two"} families of sine waves crossing into a moiré.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.15, 0.3),
      typography: 0,
      architectural: range(rng, 0.02, 0.1),
      abstract: range(rng, 0.75, 0.95),
      line_art: range(rng, 0.9, 1),
      halftone_raster: range(rng, 0.1, 0.25),
      density,
      contrast: 0.4 + sw * 0.15,
      dark_industrial: range(rng, 0.15, 0.35),
      clean_minimal: 0.65 - density * 0.35,
    },
  };
};

const contours: Generator = (rng, ink) => {
  const rings = int(rng, 8, 24);
  const cx = W / 2 + range(rng, -30, 30);
  const cy = H / 2 + range(rng, -40, 40);
  const a1 = range(rng, 0.05, 0.2);
  const a2 = range(rng, 0.02, 0.12);
  const p1 = rng() * 6;
  const p2 = rng() * 6;
  const k1 = int(rng, 2, 4);
  const k2 = int(rng, 4, 7);
  const sw = pick(rng, [1, 1.3, 1.8]);
  let body = "";
  for (let i = 1; i <= rings; i++) {
    const R = (i / rings) * range(rng, 120, 128);
    const p: [number, number][] = [];
    for (let s = 0; s < 40; s++) {
      const t = (s / 40) * Math.PI * 2;
      const r = R * (1 + a1 * Math.sin(k1 * t + p1 + i * 0.15) + a2 * Math.sin(k2 * t + p2));
      p.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r * 1.2]);
    }
    body += `<path d="${smooth(p, true)}"/>`;
  }
  const density = clamp01(0.25 + (rings / 24) * 0.55);
  return {
    body: `<clipPath id="c"><rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}"/></clipPath><g clip-path="url(#c)" fill="none" stroke="${ink}" stroke-width="${sw}">${body}</g>`,
    variant: "contours",
    sig: { key: `contours-${k1}`, vec: [(rings - 8) / 16] },
    description: `Topographic contour map${rings > 14 ? " with elevation lines packed tight" : " with wide, gentle elevation lines"}.`,
    complexity: density,
    features: {
      geometric: range(rng, 0.1, 0.25),
      typography: 0,
      architectural: range(rng, 0.1, 0.2),
      abstract: range(rng, 0.6, 0.8),
      line_art: range(rng, 0.88, 1),
      halftone_raster: 0.03,
      density,
      contrast: 0.4 + sw * 0.15,
      dark_industrial: range(rng, 0.12, 0.3),
      clean_minimal: 0.75 - density * 0.35,
    },
  };
};

const continuousLine: Generator = (rng, ink) => {
  const strokes = int(rng, 1, 3);
  const sw = pick(rng, [2, 3, 4, 6]);
  let body = "";
  for (let s = 0; s < strokes; s++) {
    const n = int(rng, 5, 10);
    const p: [number, number][] = Array.from({ length: n }, () => [range(rng, X0 + 20, X0 + IW - 20), range(rng, Y0 + 20, Y0 + IH - 20)]);
    body += `<path d="${smooth(p)}"/>`;
  }
  return {
    body: `<g fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`,
    variant: "gesture",
    sig: { key: `gesture-${strokes}`, vec: [(sw - 2) / 4] },
    description: `${strokes === 1 ? "A single continuous gestural line" : "Continuous gestural lines looping over each other"}.`,
    complexity: 0.15 + strokes * 0.08,
    features: {
      geometric: range(rng, 0.03, 0.12),
      typography: 0,
      architectural: range(rng, 0.02, 0.08),
      abstract: range(rng, 0.8, 0.95),
      line_art: range(rng, 0.85, 0.98),
      halftone_raster: 0,
      density: 0.08 + strokes * 0.07,
      contrast: 0.45 + sw * 0.07,
      dark_industrial: range(rng, 0.05, 0.2),
      clean_minimal: range(rng, 0.82, 0.97),
    },
  };
};

export const LEGACY_CATEGORIES = ["architectural", "geometric", "typography", "halftone", "waves"] as const satisfies readonly ShirtCategory[];
export const LEGACY_GENERATORS: Record<(typeof LEGACY_CATEGORIES)[number], Generator[]> = {
  architectural: [facadeGrid, perspectiveCorridor, skyline, slabStack],
  geometric: [monoForm, scatter, concentric, truchet],
  typography: [bigWord, coordinates, repeatStack, manifesto],
  halftone: [radialHalftone, linearHalftone, dotMatrix, stipple],
  waves: [ridgeLines, waveInterference, contours, continuousLine],
};

