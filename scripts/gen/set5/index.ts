/**
 * Fifth set (new content, T8): generative families the catalog didn't have.
 * Each design is made once, in a fixed order, from real data or real maths —
 * nothing invented and presented as fact:
 * - sky: every constellation's stick figure with its real stars (Yale Bright
 *   Star Catalogue via d3-celestial, data/sky), and a round star-map edition
 *   of the best known;
 * - curves: harmonographs, Lissajous figures and the Lorenz / Rössler
 *   attractors, integrated from their equations;
 * - botany: phyllotaxis seed heads and L-system plants;
 * - ornament: guilloche rosettes, n-fold star rosettes and khatam star tiles.
 * All single-ink SVG on the 300 × 400 canvas.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { FeatureKey } from "../../../types/shirt";
import { H, M, W, mulberry32, n1, type Rng } from "../core";

export interface Set5Design {
  body: string;
  variant: string;
  source: "sky" | "curves" | "botany" | "ornament";
  title: string;
  /** What the print shows, for its page title and search ("Leo Constellation"); the title when unset. */
  subject?: string;
  description: string;
  features: Partial<Record<FeatureKey, number>>;
  /** Near-identical designs share a key (families). */
  sigKey: string;
}

const SKY = path.resolve(__dirname, "..", "..", "..", "data", "sky");
const DEG = Math.PI / 180;
const f1 = (n: number) => n1(n).toString();

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

/** A polyline as compact path data (absolute, one decimal: minify makes it relative). */
function polyline(points: [number, number][]): string {
  let d = "";
  let last = "";
  points.forEach(([x, y], i) => {
    const p = `${f1(x)} ${f1(y)}`;
    if (p === last) return;
    d += (i === 0 ? "M" : "L") + p;
    last = p;
  });
  return d;
}

/** Fit points into a box (keeping proportions), centred. */
function fit(points: [number, number][][], box: { x: number; y: number; w: number; h: number }): [number, number][][] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const line of points) for (const [x, y] of line) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
  const s = Math.min(box.w / (x1 - x0 || 1), box.h / (y1 - y0 || 1));
  const ox = box.x + (box.w - (x1 - x0) * s) / 2 - x0 * s;
  const oy = box.y + (box.h - (y1 - y0) * s) / 2 - y0 * s;
  return points.map((line) => line.map(([x, y]) => [x * s + ox, y * s + oy] as [number, number]));
}

const text = (x: number, y: number, s: string, ink: string, size: number, opts = "") =>
  `<text x="${x}" y="${y}" fill="${ink}" font-size="${size}" font-family="DejaVu Sans Mono, monospace" text-anchor="middle"${opts}>${s.replace(/&/g, "&amp;")}</text>`;

/* ------------------------------------------------------------------ */
/* Sky                                                                  */
/* ------------------------------------------------------------------ */

interface Constellation {
  id: string;
  latin: string;
  en: string;
  lines: [number, number][][];
}

/**
 * English names where the data's differ from the usual ones (and the two
 * halves of Serpens, which the data labels alike: the western one, by
 * Corona Borealis, is the head).
 */
const EN_NAMES: Record<string, string> = {
  Andromeda: "Chained Maiden",
  Aquarius: "Water Bearer",
  Caelum: "Chisel",
  Cassiopeia: "Seated Queen",
  Cepheus: "King",
  Chamaeleon: "Chameleon",
  Eridanus: "River",
  Hydrus: "Water Snake",
  Mensa: "Table Mountain",
  Ophiuchus: "Serpent Bearer",
  Orion: "Hunter",
  Pegasus: "Winged Horse",
  Perseus: "Hero",
  Puppis: "Stern",
  "Ursa Major": "Great Bear",
  "Ursa Minor": "Little Bear",
};

function names(cons: Constellation[]): Constellation[] {
  let serpens = 0;
  return cons.map((c) => {
    if (c.latin === "Serpens Cauda") {
      const head = serpens++ === 0;
      return { ...c, id: head ? "SerCp" : "SerCd", latin: head ? "Serpens Caput" : "Serpens Cauda", en: head ? "Serpent's Head" : "Serpent's Tail" };
    }
    return { ...c, en: EN_NAMES[c.latin] ?? c.en };
  });
}

const hms = (ra: number) => {
  const h = ((ra / 15) % 24 + 24) % 24;
  return `${String(Math.floor(h)).padStart(2, "0")}h ${String(Math.floor((h % 1) * 60)).padStart(2, "0")}m`;
};

function skyDesigns(): Set5Design[] {
  const stars: [number, number, number][] = JSON.parse(readFileSync(path.join(SKY, "stars.json"), "utf8"));
  const cons = names(JSON.parse(readFileSync(path.join(SKY, "constellations.json"), "utf8")));
  const out: Set5Design[] = [];
  // Centre of a constellation: mean of its figure's unit vectors.
  const vec = (lon: number, lat: number) => [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)];
  const FAMOUS = ["Ori", "UMa", "Cas", "Cyg", "Sco", "Leo", "Tau", "Gem", "Lyr", "Cru", "Aql", "Peg", "Per", "And", "Boo", "Cen", "Sgr", "CMa", "Aur", "Dra", "UMi"];
  for (const round of [false, true]) {
    for (const c of cons) {
      if (round && !FAMOUS.includes(c.id)) continue;
      const pts = c.lines.flat();
      // A figure of two or three stars makes an empty print: skip it.
      if (new Set(pts.map((q) => q.join())).size < 5) continue;
      const v = pts.map(([lo, la]) => vec(lo, la)).reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
      const len = Math.hypot(v[0], v[1], v[2]);
      const lat0 = Math.asin(v[2] / len);
      const lon0 = Math.atan2(v[1], v[0]);
      // Gnomonic projection around the centre; x flipped (the sky seen from below).
      const proj = (lon: number, lat: number): [number, number] | null => {
        const [l, b] = [lon * DEG, lat * DEG];
        const cosc = Math.sin(lat0) * Math.sin(b) + Math.cos(lat0) * Math.cos(b) * Math.cos(l - lon0);
        if (cosc <= 0.2) return null;
        return [-(Math.cos(b) * Math.sin(l - lon0)) / cosc, -(Math.cos(lat0) * Math.sin(b) - Math.sin(lat0) * Math.cos(b) * Math.cos(l - lon0)) / cosc];
      };
      const figure = c.lines.map((line) => line.map(([lo, la]) => proj(lo, la)!)).filter((l) => l.every(Boolean));
      if (!figure.length) continue;
      const fp = figure.flat();
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [x, y] of fp) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
      const pad = Math.max(x1 - x0, y1 - y0) * 0.18 + 0.02;
      const field = stars
        .map(([lo, la, mag]) => ({ p: proj(lo, la), mag }))
        .filter((s): s is { p: [number, number]; mag: number } => !!s.p && s.p[0] > x0 - pad && s.p[0] < x1 + pad && s.p[1] > y0 - pad && s.p[1] < y1 + pad);
      const box = round ? { x: 58, y: 70, w: 184, h: 184 } : { x: M + 8, y: M + 16, w: W - 2 * M - 16, h: H - 2 * M - 110 };
      const [fig, ...rest] = [figure, field.map((s) => [s.p])];
      const fitted = fit([...fig, ...rest.flat(), [[x0 - pad, y0 - pad], [x1 + pad, y1 + pad]]], box);
      const figFit = fitted.slice(0, fig.length);
      const starFit = fitted.slice(fig.length, fig.length + field.length).map((l) => l[0]);
      const ink = "#FFFFFF";
      let body = "";
      if (round) {
        body += `<circle cx="150" cy="162" r="112" fill="none" stroke="${ink}" stroke-width="1.2"/><circle cx="150" cy="162" r="106" fill="none" stroke="${ink}" stroke-width=".5"/>`;
        for (let k = 0; k < 72; k++) {
          const a = (k / 72) * Math.PI * 2;
          const r2 = k % 6 === 0 ? 100 : 103;
          body += `<line x1="${f1(150 + Math.cos(a) * r2)}" y1="${f1(162 + Math.sin(a) * r2)}" x2="${f1(150 + Math.cos(a) * 106)}" y2="${f1(162 + Math.sin(a) * 106)}" stroke="${ink}" stroke-width=".5"/>`;
        }
      }
      body += `<path d="${figFit.map((l) => polyline(l)).join("")}" fill="none" stroke="${ink}" stroke-width="${round ? 1.2 : 1.8}" stroke-linecap="round" stroke-linejoin="round"/>`;
      body += field
        .map((s, k) => {
          const [x, y] = starFit[k];
          if (round && Math.hypot(x - 150, y - 162) > 98) return "";
          return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.max(0.9, 4.6 - 0.75 * s.mag))}" fill="${ink}"/>`;
        })
        .join("");
      const decDeg = Math.round(lat0 / DEG);
      const coords = `RA ${hms(lon0 / DEG)} · Dec ${decDeg >= 0 ? "+" : "−"}${String(Math.abs(decDeg)).padStart(2, "0")}°`;
      body += text(150, round ? 318 : 332, c.latin.toUpperCase(), ink, 13, ` letter-spacing="3" font-weight="bold"`);
      if (c.en && c.en !== c.latin) body += text(150, round ? 336 : 350, c.en, ink, 9.5);
      body += text(150, round ? 354 : 368, coords, ink, 8);
      const bright = field.filter((s) => s.mag < 2).length;
      out.push({
        body,
        variant: round ? "sky-chart" : "sky-figure",
        source: "sky",
        subject: round ? `${c.latin} Star Chart` : `${c.latin} Constellation`,
        title: round ? `Star Chart of ${c.latin}` : c.en && c.en !== c.latin ? `${c.latin}, the ${c.en}` : c.latin,
        description: `The constellation ${c.latin}${c.en && c.en !== c.latin ? ` (${c.en})` : ""}: its real stars down to magnitude 5, sized by brightness and joined in the traditional figure${round ? ", set in a star-chart ring" : ""}.`,
        features: { nature: 0.55, geometric: 0.45, line_art: 0.55, abstract: 0.35, clean_minimal: 0.55, classic: 0.4, pictorial: 0.35, density: 0.15 + Math.min(0.2, field.length / 300), contrast: 0.7 + (bright ? 0.1 : 0), typography: 0.2 },
        sigKey: `${round ? "chart" : "figure"}-${c.id}`,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Curves                                                               */
/* ------------------------------------------------------------------ */

const RATIO_NAMES: Record<string, string> = { "1:1": "Unison", "2:1": "Octave", "3:2": "Fifth", "4:3": "Fourth", "5:4": "Major Third", "6:5": "Minor Third", "5:3": "Major Sixth", "8:5": "Minor Sixth", "9:8": "Tone", "7:4": "Harmonic Seventh", "7:5": "Septimal Tritone", "9:5": "Minor Seventh", "3:1": "Twelfth", "5:2": "Tenth" };
const TEMPOS = ["Slow", "Quiet", "Long", "Late", "Still", "Soft", "Deep", "Low", "Pale", "Faint", "Lento", "Largo"];

function curveDesigns(): Set5Design[] {
  const out: Set5Design[] = [];
  const ink = "#FFFFFF";
  const box = { x: M + 6, y: M + 20, w: W - 2 * M - 12, h: H - 2 * M - 70 };
  // Harmonographs: two damped pendulums per axis, simple ratios (the busy ones read as scribbles).
  const HARM = ["1:1", "2:1", "3:2", "4:3", "3:1", "5:2", "5:3"];
  for (let k = 0; k < 60; k++) {
    const r = HARM[k % HARM.length];
    const [a, b] = r.split(":").map(Number);
    let pts: [number, number][] = [];
    // Re-seed a trace that collapses to a line (pendulums cancelling out).
    for (let attempt = 0; ; attempt++) {
      const rng = mulberry32(0x4a3 + k * 7919 + attempt * 101);
      const det = [1, 1 + (rng() - 0.5) * 0.02, 1, 1 + (rng() - 0.5) * 0.02];
      const px = rng() * Math.PI * 2, py = rng() * Math.PI * 2;
      const p = [px, px + (rng() - 0.5) * 1.2, py, py + (rng() - 0.5) * 1.2];
      const d = [0, 0, 0, 0].map(() => 0.012 + rng() * 0.012);
      const m = Math.max(a, b);
      const N = 4000;
      pts = [];
      for (let i = 0; i < N; i++) {
        const t = ((i / N) * 150 * m) / m;
        pts.push([
          Math.sin(a * det[0] * t + p[0]) * Math.exp(-d[0] * t) + Math.sin(a * det[1] * t + p[1]) * Math.exp(-d[1] * t),
          Math.sin(b * det[2] * t + p[2]) * Math.exp(-d[2] * t) + Math.sin(b * det[3] * t + p[3]) * Math.exp(-d[3] * t),
        ]);
      }
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      if ((w / h < 2 && h / w < 2) || attempt > 20) break;
    }
    const [line] = fit([pts], box);
    const tempo = TEMPOS[Math.floor(k / HARM.length) % TEMPOS.length];
    out.push({
      body: `<path d="${polyline(line)}" fill="none" stroke="${ink}" stroke-width=".45"/>` + text(150, 362, `HARMONOGRAPH · ${r}`, ink, 9, ` letter-spacing="2"`),
      variant: "harmonograph",
      source: "curves",
      title: `${tempo} ${RATIO_NAMES[r]}`,
      description: `A harmonograph trace: two damped pendulums per axis tuned ${/^[aeiou]/i.test(RATIO_NAMES[r]) ? "an" : "a"} ${RATIO_NAMES[r].toLowerCase()} apart (${r}), drawn as the pen slowly comes to rest.`,
      features: { line_art: 0.9, abstract: 0.75, geometric: 0.55, clean_minimal: 0.45, density: 0.45, contrast: 0.55, retro: 0.35 },
      sigKey: `harm-${r}`,
    });
  }
  // Lissajous ribbons.
  const pairs: [number, number][] = [];
  for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) if (a < b && gcd(a, b) === 1) pairs.push([a, b]);
  for (let k = 0; k < 30; k++) {
    const [a, b] = pairs[k % pairs.length];
    const rng = mulberry32(0x71c + k * 104729);
    const delta = (Math.PI / 2) * (0.2 + rng() * 0.8);
    const copies = Math.min(6 + Math.floor(rng() * 10), Math.floor(9000 / Math.min(900, 100 * Math.max(a, b))));
    const lines: [number, number][][] = [];
    for (let c = 0; c < copies; c++) {
      const s = 1 - c * 0.035;
      const pts: [number, number][] = [];
      // Enough points for a smooth curve, few enough for a light file (copies × points under ~9,000).
      const steps = Math.min(900, 100 * Math.max(a, b));
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        pts.push([s * Math.sin(a * t + delta + c * 0.02), s * Math.sin(b * t)]);
      }
      lines.push(pts);
    }
    const fitted = fit(lines, { x: M + 10, y: M + 30, w: W - 2 * M - 20, h: W - 2 * M - 20 });
    out.push({
      body: `<path d="${fitted.map(polyline).join("")}" fill="none" stroke="${ink}" stroke-width=".5"/>` + text(150, 362, `LISSAJOUS · ${a}:${b}`, ink, 9, ` letter-spacing="2"`),
      variant: "lissajous",
      source: "curves",
      title: `Lissajous ${a}:${b}${k >= pairs.length ? " Ribbon" : ""}`,
      description: `A Lissajous figure — x = sin(${a}t + δ), y = sin(${b}t) — drawn ${copies} times, each a little smaller, into a ribbon.`,
      features: { line_art: 0.9, geometric: 0.7, abstract: 0.7, clean_minimal: 0.55, density: 0.4, contrast: 0.55, retro: 0.3 },
      sigKey: `liss-${a}-${b}`,
    });
  }
  // Attractors: Lorenz and Rössler, RK4.
  const VIEWS = ["Front View", "Side View", "Top View", "Turned View", "Low View"];
  for (let k = 0; k < 30; k++) {
    const lorenz = k < 20;
    const rng = mulberry32(0xa77 + k * 15485863);
    const f = lorenz
      ? (s: number[]) => [10 * (s[1] - s[0]), s[0] * (28 - s[2]) - s[1], s[0] * s[1] - (8 / 3) * s[2]]
      : (s: number[]) => [-s[1] - s[2], s[0] + 0.2 * s[1], 0.2 + s[2] * (s[0] - 5.7)];
    let s = [0.1 + rng(), 0.1 + rng(), 0.1 + rng()];
    const h = lorenz ? 0.006 : 0.02;
    const pts: number[][] = [];
    for (let i = 0; i < 9000; i++) {
      const k1 = f(s);
      const k2 = f(s.map((v, j) => v + (h / 2) * k1[j]));
      const k3 = f(s.map((v, j) => v + (h / 2) * k2[j]));
      const k4 = f(s.map((v, j) => v + h * k3[j]));
      s = s.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
      if (i > 300) pts.push(s);
    }
    // The Rössler band is flat seen side-on: show it from above and at a tilt.
    const view = lorenz ? k % VIEWS.length : [2, 3, 2, 3, 2, 3, 2, 3, 2, 3][k - 20];
    const yaw = [0, Math.PI / 2, 0, 0.7, 0.35][view] + (lorenz ? 0 : (k - 20) * 0.6);
    const pitch = [0, 0, Math.PI / 2, 0.4, -0.3][view] + (lorenz ? 0 : (k - 20) * 0.04);
    const proj = pts.map(([x, y, z]) => {
      const x1 = x * Math.cos(yaw) - y * Math.sin(yaw);
      const y1 = x * Math.sin(yaw) + y * Math.cos(yaw);
      return [x1, -(z * Math.cos(pitch) - y1 * Math.sin(pitch))] as [number, number];
    });
    const [line] = fit([proj], box);
    const name = lorenz ? "Lorenz" : "Rössler";
    out.push({
      body: `<path d="${polyline(line)}" fill="none" stroke="${ink}" stroke-width=".35"/>` + text(150, 362, `${name.toUpperCase()} ATTRACTOR`, ink, 9, ` letter-spacing="2"`),
      variant: lorenz ? "lorenz" : "rossler",
      source: "curves",
      title: lorenz ? `Lorenz Attractor, ${VIEWS[view]}${k >= VIEWS.length ? ` ${["", "II", "III", "IV"][Math.floor(k / VIEWS.length)]}` : ""}` : `Rössler Attractor ${["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][k - 20]}`,
      description: `The ${name} attractor, integrated step by step from its equations (${lorenz ? "σ 10, ρ 28, β 8/3" : "a 0.2, b 0.2, c 5.7"}) and seen from ${VIEWS[view].toLowerCase().replace(" view", "")}: one line that never crosses itself.`,
      features: { line_art: 0.85, abstract: 0.8, geometric: 0.35, density: 0.55, contrast: 0.5, retro: 0.4, dark_industrial: 0.2 },
      sigKey: lorenz ? `lorenz-${view}` : "rossler",
    });
  }
  return out;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/* ------------------------------------------------------------------ */
/* Botany                                                               */
/* ------------------------------------------------------------------ */

const PLANT_WORDS = ["Bracken", "Sedge", "Yarrow", "Sorrel", "Bramble", "Heather", "Tansy", "Rush", "Fennel", "Hawthorn", "Rowan", "Willow", "Alder", "Birch", "Juniper", "Larch", "Hazel", "Aspen", "Elder", "Thorn"];
const PLANT_KINDS = ["Study", "Sketch", "Plate", "Specimen", "Sprig"];

function botanyDesigns(): Set5Design[] {
  const out: Set5Design[] = [];
  const ink = "#FFFFFF";
  // Phyllotaxis seed heads (Vogel's model).
  const ANGLES: [number, string][] = [[137.508, "Golden Angle"], [137.3, "Open Spiral"], [137.7, "Tight Spiral"], [99.5, "Fanned"], [222.5, "Mirrored"], [151.1, "Wide Arms"]];
  for (let k = 0; k < 30; k++) {
    const rng = mulberry32(0x5eed + k * 31337);
    const [angle, name] = ANGLES[k % ANGLES.length];
    const n = 500 + Math.floor(rng() * 700);
    const grow = rng() < 0.5;
    const R = 120;
    let body = "";
    for (let i = 1; i <= n; i++) {
      const r = R * Math.sqrt(i / n);
      const th = i * angle * DEG;
      const size = grow ? 0.6 + 2.6 * Math.sqrt(i / n) : 3.2 - 2.4 * Math.sqrt(i / n);
      body += `<circle cx="${f1(150 + r * Math.cos(th))}" cy="${f1(180 + r * Math.sin(th))}" r="${f1(Math.max(0.5, size))}" fill="${ink}"/>`;
    }
    const round = Math.floor(k / ANGLES.length);
    out.push({
      body: body + text(150, 356, `PHYLLOTAXIS · ${angle}°`, ink, 9, ` letter-spacing="2"`),
      variant: "phyllotaxis",
      source: "botany",
      title: `Seed Head, ${name}${round ? ` ${["", "II", "III", "IV", "V"][round]}` : ""}`,
      description: `A seed head drawn with Vogel's model of phyllotaxis: each seed turned ${angle}° from the last, set out from the centre as the plant grows.`,
      features: { nature: 0.7, geometric: 0.6, abstract: 0.45, density: 0.55, contrast: 0.6, clean_minimal: 0.3, pictorial: 0.3 },
      sigKey: `phyllo-${angle}-${grow ? "g" : "s"}`,
    });
  }
  // L-system plants.
  const SYSTEMS = [
    { axiom: "X", rules: { X: "F+[[X]-X]-F[-FX]+X", F: "FF" } as Record<string, string>, angle: 25, iter: 5, kind: "fern" },
    { axiom: "F", rules: { F: "FF-[-F+F+F]+[+F-F-F]" }, angle: 22.5, iter: 4, kind: "bush" },
    { axiom: "X", rules: { X: "F[+X]F[-X]+X", F: "FF" }, angle: 20, iter: 6, kind: "sprig" },
    { axiom: "X", rules: { X: "F[+X][-X]FX", F: "FF" }, angle: 25.7, iter: 6, kind: "weed" },
    { axiom: "F", rules: { F: "F[+F]F[-F][F]" }, angle: 20, iter: 5, kind: "stem" },
  ];
  for (let k = 0; k < 70; k++) {
    const sys = SYSTEMS[k % SYSTEMS.length];
    const rng = mulberry32(0xb07 + k * 2654435761);
    const angle = sys.angle * (0.85 + rng() * 0.3);
    const lean = (rng() - 0.5) * 14;
    let str = sys.axiom;
    for (let i = 0; i < sys.iter; i++) str = [...str].map((ch) => sys.rules[ch] ?? ch).join("");
    const lines: [number, number][][] = [];
    const stack: [number, number, number][] = [];
    let [x, y, a] = [0, 0, -90 + lean];
    for (const ch of str) {
      if (ch === "F") {
        const nx = x + Math.cos(a * DEG) * (0.9 + rng() * 0.2);
        const ny = y + Math.sin(a * DEG) * (0.9 + rng() * 0.2);
        lines.push([[x, y], [nx, ny]]);
        [x, y] = [nx, ny];
      } else if (ch === "+") a += angle * (0.9 + rng() * 0.2);
      else if (ch === "-") a -= angle * (0.9 + rng() * 0.2);
      else if (ch === "[") stack.push([x, y, a]);
      else if (ch === "]") [x, y, a] = stack.pop()!;
    }
    // Merge consecutive segments into polylines.
    const merged: [number, number][][] = [];
    for (const seg of lines) {
      const last = merged[merged.length - 1];
      if (last && Math.hypot(last[last.length - 1][0] - seg[0][0], last[last.length - 1][1] - seg[0][1]) < 1e-9) last.push(seg[1]);
      else merged.push([...seg]);
    }
    const fitted = fit(merged, { x: M + 6, y: M + 10, w: W - 2 * M - 12, h: H - 2 * M - 56 });
    const word = PLANT_WORDS[k % PLANT_WORDS.length];
    const kind = PLANT_KINDS[Math.floor(k / PLANT_WORDS.length) % PLANT_KINDS.length];
    out.push({
      body: `<path d="${fitted.map(polyline).join("")}" fill="none" stroke="${ink}" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round"/>`,
      variant: `lsystem-${sys.kind}`,
      source: "botany",
      title: `${word} ${kind}`,
      description: `A plant grown by an L-system — a few rewriting rules applied ${sys.iter} times, branching at about ${Math.round(angle)}° — drawn like an engraved plate.`,
      features: { nature: 0.85, line_art: 0.8, pictorial: 0.45, classic: 0.35, density: 0.4, contrast: 0.5, clean_minimal: 0.35 },
      sigKey: `lsys-${sys.kind}`,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Ornament                                                             */
/* ------------------------------------------------------------------ */

const FOLD_NAMES: Record<number, string> = { 5: "Five", 6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten", 12: "Twelve", 16: "Sixteen", 24: "Twenty-four" };
const METALS = ["Silver", "Engraved", "Banknote", "Watch-dial", "Engine-turned", "Lathe", "Fine", "Bright", "Scrolled", "Waved"];

function ornamentDesigns(): Set5Design[] {
  const out: Set5Design[] = [];
  const ink = "#FFFFFF";
  const C = { x: 150, y: 185 };
  // Guilloche rosettes: bands of phase-shifted epitrochoid-like curves.
  for (let k = 0; k < 40; k++) {
    const rng = mulberry32(0x9111 + k * 7777);
    const lobes = 6 + Math.floor(rng() * 14);
    const bands = 1 + Math.floor(rng() * 3);
    // Enough strands for the moiré, few enough for a light file (under 80 KB).
    const strands = Math.min(5 + Math.floor(rng() * 7), Math.floor(16 / bands));
    let d = "";
    for (let b = 0; b < bands; b++) {
      const R = 30 + (b + 0.5) * (84 / bands);
      const amp = (84 / bands) * (0.25 + rng() * 0.2);
      const lobeK = lobes * (b + 1);
      for (let s = 0; s < strands; s++) {
        const ph = (s / strands) * ((Math.PI * 2) / lobeK);
        const pts: [number, number][] = [];
        const steps = Math.max(240, lobeK * 10);
        for (let i = 0; i <= steps; i++) {
          const t = (i / steps) * Math.PI * 2;
          const r = R + amp * Math.sin(lobeK * t + ph * lobeK);
          pts.push([C.x + r * Math.cos(t), C.y + r * Math.sin(t)]);
        }
        d += polyline(pts) + "Z";
      }
    }
    const metal = METALS[k % METALS.length];
    out.push({
      body: `<path d="${d}" fill="none" stroke="${ink}" stroke-width=".55"/>`,
      variant: "guilloche",
      source: "ornament",
      title: `${metal} Guilloche${k >= METALS.length ? ` ${["", "II", "III", "IV"][Math.floor(k / METALS.length)]}` : ""}`,
      description: `A guilloche rosette: ${bands} bands of fine, phase-shifted waves around a centre, the lathe-turned pattern of banknotes and watch dials.`,
      features: { geometric: 0.8, line_art: 0.75, abstract: 0.6, classic: 0.5, density: 0.6, contrast: 0.45, clean_minimal: 0.2 },
      sigKey: `guill-${bands}-${lobes > 14 ? "hi" : "lo"}`,
    });
  }
  // n-fold star rosettes: star polygons {n/k} in rings, with an interlace circle.
  const FOLDS = [5, 6, 7, 8, 9, 10, 12, 16, 24];
  for (let k = 0; k < 30; k++) {
    const n = FOLDS[k % FOLDS.length];
    const rng = mulberry32(0x3a3 + k * 97);
    const rings = 3 + Math.floor(rng() * 4);
    let body = "";
    for (let r = 0; r < rings; r++) {
      const R = 118 - r * (100 / rings);
      const step = Math.max(2, Math.floor((n - 1) / 2) - (r % 2));
      // {n/step} as a compound: gcd(n, step) separate stars.
      const g = gcd(n, step);
      let d = "";
      for (let c = 0; c < g; c++) {
        const pts: [number, number][] = [];
        for (let i = 0; i <= n / g; i++) {
          const a = ((c + i * step) / n) * Math.PI * 2 + (r % 2 ? Math.PI / n : 0) - Math.PI / 2;
          pts.push([C.x + R * Math.cos(a), C.y + R * Math.sin(a)]);
        }
        d += polyline(pts) + "Z";
      }
      body += `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${f1(1.4 - r * 0.15)}" stroke-linejoin="round"/>`;
      if (rng() < 0.5) body += `<circle cx="${C.x}" cy="${C.y}" r="${f1(R * 0.62)}" fill="none" stroke="${ink}" stroke-width=".6"/>`;
    }
    body += `<circle cx="${C.x}" cy="${C.y}" r="4" fill="${ink}"/>`;
    const round = Math.floor(k / FOLDS.length);
    out.push({
      body,
      variant: "rosette",
      source: "ornament",
      title: `${FOLD_NAMES[n]}-fold Rosette${round ? ` ${["", "II", "III", "IV"][round]}` : ""}`,
      description: `A ${n}-fold star rosette in the geometric tradition: star polygons nested ring inside ring, each turned half a point from the last.`,
      features: { geometric: 0.9, abstract: 0.5, classic: 0.55, line_art: 0.6, clean_minimal: 0.45, contrast: 0.6, density: 0.35 },
      sigKey: `rosette-${n}`,
    });
  }
  // Khatam tiles: eight-pointed stars and crosses on a square grid.
  for (let k = 0; k < 30; k++) {
    const rng = mulberry32(0x7117 + k * 131);
    const cell = 34 + Math.floor(rng() * 30);
    const width = 0.8 + rng() * 1.8;
    const x0 = M, y0 = M, x1 = W - M, y1 = H - M - 20;
    let d = "";
    for (let gy = y0 - cell; gy < y1 + cell; gy += cell)
      for (let gx = x0 - cell; gx < x1 + cell; gx += cell) {
        const cx = gx + cell / 2, cy = gy + cell / 2, r = cell * 0.46;
        // Eight-pointed star: two squares, one turned 45°.
        for (const turn of [0, Math.PI / 4]) {
          const sq: [number, number][] = [];
          for (let i = 0; i <= 4; i++) sq.push([cx + r * Math.cos(turn + (i * Math.PI) / 2 + Math.PI / 4), cy + r * Math.sin(turn + (i * Math.PI) / 2 + Math.PI / 4)]);
          d += polyline(sq);
        }
      }
    out.push({
      body: `<defs><clipPath id="k"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/></clipPath></defs><path clip-path="url(#k)" d="${d}" fill="none" stroke="${ink}" stroke-width="${f1(width)}"/><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="${ink}" stroke-width="1.2"/>`,
      variant: "khatam",
      source: "ornament",
      title: `Khatam Tile, ${["Fine", "Open", "Bold", "Close", "Wide", "Light"][k % 6]}${k >= 6 ? ` ${["", "II", "III", "IV", "V"][Math.floor(k / 6)]}` : ""}`,
      description: `A khatam pattern: eight-pointed stars made of two turned squares, repeated edge to edge, as in inlaid wood and tilework.`,
      features: { geometric: 0.95, abstract: 0.55, classic: 0.45, density: 0.5 + width / 10, contrast: 0.6, clean_minimal: 0.3, architectural: 0.2 },
      sigKey: `khatam-${cell > 48 ? "big" : "small"}`,
    });
  }
  return out;
}

/** The whole set, in its fixed order (ids follow this order). */
export function set5Designs(): Set5Design[] {
  return [...skyDesigns(), ...curveDesigns(), ...botanyDesigns(), ...ornamentDesigns()];
}

void (null as unknown as Rng);
