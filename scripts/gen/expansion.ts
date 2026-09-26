/**
 * The second 1,000 designs (catalog ids 1001–2000): five new categories,
 * four algorithms each. Pictures are drawn as single-ink illustrations
 * (halftone dots / hatching for tone), captions come from ./copy.
 */
import type { SourceCategory } from "../../types/shirt";
import {
  IH, IW, H, X0, Y0,
  an, clamp01, int, n1, pick, range, scale, smooth,
  type Design, type Generator, type Rng,
} from "./core";
import {
  ICONS, MONO, OBJECTS, SANS, SERIF, SPRITES,
  bitmapRects, drawPrims, esc, fitLines, measure, pixelText, sizeToFit, textEl, toneDefs,
} from "./art";
import { CX, clip } from "./svg";
import {
  ATTRIBUTIONS, BADGE_BOTTOMS, CLUBS, GAME_SCREENS, LABEL_LINES, MOTTOS, OBJECT_CALLOUTS, OBJECT_CAPTIONS,
  POSTER_LINES, QUOTES, RECEIPT_FOOTERS, RECEIPT_ITEMS, RECEIPT_STORES, RECEIPT_TOTALS, SPRITE_CAPTIONS,
  STAMP_COUNTRIES, TERMINAL_SCRIPTS, TICKET_LINES, WARNING_FOOTERS, WARNING_HEADERS, WARNING_LINES,
} from "./copy";


/** How an object is named in descriptions: [singular, plural]. */
const OBJECT_NOUNS: Record<string, [string, string]> = {
  coffee: ["coffee cup", "coffee cups"],
  cassette: ["cassette tape", "cassette tapes"],
  camera: ["camera", "cameras"],
  bulb: ["light bulb", "light bulbs"],
  plane: ["paper plane", "paper planes"],
  cactus: ["potted cactus", "potted cacti"],
  headphones: ["pair of headphones", "pairs of headphones"],
  key: ["key", "keys"],
  eye: ["eye", "eyes"],
  hourglass: ["hourglass", "hourglasses"],
  umbrella: ["umbrella", "umbrellas"],
  envelope: ["envelope", "envelopes"],
  glasses: ["pair of glasses", "pairs of glasses"],
};

/** Random-walk ridge across the print, returned as a closed silhouette down to `bottom`. */
function ridge(rng: Rng, base: number, amp: number, step: number, bottom: number, jag: number) {
  const p: [number, number][] = [];
  let y = base + range(rng, -amp, amp) * 0.5;
  for (let x = X0 - 10; x <= X0 + IW + 10; x += step) {
    y += range(rng, -amp, amp) * jag;
    y = Math.max(base - amp, Math.min(base + amp * 0.6, y));
    p.push([x, y]);
  }
  return `${smooth(p)} L${X0 + IW + 10},${bottom} L${X0 - 10},${bottom}Z`;
}

function stars(rng: Rng, n: number, ink: string, yMax: number) {
  let s = "";
  for (let i = 0; i < n; i++) {
    const x = range(rng, X0 + 6, X0 + IW - 6);
    const y = range(rng, Y0 + 6, yMax);
    const r = rng() < 0.12 ? 1.8 : range(rng, 0.5, 1.1);
    s += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}"/>`;
  }
  return `<g fill="${ink}">${s}</g>`;
}

const birds = (rng: Rng, n: number, ink: string, yMin: number, yMax: number) =>
  Array.from({ length: n }, () => {
    const x = range(rng, X0 + 30, X0 + IW - 30);
    const y = range(rng, yMin, yMax);
    const w = range(rng, 6, 12);
    return `<path d="M${n1(x - w)} ${n1(y)} Q${n1(x - w / 2)} ${n1(y - w * 0.6)} ${n1(x)} ${n1(y)} Q${n1(x + w / 2)} ${n1(y - w * 0.6)} ${n1(x + w)} ${n1(y)}" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`;
  }).join("");

/* ================================================================== */
/* f) Scenes — landscapes and skies                                    */
/* ================================================================== */

const mountains: Generator = (rng, ink, ground) => {
  const layers = int(rng, 3, 5);
  const jag = range(rng, 0.35, 0.9);
  const celestial = pick(rng, ["sun", "moon", "none"] as const);
  const sunX = range(rng, X0 + 60, X0 + IW - 60);
  const sunY = range(rng, Y0 + 60, Y0 + 130);
  const sunR = range(rng, 22, 42);
  const tones = ["t1", "t2", "t3", "t4"];
  let body = toneDefs(ink);
  let scene = "";
  if (celestial === "sun") scene += `<circle cx="${n1(sunX)}" cy="${n1(sunY)}" r="${n1(sunR)}" fill="${ink}"/>`;
  if (celestial === "moon")
    scene += `<circle cx="${n1(sunX)}" cy="${n1(sunY)}" r="${n1(sunR)}" fill="${ink}"/><circle cx="${n1(sunX + sunR * 0.45)}" cy="${n1(sunY - sunR * 0.2)}" r="${n1(sunR * 0.9)}" fill="${ground}"/>`;
  for (let k = 0; k < layers; k++) {
    const base = Y0 + 150 + k * (170 / layers);
    const fill = k === layers - 1 ? ink : `url(#${tones[Math.min(tones.length - 1, k + (4 - layers))]})`;
    scene += `<path d="${ridge(rng, base, 40 - k * 4, 16 - k, Y0 + IH + 5, jag)}" fill="${fill}" stroke="${ground}" stroke-width="2"/>`;
  }
  scene += birds(rng, int(rng, 0, 3), ink, Y0 + 40, Y0 + 120);
  body += clip("c", scene) + `<rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}" fill="none" stroke="${ink}" stroke-width="2"/>`;
  const density = clamp01(0.4 + layers * 0.07);
  return {
    body,
    variant: "mountains",
    sig: { key: `mountains-${celestial}`, vec: [(layers - 3) / 2, (jag - 0.35) / 0.55] },
    description: `${layers >= 4 ? "Layered" : "Quiet"} mountain ranges in halftone${celestial === "none" ? "" : ` under ${an(celestial)}`}, screen-print style.`,
    complexity: density,
    features: {
      pictorial: range(rng, 0.88, 1), nature: range(rng, 0.88, 1), abstract: range(rng, 0.2, 0.32),
      geometric: 0.1 + jag * 0.15, halftone_raster: range(rng, 0.5, 0.7), density, contrast: range(rng, 0.62, 0.82),
      clean_minimal: 0.65 - layers * 0.08, dark_industrial: range(rng, 0.2, 0.38), line_art: range(rng, 0.08, 0.22),
      architectural: 0.05, retro: range(rng, 0.22, 0.4),
    },
  };
};

const celestialBody: Generator = (rng, ink, ground) => {
  const kind = pick(rng, ["moon", "planet", "eclipse"] as const);
  const R = range(rng, 62, 100);
  const cx = CX + range(rng, -20, 20);
  const cy = H / 2 + range(rng, -30, 10);
  const nStars = int(rng, 18, 70);
  let scene = stars(rng, nStars, ink, Y0 + IH - 6);
  let detail = 0;
  if (kind === "moon") {
    const craters = int(rng, 5, 12);
    detail = craters;
    let c = "";
    for (let i = 0; i < craters; i++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * R * 0.75;
      c += `<circle cx="${n1(cx + Math.cos(a) * d)}" cy="${n1(cy + Math.sin(a) * d)}" r="${n1(range(rng, 4, R * 0.18))}" fill="url(#t5)" stroke="${ground}" stroke-width="1.5"/>`;
    }
    const phase = range(rng, 0.2, 0.9);
    scene +=
      `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(R)}" fill="url(#t2)" stroke="${ink}" stroke-width="2"/>${c}` +
      // terminator: a ground-coloured disc eats one side for the phase
      `<clipPath id="m"><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(R + 1)}"/></clipPath><circle clip-path="url(#m)" cx="${n1(cx + R * (2 - phase * 1.6))}" cy="${n1(cy)}" r="${n1(R * 1.05)}" fill="${ground}"/>`;
  } else if (kind === "planet") {
    const bands = int(rng, 3, 7);
    detail = bands;
    const tilt = range(rng, -24, 24);
    let b = "";
    for (let i = 0; i < bands; i++) {
      const y = cy - R + ((i + 0.5) / bands) * 2 * R;
      b += `<rect x="${n1(cx - R)}" y="${n1(y - R / bands / 2)}" width="${n1(2 * R)}" height="${n1(R / bands)}" fill="url(#${["t1", "t3", "t2", "t4"][i % 4]})"/>`;
    }
    const ring = `M${n1(cx - R * 1.7)} ${n1(cy)} A${n1(R * 1.7)} ${n1(R * 0.42)} 0 0 0 ${n1(cx + R * 1.7)} ${n1(cy)}`;
    scene +=
      `<g transform="rotate(${n1(tilt)} ${n1(cx)} ${n1(cy)})">` +
      `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(R * 1.7)}" ry="${n1(R * 0.42)}" fill="none" stroke="${ink}" stroke-width="5"/>` +
      `<clipPath id="p"><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(R)}"/></clipPath><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(R)}" fill="${ground}"/><g clip-path="url(#p)">${b}</g>` +
      `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(R)}" fill="none" stroke="${ink}" stroke-width="2"/>` +
      `<path d="${ring}" fill="none" stroke="${ink}" stroke-width="5"/></g>`;
  } else {
    detail = 8;
    let rays = "";
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r1 = R * 1.08;
      const r2 = R * (1.25 + (i % 3) * 0.12);
      rays += `M${n1(cx + Math.cos(a) * r1)} ${n1(cy + Math.sin(a) * r1)} L${n1(cx + Math.cos(a) * r2)} ${n1(cy + Math.sin(a) * r2)} `;
    }
    scene += `<path d="${rays}" stroke="${ink}" stroke-width="2"/><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(R * 1.04)}" fill="${ink}"/><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(R)}" fill="${ground}"/>`;
  }
  const density = clamp01(0.25 + nStars / 200 + detail / 40);
  return {
    body: toneDefs(ink) + clip("c", scene),
    variant: "celestial",
    sig: { key: `celestial-${kind}`, vec: [(R - 62) / 38, (nStars - 18) / 52] },
    description: kind === "moon" ? "A cratered moon mid-phase in a field of stars." : kind === "planet" ? "A ringed, banded planet drifting through space." : "A total eclipse with a flaring corona.",
    complexity: density,
    features: {
      pictorial: range(rng, 0.85, 0.96), nature: range(rng, 0.6, 0.8), abstract: range(rng, 0.3, 0.5), geometric: range(rng, 0.3, 0.48),
      halftone_raster: kind === "eclipse" ? 0.15 : range(rng, 0.42, 0.6), density, contrast: range(rng, 0.72, 0.9),
      clean_minimal: 0.8 - density * 0.5, dark_industrial: range(rng, 0.3, 0.5), retro: range(rng, 0.25, 0.4), line_art: kind === "eclipse" ? 0.5 : 0.15,
    },
  };
};

const seascape: Generator = (rng, ink, ground) => {
  const horizon = range(rng, Y0 + 150, Y0 + 230);
  const sunR = range(rng, 28, 56);
  const sunY = horizon - range(rng, -sunR * 0.4, 70);
  const stripes = int(rng, 6, 14);
  const boat = rng() < 0.4;
  const nBirds = int(rng, 0, 4);
  let scene = "";
  // sun with retro cut lines, clipped at the horizon
  let cuts = "";
  for (let i = 0; i < 5; i++) cuts += `<rect x="${n1(CX - sunR - 2)}" y="${n1(sunY + sunR * (0.1 + i * 0.18))}" width="${n1(sunR * 2 + 4)}" height="${n1(1.5 + i * 1.3)}" fill="${ground}"/>`;
  scene += `<clipPath id="s"><rect x="${X0}" y="${Y0}" width="${IW}" height="${n1(horizon - Y0)}"/></clipPath><g clip-path="url(#s)"><circle cx="${CX}" cy="${n1(sunY)}" r="${n1(sunR)}" fill="${ink}"/>${cuts}</g>`;
  scene += `<line x1="${X0}" y1="${n1(horizon)}" x2="${X0 + IW}" y2="${n1(horizon)}" stroke="${ink}" stroke-width="2"/>`;
  // reflection: bars narrowing with distance below the horizon
  for (let i = 0; i < stripes; i++) {
    const y = horizon + 8 + i * ((Y0 + IH - horizon - 12) / stripes);
    const w = sunR * 2 * (1 - i / (stripes + 2)) * range(rng, 0.7, 1);
    scene += `<rect x="${n1(CX - w / 2)}" y="${n1(y)}" width="${n1(w)}" height="${n1(2 + i * 0.25)}" fill="${ink}"/>`;
  }
  // small wave strokes
  let waves = "";
  for (let i = 0; i < 14; i++) {
    const x = range(rng, X0 + 10, X0 + IW - 30);
    const y = range(rng, horizon + 10, Y0 + IH - 8);
    waves += `M${n1(x)} ${n1(y)} q6 -4 12 0 t12 0 `;
  }
  scene += `<path d="${waves}" fill="none" stroke="${ink}" stroke-width="1.3"/>`;
  if (boat) {
    const bx = range(rng, X0 + 40, X0 + IW - 60);
    scene += `<path d="M${n1(bx)} ${n1(horizon - 2)} l30 0 l-5 6 l-20 0 z M${n1(bx + 14)} ${n1(horizon - 3)} l0 -34 l14 30 z" fill="${ink}"/>`;
  }
  scene += birds(rng, nBirds, ink, Y0 + 30, horizon - 60);
  const density = clamp01(0.3 + stripes / 40 + (boat ? 0.05 : 0));
  return {
    body: clip("c", scene) + `<rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}" fill="none" stroke="${ink}" stroke-width="2"/>`,
    variant: "seascape",
    sig: { key: `seascape-${boat ? "boat" : "open"}`, vec: [(horizon - Y0 - 150) / 80, (sunR - 28) / 28] },
    description: `A striped sun setting over the sea${boat ? ", one small sail on the horizon" : ""}.`,
    complexity: density,
    features: {
      pictorial: range(rng, 0.86, 1), nature: range(rng, 0.8, 0.95), line_art: range(rng, 0.3, 0.48), clean_minimal: range(rng, 0.5, 0.72),
      geometric: range(rng, 0.2, 0.35), halftone_raster: range(rng, 0.18, 0.35), contrast: range(rng, 0.76, 0.9), density,
      retro: range(rng, 0.45, 0.7), abstract: range(rng, 0.15, 0.25), dark_industrial: range(rng, 0.12, 0.28),
    },
  };
};

const landscape: Generator = (rng, ink, ground) => {
  const kind = pick(rng, ["forest", "dunes"] as const);
  const moon = rng() < 0.55;
  let scene = toneDefs(ink);
  let detail = 0;
  if (moon) scene += `<circle cx="${n1(range(rng, X0 + 50, X0 + IW - 50))}" cy="${n1(range(rng, Y0 + 45, Y0 + 100))}" r="${n1(range(rng, 16, 30))}" fill="${ink}"/>`;
  if (kind === "forest") {
    const rows = int(rng, 2, 4);
    detail = rows;
    for (let r = 0; r < rows; r++) {
      const baseY = Y0 + 190 + r * (130 / rows);
      const fill = r === rows - 1 ? ink : `url(#${["t2", "t3", "t4"][Math.min(2, r)]})`;
      let trees = "";
      let x = X0 - 10 + range(rng, 0, 12);
      while (x < X0 + IW + 10) {
        const h = range(rng, 50, 110) * (0.7 + r * 0.18);
        const w = h * range(rng, 0.32, 0.42);
        trees += `M${n1(x)} ${n1(baseY - h)} L${n1(x + w / 2)} ${n1(baseY)} L${n1(x - w / 2)} ${n1(baseY)} Z `;
        x += w * range(rng, 0.55, 0.85);
      }
      scene += `<path d="${trees}" fill="${fill}" stroke="${ground}" stroke-width="1.2"/><rect x="${X0}" y="${n1(baseY)}" width="${IW}" height="${IH}" fill="${fill}"/>`;
      if (r < rows - 1) scene += `<rect x="${X0}" y="${n1(baseY - 14)}" width="${IW}" height="8" fill="${ground}"/>`;
    }
  } else {
    const layers = int(rng, 3, 5);
    detail = layers;
    for (let k = 0; k < layers; k++) {
      const base = Y0 + 170 + k * (150 / layers);
      const amp = range(rng, 12, 30);
      const freq = range(rng, 0.012, 0.03);
      const ph = rng() * 6;
      const p: [number, number][] = [];
      for (let x = X0 - 10; x <= X0 + IW + 10; x += 10) p.push([x, base - Math.sin(x * freq + ph) * amp]);
      const fill = k === layers - 1 ? ink : `url(#${["t1", "t2", "t3", "t4"][Math.min(3, k)]})`;
      scene += `<path d="${smooth(p)} L${X0 + IW + 10},${Y0 + IH + 5} L${X0 - 10},${Y0 + IH + 5}Z" fill="${fill}" stroke="${ground}" stroke-width="2"/>`;
    }
    if (rng() < 0.6) {
      const cx = range(rng, X0 + 50, X0 + IW - 50);
      const cy = Y0 + IH - 20;
      scene += `<path d="M${n1(cx - 5)} ${cy} V${cy - 70} Q${n1(cx - 5)} ${cy - 80} ${n1(cx + 1)} ${cy - 80} Q${n1(cx + 7)} ${cy - 80} ${n1(cx + 7)} ${cy - 70} V${cy} Z M${n1(cx - 5)} ${cy - 40} H${n1(cx - 18)} V${cy - 58} M${n1(cx + 7)} ${cy - 30} H${n1(cx + 19)} V${cy - 52}" fill="${ground}" stroke="${ground}" stroke-width="5" stroke-linecap="round"/>`;
    }
  }
  const density = clamp01(0.42 + detail * 0.07);
  return {
    body: clip("c", scene) + `<rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}" fill="none" stroke="${ink}" stroke-width="2"/>`,
    variant: kind,
    sig: { key: `${kind}-${moon ? "moon" : "day"}`, vec: [detail / 5] },
    description: kind === "forest" ? `Pine forest fading back in misty rows${moon ? " under a full moon" : ""}.` : `Rolling desert dunes${moon ? " by moonlight" : ""}, printed in dot tones.`,
    complexity: density,
    features: {
      pictorial: range(rng, 0.82, 0.96), nature: range(rng, 0.9, 1), density, halftone_raster: range(rng, 0.42, 0.6), contrast: range(rng, 0.6, 0.8),
      clean_minimal: range(rng, 0.3, 0.5), retro: range(rng, 0.2, 0.32), abstract: range(rng, 0.15, 0.3), dark_industrial: range(rng, 0.25, 0.45),
      geometric: kind === "forest" ? 0.35 : 0.12,
    },
  };
};

/* ================================================================== */
/* g) Slogans — smart / funny / interesting captions                   */
/* ================================================================== */

const swissPoster: Generator = (rng, ink) => {
  const caption = pick(rng, POSTER_LINES);
  const align = pick(rng, ["left", "center"] as const);
  const outlineAlt = rng() < 0.35;
  const words = caption.split(" ");
  // stacked: one word (or short pair) per line, justified to full width
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 7) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
  }
  const boxTop = Y0 + 34;
  const boxH = IH - 80;
  const lh = Math.min(boxH / lines.length, 76);
  let body = `<text x="${X0}" y="${Y0 + 12}" font-size="9" letter-spacing="2" ${MONO} fill="${ink}">Nº ${String(int(rng, 1, 999)).padStart(3, "0")}</text>`;
  body += `<text x="${X0 + IW}" y="${Y0 + 12}" font-size="9" letter-spacing="2" text-anchor="end" ${MONO} fill="${ink}">MONO / SLOGANS</text>`;
  body += `<line x1="${X0}" y1="${Y0 + 20}" x2="${X0 + IW}" y2="${Y0 + 20}" stroke="${ink}" stroke-width="2"/>`;
  // Each line gets the largest size that fits the width (Swiss "size to
  // fit" rhythm), capped by the line height; textLength only guards overflow.
  const sizes = lines.map((l) => sizeToFit(l, IW, "sansBold", lh * 0.9));
  const total = sizes.reduce((a, b) => a + b * 1.02, 0);
  let y = boxTop + Math.max(0, (boxH - total) / 2);
  lines.forEach((l, i) => {
    const size = sizes[i];
    y += size * 1.02;
    const outline = outlineAlt && i % 2 === 1;
    const x = align === "left" ? X0 : CX;
    body += `<text x="${n1(x)}" y="${n1(y - size * 0.14)}" font-size="${n1(size)}" font-weight="900" text-anchor="${align === "left" ? "start" : "middle"}" ${SANS} ${
      outline ? `fill="none" stroke="${ink}" stroke-width="1.5"` : `fill="${ink}"`
    }${measure(l, size, "sansBold") > IW ? ` textLength="${IW}" lengthAdjust="spacingAndGlyphs"` : ""}>${esc(l)}</text>`;
  });
  body += `<line x1="${X0}" y1="${Y0 + IH - 22}" x2="${X0 + IW}" y2="${Y0 + IH - 22}" stroke="${ink}" stroke-width="1"/>`;
  body += `<text x="${X0}" y="${Y0 + IH - 6}" font-size="9" letter-spacing="1.5" ${MONO} fill="${ink}">WEAR IT LIKE YOU MEAN IT</text>`;
  const density = clamp01(0.35 + lines.length * 0.05);
  return {
    body,
    variant: "poster",
    sig: { key: `poster-${caption}`, vec: [] },
    description: `Swiss-style type poster: “${caption}”`,
    complexity: density,
    features: {
      typography: range(rng, 0.92, 1), wit: range(rng, 0.85, 1), clean_minimal: range(rng, 0.52, 0.78), density, contrast: range(rng, 0.8, 0.95),
      geometric: range(rng, 0.15, 0.3), dark_industrial: range(rng, 0.2, 0.4), retro: range(rng, 0.1, 0.28), line_art: outlineAlt ? 0.3 : 0.05,
    },
  };
};

const warningSign: Generator = (rng, ink, ground) => {
  const header = pick(rng, WARNING_HEADERS);
  const line = pick(rng, WARNING_LINES);
  const footer = pick(rng, WARNING_FOOTERS);
  const tri = rng() < 0.6;
  const x = X0 + 6;
  const y = Y0 + 30;
  const w = IW - 12;
  const h = IH - 70;
  let body = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="none" stroke="${ink}" stroke-width="5"/>`;
  body += `<rect x="${x + 9}" y="${y + 9}" width="${w - 18}" height="${h - 18}" rx="8" fill="none" stroke="${ink}" stroke-width="1.5"/>`;
  // header bar
  body += `<rect x="${x + 9}" y="${y + 9}" width="${w - 18}" height="56" rx="8" fill="${ink}"/>`;
  if (tri) {
    body += `<path d="M${x + 44} ${y + 20} L${x + 64} ${y + 56} L${x + 24} ${y + 56} Z" fill="${ground}"/><text x="${x + 44}" y="${y + 52}" font-size="24" font-weight="900" text-anchor="middle" ${SANS} fill="${ink}">!</text>`;
  }
  body += textEl(header, tri ? x + 78 : CX, y + 50, 30, { fill: ground, weight: 900, anchor: tri ? "start" : "middle", maxW: tri ? w - 96 : w - 40, spacing: 2 });
  const fit = fitLines(line, w - 50, h - 120, "sansBold", 1.12, 40);
  const blockH = fit.lines.length * fit.size * 1.12;
  const top = y + 65 + (h - 65 - 30 - blockH) / 2 + fit.size;
  fit.lines.forEach((l, i) => {
    body += textEl(l, CX, top + i * fit.size * 1.12, fit.size, { fill: ink, weight: 900, anchor: "middle", maxW: w - 50 });
  });
  body += textEl(footer, CX, y + h - 22, 10, { fill: ink, font: MONO, anchor: "middle", spacing: 1.5, maxW: w - 40 });
  body += `<text x="${CX}" y="${Y0 + IH - 6}" font-size="8" letter-spacing="2" text-anchor="middle" ${MONO} fill="${ink}">MONO SAFETY DEPT. — FORM 42-B</text>`;
  return {
    body,
    variant: "warning",
    sig: { key: `warning-${line}`, vec: [] },
    description: `Faux safety sign — ${header}: “${line}”`,
    complexity: 0.5,
    features: {
      typography: range(rng, 0.8, 0.9), wit: range(rng, 0.86, 1), geometric: range(rng, 0.4, 0.55), contrast: range(rng, 0.82, 0.95), density: range(rng, 0.45, 0.62),
      dark_industrial: range(rng, 0.5, 0.7), retro: range(rng, 0.3, 0.5), clean_minimal: range(rng, 0.3, 0.48), line_art: 0.3, architectural: 0.12,
    },
  };
};

const receipt: Generator = (rng, ink) => {
  const store = pick(rng, RECEIPT_STORES);
  const nItems = int(rng, 4, 7);
  const items = [...RECEIPT_ITEMS].sort(() => rng() - 0.5).slice(0, nItems);
  const total = pick(rng, RECEIPT_TOTALS);
  const footer = pick(rng, RECEIPT_FOOTERS);
  const x = X0 + 22;
  const w = IW - 44;
  const top = Y0 + 8;
  const bottom = Y0 + IH - 8;
  // paper with zig-zag top and bottom edges
  let edge = `M${x} ${top + 6}`;
  for (let i = 0; i <= 16; i++) edge += ` L${n1(x + (i * w) / 16)} ${i % 2 ? top : top + 6}`;
  edge += ` L${x + w} ${bottom - 6}`;
  for (let i = 16; i >= 0; i--) edge += ` L${n1(x + (i * w) / 16)} ${i % 2 ? bottom : bottom - 6}`;
  let body = `<path d="${edge} Z" fill="none" stroke="${ink}" stroke-width="2"/>`;
  const fs = 11;
  const lh = 17;
  let y = top + 34;
  const mono = (t: string, xx: number, anchor: "start" | "middle" | "end" = "start", size = fs, weight = 400) =>
    textEl(t, xx, y, size, { fill: ink, font: MONO, anchor, weight, maxW: w - 20 });
  body += mono(store, CX, "middle", 14, 700);
  y += lh;
  const d = new Date(2026, int(rng, 0, 11), int(rng, 1, 28), int(rng, 0, 23), int(rng, 0, 59));
  body += mono(`${d.toISOString().slice(0, 10)}  ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, CX, "middle", 10);
  y += lh;
  const rule = () => {
    body += `<line x1="${x + 10}" y1="${n1(y - 8)}" x2="${x + w - 10}" y2="${n1(y - 8)}" stroke="${ink}" stroke-width="1" stroke-dasharray="3 3"/>`;
    y += 6;
  };
  rule();
  for (const [name, price] of items) {
    body += textEl(name, x + 12, y, fs, { fill: ink, font: MONO, maxW: w * 0.58 });
    body += textEl(price, x + w - 12, y, fs, { fill: ink, font: MONO, anchor: "end", maxW: w * 0.34 });
    y += lh;
  }
  rule();
  body += mono(total, CX, "middle", 13, 700);
  y += lh + 6;
  // barcode
  let bx = x + 30;
  let bars = "";
  while (bx < x + w - 30) {
    const bw = pick(rng, [1, 1, 2, 3]);
    if (rng() < 0.62) bars += `<rect x="${n1(bx)}" y="${n1(y)}" width="${bw}" height="34"/>`;
    bx += bw + pick(rng, [1, 2]);
  }
  body += `<g fill="${ink}">${bars}</g>`;
  y += 52;
  body += mono(footer, CX, "middle", 10);
  return {
    body,
    variant: "receipt",
    sig: { key: `receipt-${store}`, vec: [(nItems - 4) / 3] },
    description: `A shop receipt from “${store}” — ${items.map((i) => i[0].toLowerCase()).slice(0, 3).join(", ")} and more.`,
    complexity: 0.55,
    features: {
      typography: range(rng, 0.85, 0.95), wit: range(rng, 0.8, 0.95), retro: range(rng, 0.5, 0.7), density: range(rng, 0.62, 0.85), clean_minimal: range(rng, 0.3, 0.48),
      contrast: range(rng, 0.58, 0.72), line_art: 0.2, geometric: 0.22, dark_industrial: range(rng, 0.3, 0.5), halftone_raster: 0.12,
    },
  };
};

const quotePrint: Generator = (rng, ink) => {
  const quote = pick(rng, QUOTES);
  const by = pick(rng, ATTRIBUTIONS);
  const framed = rng() < 0.5;
  let body = framed ? `<rect x="${X0 + 8}" y="${Y0 + 8}" width="${IW - 16}" height="${IH - 16}" fill="none" stroke="${ink}" stroke-width="1"/>` : "";
  body += `<text x="${X0 + 22}" y="${Y0 + 110}" font-size="130" ${SERIF} fill="${ink}">“</text>`;
  // Quote block sits under the quote mark; its measured height decides where
  // the rule and attribution go, so they always stay inside the frame.
  const fit = fitLines(quote, IW - 60, 160, "serifItalic", 1.2, 30);
  const blockTop = Y0 + 128;
  fit.lines.forEach((l, i) => {
    body += textEl(l, X0 + 30, blockTop + fit.size * (0.95 + i * 1.2), fit.size, { fill: ink, font: SERIF, italic: true, maxW: IW - 60 });
  });
  const blockBottom = blockTop + fit.lines.length * fit.size * 1.2;
  body += `<line x1="${X0 + 30}" y1="${n1(blockBottom + 10)}" x2="${X0 + 70}" y2="${n1(blockBottom + 10)}" stroke="${ink}" stroke-width="1.5"/>`;
  body += textEl(by, X0 + 30, blockBottom + 30, 12, { fill: ink, font: MONO, maxW: IW - 60 });
  return {
    body,
    variant: "quote",
    sig: { key: `quote-${quote}`, vec: [] },
    description: `Typewriter-serif quote: “${quote}” ${by}`,
    complexity: 0.3,
    features: {
      typography: range(rng, 0.9, 1), wit: range(rng, 0.62, 0.9), clean_minimal: range(rng, 0.75, 0.9), density: range(rng, 0.2, 0.36), contrast: range(rng, 0.52, 0.7),
      abstract: 0.1, retro: range(rng, 0.2, 0.4), dark_industrial: range(rng, 0.1, 0.25), line_art: framed ? 0.2 : 0.05,
    },
  };
};

/* ================================================================== */
/* h) Pixel & Retro                                                    */
/* ================================================================== */

const pixelSprite: Generator = (rng, ink) => {
  const name = pick(rng, Object.keys(SPRITES));
  const rows = SPRITES[name];
  const cols = rows[0].length;
  const led = rng() < 0.4;
  const captioned = rng() < 0.55;
  const caption = pick(rng, SPRITE_CAPTIONS);
  const px = Math.min(190 / cols, (captioned ? 190 : 250) / rows.length);
  const w = cols * px;
  const h = rows.length * px;
  const top = Y0 + (captioned ? 50 : (IH - h) / 2);
  let body = bitmapRects(rows, CX - w / 2, top, px, ink, led ? px * 0.18 : 0);
  if (captioned) body += pixelText(caption, CX, top + h + 34, IW - 40, ink, 6).svg;
  if (rng() < 0.4) {
    // pixel border
    const b = 8;
    body += `<g fill="${ink}"><rect x="${X0}" y="${Y0}" width="${IW}" height="${b}"/><rect x="${X0}" y="${Y0 + IH - b}" width="${IW}" height="${b}"/><rect x="${X0}" y="${Y0}" width="${b}" height="${IH}"/><rect x="${X0 + IW - b}" y="${Y0}" width="${b}" height="${IH}"/></g>`;
  }
  return {
    body,
    variant: "sprite",
    sig: { key: `sprite-${name}-${captioned ? caption : "plain"}`, vec: [led ? 1 : 0] },
    description: `8-bit ${name} sprite${led ? " on an LED grid" : ""}${captioned ? ` — “${caption}”` : ""}.`,
    complexity: 0.4,
    features: {
      retro: range(rng, 0.9, 1), pictorial: range(rng, 0.55, 0.75), geometric: range(rng, 0.55, 0.7), wit: captioned ? range(rng, 0.45, 0.6) : range(rng, 0.15, 0.3),
      halftone_raster: led ? 0.45 : 0.3, density: range(rng, 0.32, 0.55), contrast: range(rng, 0.86, 0.96), clean_minimal: range(rng, 0.45, 0.65), typography: captioned ? 0.3 : 0.05,
    },
  };
};

const gameScreen: Generator = (rng, ink) => {
  const [title, sub] = pick(rng, GAME_SCREENS);
  const hearts = int(rng, 0, 3);
  let body = "";
  const score = String(int(rng, 0, 999999)).padStart(6, "0");
  body += pixelText(`SCORE ${score}`, CX, Y0 + 14, IW - 20, ink, 3).svg;
  // title may need two lines
  const words = title.split(" ");
  const titleLines = title.length > 8 && words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [title];
  let y = Y0 + 110;
  for (const l of titleLines) {
    const t = pixelText(l, CX, y, IW - 16, ink, 9);
    body += t.svg;
    y += t.height + 14;
  }
  const subText = pixelText(sub, CX, y + 20, IW - 40, ink, 4);
  body += subText.svg;
  const heartsY = y + 20 + subText.height + 34;
  const px = 3;
  const rows = SPRITES.heart;
  if (hearts > 0 && heartsY + rows.length * px < Y0 + IH - 16) {
    const hw = rows[0].length * px;
    for (let i = 0; i < 3; i++) {
      const hx = CX - (3 * hw + 2 * 10) / 2 + i * (hw + 10);
      body += i < hearts ? bitmapRects(rows, hx, heartsY, px, ink) : `<rect x="${n1(hx)}" y="${n1(heartsY)}" width="${hw}" height="${rows.length * px}" fill="none" stroke="${ink}" stroke-width="2"/>`;
    }
  }
  body += `<rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}" fill="none" stroke="${ink}" stroke-width="4"/>`;
  return {
    body,
    variant: "gamescreen",
    sig: { key: `game-${title}`, vec: [hearts / 3] },
    description: `Arcade screen in a hand-built pixel font: “${title} — ${sub}”.`,
    complexity: 0.45,
    features: {
      retro: range(rng, 0.94, 1), typography: range(rng, 0.62, 0.8), wit: range(rng, 0.62, 0.85), geometric: 0.4, pictorial: 0.2,
      density: range(rng, 0.35, 0.55), contrast: range(rng, 0.86, 0.95), clean_minimal: range(rng, 0.4, 0.6), dark_industrial: range(rng, 0.3, 0.5),
    },
  };
};

const pixelLandscape: Generator = (rng, ink, ground) => {
  const px = pick(rng, [6, 8, 10]);
  const cols = Math.floor(IW / px);
  const rowsN = Math.floor(IH / px);
  const horizon = Math.floor(rowsN * range(rng, 0.52, 0.66));
  const sunR = int(rng, 5, 9);
  const sunC = Math.floor(cols / 2 + range(rng, -4, 4));
  const sunRow = horizon - int(rng, 2, sunR + 2);
  const mtn = rng() < 0.6;
  const grid: string[] = [];
  const heights = Array.from({ length: cols }, (_, c) => Math.floor(horizon - 2 - Math.abs(Math.sin(c * 0.33 + 1.3)) * 7 - Math.abs(Math.sin(c * 0.13)) * 5));
  for (let r = 0; r < rowsN; r++) {
    let row = "";
    for (let c = 0; c < cols; c++) {
      let on = false;
      const dr = r - sunRow;
      const dc = c - sunC;
      if (r < horizon && dr * dr + dc * dc <= sunR * sunR) on = !(dr > 0 && dr % 2 === 1); // sun with scan gaps
      if (mtn && r >= heights[c] && r < horizon) on = (r + c) % 2 === 0 || r > heights[c] + 3; // dithered slopes
      if (r >= horizon) {
        const depth = r - horizon;
        on = depth % Math.max(1, 4 - Math.floor(depth / 6)) === 0; // sea lines, denser towards viewer
        if (Math.abs(c - sunC) < sunR - depth / 3 && depth % 2 === 0) on = true; // reflection
      }
      row += on ? "X" : ".";
    }
    grid.push(row);
  }
  void ground;
  const body = bitmapRects(grid, X0 + (IW - cols * px) / 2, Y0 + (IH - rowsN * px) / 2, px, ink);
  return {
    body,
    variant: "pixelscape",
    sig: { key: `pixelscape-${mtn ? "mtn" : "sea"}`, vec: [(px - 6) / 4, (horizon / rowsN - 0.52) / 0.14] },
    description: `Pixel-art sunset${mtn ? " behind dithered mountains" : " over a scanline sea"}, in ${scale(px, 6, 12, ["fine", "chunky"])} blocks.`,
    complexity: 0.55,
    features: {
      retro: range(rng, 0.9, 1), pictorial: range(rng, 0.7, 0.85), nature: range(rng, 0.5, 0.7), geometric: range(rng, 0.45, 0.6), halftone_raster: range(rng, 0.3, 0.45),
      density: range(rng, 0.45, 0.65), contrast: range(rng, 0.84, 0.94), clean_minimal: range(rng, 0.35, 0.55), abstract: 0.2,
    },
  };
};

const terminal: Generator = (rng, ink, ground) => {
  const kind = pick(rng, ["terminal", "ascii"] as const);
  let body = "";
  let script = 0;
  if (kind === "terminal") {
    script = int(rng, 0, TERMINAL_SCRIPTS.length - 1);
    const lines = TERMINAL_SCRIPTS[script];
    const x = X0 + 2;
    const w = IW - 4;
    const fs = Math.min(...lines.map((l) => sizeToFit(l, w - 30, "mono", 17)));
    const lhT = fs * 1.75;
    const h = 60 + lines.length * lhT;
    const y = Y0 + (IH - h) / 2;
    body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="none" stroke="${ink}" stroke-width="3"/><rect x="${x}" y="${y}" width="${w}" height="24" rx="8" fill="${ink}"/><rect x="${x}" y="${y + 14}" width="${w}" height="10" fill="${ink}"/>`;
    for (let i = 0; i < 3; i++) body += `<circle cx="${x + 16 + i * 14}" cy="${y + 12}" r="4" fill="${ground}"/>`;
    body += textEl("~/mono — zsh", x + w - 10, y + 16, 9, { fill: ground, font: MONO, anchor: "end" });
    lines.forEach((l, i) => {
      body += textEl(l, x + 14, y + 50 + i * lhT, fs, { fill: ink, font: MONO, weight: l.startsWith("$") || l.startsWith(">") ? 700 : 400, maxW: w - 28 });
    });
    body += `<rect x="${x + 14}" y="${n1(y + 40 + lines.length * lhT)}" width="${n1(fs * 0.6)}" height="${n1(fs * 1.1)}" fill="${ink}"/>`;
  } else {
    // ASCII-shaded sphere, one monospace <text> per row, width fixed via textLength
    const ramp = " .:-=+*#%@";
    const cols = 26;
    const rows = 22;
    const lx = range(rng, -0.8, 0.8);
    const ly = range(rng, -0.8, -0.2);
    const lz = Math.sqrt(Math.max(0, 1 - lx * lx - ly * ly));
    const cw = (IW - 30) / cols;
    const lh = (IH - 90) / rows;
    for (let r = 0; r < rows; r++) {
      let row = "";
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) / cols * 2 - 1;
        const y = (r + 0.5) / rows * 2 - 1;
        const d = x * x + y * y;
        if (d > 1) row += " ";
        else {
          const z = Math.sqrt(1 - d);
          const lum = Math.max(0, x * lx + y * ly + z * lz);
          row += ramp[Math.min(ramp.length - 1, Math.floor(lum * (ramp.length - 1) + 0.5))];
        }
      }
      body += `<text x="${X0 + 15}" y="${n1(Y0 + 40 + (r + 1) * lh)}" font-size="${n1(lh * 1.05)}" ${MONO} fill="${ink}" xml:space="preserve" textLength="${n1(cw * cols)}" lengthAdjust="spacingAndGlyphs">${esc(row)}</text>`;
    }
    body += textEl("render.ascii --light=left", CX, Y0 + IH - 16, 10, { fill: ink, font: MONO, anchor: "middle" });
  }
  return {
    body,
    variant: kind,
    sig: { key: kind === "terminal" ? `terminal-${script}` : "ascii", vec: [] },
    description: kind === "terminal" ? `A terminal session: ${TERMINAL_SCRIPTS[script][0].replace(/^[$>] /, "")}…` : "A sphere shaded entirely in ASCII characters.",
    complexity: 0.55,
    features: {
      retro: range(rng, 0.75, 0.9), typography: range(rng, 0.5, 0.72), wit: kind === "terminal" ? range(rng, 0.62, 0.85) : 0.3, halftone_raster: kind === "ascii" ? range(rng, 0.55, 0.72) : 0.15,
      density: range(rng, 0.5, 0.75), geometric: 0.3, contrast: range(rng, 0.6, 0.8), dark_industrial: range(rng, 0.5, 0.7), clean_minimal: range(rng, 0.3, 0.5), pictorial: kind === "ascii" ? 0.4 : 0.15,
    },
  };
};

/* ================================================================== */
/* i) Badges & emblems                                                 */
/* ================================================================== */

const roundBadge: Generator = (rng, ink, ground) => {
  const club = pick(rng, CLUBS);
  const bottom = pick(rng, BADGE_BOTTOMS);
  const icon = pick(rng, Object.keys(ICONS));
  const R = 118;
  const cy = H / 2;
  let body = `<circle cx="${CX}" cy="${cy}" r="${R}" fill="none" stroke="${ink}" stroke-width="5"/><circle cx="${CX}" cy="${cy}" r="${R - 12}" fill="none" stroke="${ink}" stroke-width="1.5"/><circle cx="${CX}" cy="${cy}" r="${R - 46}" fill="none" stroke="${ink}" stroke-width="2"/>`;
  const rText = R - 30;
  body += `<defs><path id="top" d="M${CX - rText} ${cy} A${rText} ${rText} 0 0 1 ${CX + rText} ${cy}"/><path id="bot" d="M${CX - rText} ${cy} A${rText} ${rText} 0 0 0 ${CX + rText} ${cy}"/></defs>`;
  const arc = Math.PI * rText * 0.92;
  const topSize = sizeToFit(club, arc, "sansBold", 20, 1);
  const botSize = sizeToFit(bottom, arc * 0.72, "sansBold", 13, 3);
  body += `<text font-size="${n1(topSize)}" font-weight="900" letter-spacing="1" ${SANS} fill="${ink}"><textPath href="#top" startOffset="50%" text-anchor="middle">${esc(club)}</textPath></text>`;
  body += `<text font-size="${n1(botSize)}" font-weight="700" letter-spacing="3" ${SANS} fill="${ink}" dy="10"><textPath href="#bot" startOffset="50%" text-anchor="middle">${esc(bottom)}</textPath></text>`;
  body += `<text x="${CX - R + 20}" y="${cy + 5}" font-size="14" text-anchor="middle" ${SANS} fill="${ink}">★</text><text x="${CX + R - 20}" y="${cy + 5}" font-size="14" text-anchor="middle" ${SANS} fill="${ink}">★</text>`;
  const style = pick(rng, ["line", "solid"] as const);
  body += drawPrims(ICONS[icon], CX - 42, cy - 46, 84, style, ink, ground, 3);
  return {
    body,
    variant: "badge",
    sig: { key: `badge-${club}`, vec: [style === "solid" ? 1 : 0] },
    description: `Round club badge for the “${club}”, ${bottom.toLowerCase()}.`,
    complexity: 0.5,
    features: {
      typography: range(rng, 0.6, 0.78), geometric: range(rng, 0.62, 0.8), retro: range(rng, 0.72, 0.9), wit: range(rng, 0.5, 0.8), line_art: range(rng, 0.4, 0.6),
      contrast: range(rng, 0.7, 0.85), density: range(rng, 0.45, 0.62), clean_minimal: range(rng, 0.4, 0.6), pictorial: range(rng, 0.2, 0.38), dark_industrial: range(rng, 0.3, 0.5),
    },
  };
};

const crest: Generator = (rng, ink, ground) => {
  const motto = pick(rng, MOTTOS);
  const division = pick(rng, ["bend", "chevron", "quarter", "plain"] as const);
  const icon = pick(rng, ["star", "moon", "bolt", "sun", "mountain"] as const);
  const top = Y0 + 50;
  const shield = `M${CX - 88} ${top} H${CX + 88} V${top + 120} Q${CX + 88} ${top + 200} ${CX} ${top + 236} Q${CX - 88} ${top + 200} ${CX - 88} ${top + 120} Z`;
  let body = toneDefs(ink) + `<clipPath id="sh"><path d="${shield}"/></clipPath>`;
  let fields = "";
  if (division === "bend") fields = `<path d="M${CX - 90} ${top} L${CX + 90} ${top + 240} L${CX - 90} ${top + 240} Z" fill="url(#l2)"/>`;
  if (division === "chevron") fields = `<path d="M${CX - 90} ${top + 200} L${CX} ${top + 90} L${CX + 90} ${top + 200} V${top + 240} H${CX - 90} Z" fill="url(#t3)"/>`;
  if (division === "quarter") fields = `<rect x="${CX - 90}" y="${top}" width="90" height="118" fill="url(#t2)"/><rect x="${CX}" y="${top + 118}" width="90" height="130" fill="url(#t2)"/>`;
  body += `<g clip-path="url(#sh)">${fields}</g><path d="${shield}" fill="none" stroke="${ink}" stroke-width="5"/>`;
  body += `<circle cx="${CX}" cy="${top + 108}" r="46" fill="${ground}" stroke="${ink}" stroke-width="3"/>`;
  body += drawPrims(ICONS[icon], CX - 32, top + 76, 64, "solid", ink, ground, 3);
  // crown of three stars
  body += `<text x="${CX}" y="${top - 12}" font-size="22" text-anchor="middle" letter-spacing="8" ${SANS} fill="${ink}">★★★</text>`;
  // ribbon with motto
  const ry = top + 236;
  body += `<path d="M${X0 + 2} ${ry + 6} L${X0 + 30} ${ry - 6} L${X0 + 30} ${ry + 34} L${X0 + 2} ${ry + 44} L${X0 + 14} ${ry + 20} Z M${X0 + IW - 2} ${ry + 6} L${X0 + IW - 30} ${ry - 6} L${X0 + IW - 30} ${ry + 34} L${X0 + IW - 2} ${ry + 44} L${X0 + IW - 14} ${ry + 20} Z" fill="${ink}"/>`;
  body += `<rect x="${X0 + 26}" y="${ry - 10}" width="${IW - 52}" height="40" fill="${ground}" stroke="${ink}" stroke-width="3"/>`;
  body += textEl(motto, CX, ry + 16, 15, { fill: ink, font: SERIF, weight: 700, anchor: "middle", spacing: 2, maxW: IW - 76 });
  return {
    body,
    variant: "crest",
    sig: { key: `crest-${motto}`, vec: [] },
    description: `Heraldic crest${{ plain: "", bend: " divided per bend", chevron: " with a chevron field", quarter: ", quartered," }[division]} with ${an(icon)} and the motto “${motto}”.`,
    complexity: 0.6,
    features: {
      geometric: range(rng, 0.55, 0.7), retro: range(rng, 0.72, 0.86), typography: range(rng, 0.4, 0.55), wit: range(rng, 0.5, 0.8), pictorial: range(rng, 0.3, 0.5),
      line_art: range(rng, 0.4, 0.55), halftone_raster: division === "plain" ? 0.05 : range(rng, 0.3, 0.45), density: range(rng, 0.5, 0.7), contrast: range(rng, 0.7, 0.85),
      architectural: 0.15, dark_industrial: range(rng, 0.45, 0.65),
    },
  };
};

const stamp: Generator = (rng, ink, ground) => {
  const country = pick(rng, STAMP_COUNTRIES);
  const value = pick(rng, ["5", "10", "25", "42", "50", "99", "100"]);
  const icon = pick(rng, ["mountain", "moon", "bird", "sun", "wave", "star"] as const);
  const cancelled = rng() < 0.6;
  const x = X0 + 18;
  const y = Y0 + 30;
  const w = IW - 36;
  const h = IH - 60;
  const r = 6;
  // perforated edge: ink block with ground "holes" along the border
  let holes = "";
  for (let i = r * 2; i < w - r; i += r * 2.2) holes += `<circle cx="${n1(x + i)}" cy="${y}" r="${r}"/><circle cx="${n1(x + i)}" cy="${y + h}" r="${r}"/>`;
  for (let i = r * 2; i < h - r; i += r * 2.2) holes += `<circle cx="${x}" cy="${n1(y + i)}" r="${r}"/><circle cx="${x + w}" cy="${n1(y + i)}" r="${r}"/>`;
  let body = toneDefs(ink) + `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${ink}"/><g fill="${ground}">${holes}</g>`;
  body += `<rect x="${x + 16}" y="${y + 16}" width="${w - 32}" height="${h - 32}" fill="${ground}"/>`;
  body += `<rect x="${x + 24}" y="${y + 24}" width="${w - 48}" height="${h - 110}" fill="url(#t1)" stroke="${ink}" stroke-width="2"/>`;
  body += drawPrims(ICONS[icon], CX - 60, y + 40, 120, "solid", ink, ground, 4);
  body += textEl(value, x + w - 30, y + h - 30, 44, { fill: ink, weight: 900, anchor: "end" });
  const textW = w - 56 - measure(value, 44, "sansBold") - 14;
  // Country gets its own full-width row above the value, so long names never crowd it.
  body += textEl(country, x + 26, y + h - 66, 12, { fill: ink, weight: 700, spacing: 1.5, maxW: w - 52 });
  body += textEl("AIR MAIL · PAR AVION", x + 26, y + h - 40, 9, { fill: ink, font: MONO, maxW: textW });
  if (cancelled) {
    const cx = x + w - 40;
    const cy = y + 60;
    let waves = "";
    for (let i = 0; i < 4; i++) waves += `M${n1(cx - 150)} ${n1(cy + 30 + i * 10)} q18 -8 36 0 t36 0 t36 0 t36 0 `;
    body += `<g fill="none" stroke="${ink}" stroke-width="2"><circle cx="${n1(cx)}" cy="${n1(cy)}" r="30"/><circle cx="${n1(cx)}" cy="${n1(cy)}" r="24"/><path d="${waves}"/></g>`;
    body += textEl("2026", cx, cy + 4, 11, { fill: ink, font: MONO, weight: 700, anchor: "middle" });
  }
  return {
    body,
    variant: "stamp",
    sig: { key: `stamp-${icon}-${cancelled ? "used" : "mint"}`, vec: [] },
    description: `A postage stamp from the ${country.toLowerCase()}${cancelled ? ", already postmarked" : ", mint and unused"}.`,
    complexity: 0.6,
    features: {
      retro: range(rng, 0.8, 0.95), pictorial: range(rng, 0.42, 0.6), typography: range(rng, 0.45, 0.6), geometric: range(rng, 0.45, 0.6), line_art: range(rng, 0.42, 0.6),
      wit: range(rng, 0.3, 0.5), density: range(rng, 0.5, 0.7), contrast: range(rng, 0.7, 0.85), clean_minimal: range(rng, 0.3, 0.45), halftone_raster: range(rng, 0.2, 0.35),
    },
  };
};

const ticketLabel: Generator = (rng, ink, ground) => {
  const kind = pick(rng, ["ticket", "label"] as const);
  let body = "";
  let key = "";
  if (kind === "ticket") {
    const [big, small] = pick(rng, TICKET_LINES);
    key = `${big}-${small}`;
    const x = X0 + 10;
    const y = Y0 + 60;
    const w = IW - 20;
    const h = 260;
    const notch = 16;
    body += `<path d="M${x} ${y} H${x + w} V${y + h / 2 - notch} A${notch} ${notch} 0 0 0 ${x + w} ${y + h / 2 + notch} V${y + h} H${x} V${y + h / 2 + notch} A${notch} ${notch} 0 0 0 ${x} ${y + h / 2 - notch} Z" fill="none" stroke="${ink}" stroke-width="4"/>`;
    body += `<line x1="${x + 20}" y1="${y + h / 2}" x2="${x + w - 20}" y2="${y + h / 2}" stroke="${ink}" stroke-width="2" stroke-dasharray="5 5"/>`;
    const fit = fitLines(big, w - 40, 90, "sansBold", 1.05, 46);
    fit.lines.forEach((l, i) => (body += textEl(l, x + w / 2, y + 30 + fit.size * (i + 0.9), fit.size, { fill: ink, weight: 900, anchor: "middle", maxW: w - 40 })));
    body += textEl(small, x + w / 2, y + h / 2 + 50, 18, { fill: ink, weight: 700, anchor: "middle", maxW: w - 40, spacing: 1 });
    body += textEl(`ROW ${pick(rng, ["0", "A", "Z", "∞"])} · SEAT ${int(rng, 1, 99)} · GATE ${int(rng, 1, 42)}`, x + w / 2, y + h / 2 + 84, 11, { fill: ink, font: MONO, anchor: "middle", maxW: w - 40 });
    body += textEl(`Nº ${String(int(rng, 1, 999999)).padStart(6, "0")}`, x + w / 2, y + h - 16, 10, { fill: ink, font: MONO, anchor: "middle", spacing: 2 });
  } else {
    const [a, b, c] = pick(rng, LABEL_LINES);
    key = a + b;
    const x = X0 + 20;
    const y = Y0 + 34;
    const w = IW - 40;
    const h = IH - 70;
    body += `<path d="M${x + 30} ${y} H${x + w} V${y + h} H${x} V${y + 30} Z" fill="none" stroke="${ink}" stroke-width="4"/><circle cx="${x + 26}" cy="${y + 26}" r="8" fill="none" stroke="${ink}" stroke-width="3"/>`;
    body += textEl(a, x + w / 2, y + 80, 34, { fill: ink, weight: 900, anchor: "middle", maxW: w - 30, spacing: 2 });
    body += `<line x1="${x + 16}" y1="${y + 100}" x2="${x + w - 16}" y2="${y + 100}" stroke="${ink}" stroke-width="2"/>`;
    const fit = fitLines(b, w - 40, 64, "sansBold", 1.1, 28);
    fit.lines.forEach((l, i) => (body += textEl(l, x + w / 2, y + 130 + i * fit.size * 1.1, fit.size, { fill: ink, weight: 700, anchor: "middle", maxW: w - 40 })));
    body += textEl(c, x + w / 2, y + 196, 12, { fill: ink, font: MONO, anchor: "middle", maxW: w - 40, spacing: 1.5 });
    let bx = x + 30;
    let bars = "";
    while (bx < x + w - 30) {
      const bw = pick(rng, [1, 2, 3]);
      if (rng() < 0.6) bars += `<rect x="${n1(bx)}" y="${y + h - 56}" width="${bw}" height="34"/>`;
      bx += bw + pick(rng, [1, 2]);
    }
    body += `<g fill="${ink}">${bars}</g>`;
    void ground;
  }
  return {
    body,
    variant: kind,
    sig: { key: `${kind}-${key}`, vec: [] },
    description: kind === "ticket" ? `A perforated ticket stub — “${key.replace("-", ": ")}”.` : `A product label: ${key.toLowerCase()}.`,
    complexity: 0.5,
    features: {
      typography: range(rng, 0.7, 0.86), retro: range(rng, 0.6, 0.8), wit: range(rng, 0.62, 0.86), geometric: range(rng, 0.4, 0.5), density: range(rng, 0.45, 0.6),
      contrast: range(rng, 0.7, 0.85), clean_minimal: range(rng, 0.4, 0.6), dark_industrial: range(rng, 0.3, 0.5), line_art: 0.3,
    },
  };
};

/* ================================================================== */
/* j) Illustrated objects                                              */
/* ================================================================== */

const OBJECT_NAMES = Object.keys(OBJECTS);

const objectIcon: Generator = (rng, ink, ground) => {
  const obj = pick(rng, OBJECT_NAMES);
  const caption = pick(rng, OBJECT_CAPTIONS[obj]);
  const sw = pick(rng, [3, 4, 5]);
  let body = drawPrims(OBJECTS[obj], CX - 100, Y0 + 20, 200, "line", ink, ground, sw);
  const fit = fitLines(caption, IW - 30, 80, "sansBold", 1.08, 34);
  fit.lines.forEach((l, i) => (body += textEl(l, CX, Y0 + 260 + fit.size * (i + 0.9) * 1.08, fit.size, { fill: ink, weight: 900, anchor: "middle", maxW: IW - 30 })));
  return {
    body,
    variant: "objecticon",
    sig: { key: `objecticon-${obj}-${caption}`, vec: [] },
    description: `Line-drawn ${OBJECT_NOUNS[obj][0]} with the caption “${caption}”.`,
    complexity: 0.35,
    features: {
      pictorial: range(rng, 0.76, 0.9), line_art: range(rng, 0.8, 0.95), wit: range(rng, 0.62, 0.9), clean_minimal: range(rng, 0.65, 0.85), typography: range(rng, 0.35, 0.55),
      contrast: range(rng, 0.58, 0.78), density: range(rng, 0.25, 0.4), retro: range(rng, 0.2, 0.4), geometric: range(rng, 0.2, 0.35),
    },
  };
};

const woodcut: Generator = (rng, ink, ground) => {
  const obj = pick(rng, OBJECT_NAMES);
  const pattern = pick(rng, ["l1", "l2", "l3", "t3", "t4"]);
  const burst = rng() < 0.6;
  let body = toneDefs(ink);
  if (burst) {
    let rays = "";
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const a2 = a + Math.PI / 96;
      rays += `M${CX} ${H / 2} L${n1(CX + Math.cos(a) * 320)} ${n1(H / 2 + Math.sin(a) * 320)} L${n1(CX + Math.cos(a2) * 320)} ${n1(H / 2 + Math.sin(a2) * 320)} Z `;
    }
    body += clip("c", `<path d="${rays}" fill="${ink}"/><circle cx="${CX}" cy="${H / 2}" r="118" fill="${ground}"/>`);
  }
  body += `<circle cx="${CX}" cy="${H / 2}" r="118" fill="none" stroke="${ink}" stroke-width="3"/>`;
  body += drawPrims(OBJECTS[obj], CX - 90, H / 2 - 90, 180, "woodcut", ink, ground, 3.5, pattern);
  return {
    body,
    variant: "woodcut",
    sig: { key: `woodcut-${obj}`, vec: [burst ? 1 : 0] },
    description: `Linocut-style ${OBJECT_NOUNS[obj][0]}${burst ? " against a sunburst" : ""}, hatched in single ink.`,
    complexity: 0.6,
    features: {
      pictorial: range(rng, 0.8, 0.95), halftone_raster: range(rng, 0.5, 0.7), line_art: range(rng, 0.5, 0.7), retro: range(rng, 0.52, 0.7), contrast: range(rng, 0.72, 0.9),
      density: burst ? range(rng, 0.62, 0.78) : range(rng, 0.45, 0.6), clean_minimal: range(rng, 0.25, 0.4), dark_industrial: range(rng, 0.4, 0.6), wit: 0.1, geometric: burst ? 0.45 : 0.2,
    },
  };
};

const oddOneOut: Generator = (rng, ink, ground) => {
  const obj = pick(rng, OBJECT_NAMES);
  const cols = int(rng, 3, 5);
  const rows = Math.round(cols * 1.35);
  const cell = Math.min(IW / cols, (IH - 40) / rows);
  const odd = int(rng, 0, cols * rows - 1);
  const oddKind = pick(rng, ["flip", "solid", "other"] as const);
  const other = pick(rng, OBJECT_NAMES.filter((o) => o !== obj));
  let body = toneDefs(ink);
  const x0 = X0 + (IW - cols * cell) / 2;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = x0 + c * cell + cell * 0.1;
      const y = Y0 + r * cell + cell * 0.1;
      const s = cell * 0.8;
      if (i === odd && oddKind === "flip") body += `<g transform="rotate(180 ${n1(x + s / 2)} ${n1(y + s / 2)})">${drawPrims(OBJECTS[obj], x, y, s, "line", ink, ground, 2)}</g>`;
      else if (i === odd && oddKind === "solid") body += drawPrims(OBJECTS[obj], x, y, s, "woodcut", ink, ground, 2, "t5");
      else if (i === odd) body += drawPrims(OBJECTS[other], x, y, s, "line", ink, ground, 2);
      else body += drawPrims(OBJECTS[obj], x, y, s, "line", ink, ground, 2);
    }
  body += textEl("FIND THE ODD ONE OUT", CX, Y0 + IH - 8, 13, { fill: ink, font: MONO, weight: 700, anchor: "middle", spacing: 2, maxW: IW - 20 });
  return {
    body,
    variant: "oddoneout",
    sig: { key: `odd-${obj}`, vec: [(cols - 3) / 2] },
    description: `A grid of ${OBJECT_NOUNS[obj][1]} — one of them is different.`,
    complexity: 0.6,
    features: {
      pictorial: range(rng, 0.55, 0.7), geometric: range(rng, 0.55, 0.7), wit: range(rng, 0.55, 0.72), density: range(rng, 0.6, 0.85), line_art: range(rng, 0.5, 0.7),
      clean_minimal: range(rng, 0.3, 0.5), retro: range(rng, 0.3, 0.5), contrast: range(rng, 0.6, 0.8), abstract: 0.2, typography: 0.2,
    },
  };
};

const diagram: Generator = (rng, ink, ground) => {
  const obj = pick(rng, OBJECT_NAMES);
  const callouts = OBJECT_CALLOUTS[obj];
  const size = 184;
  const ox = CX - size / 2;
  const oy = Y0 + 34;
  let body = textEl(`FIG. ${int(rng, 1, 12)} — ${obj.toUpperCase()}`, X0, Y0 + 14, 12, { fill: ink, font: MONO, weight: 700, spacing: 1.5, maxW: IW });
  body += `<line x1="${X0}" y1="${Y0 + 22}" x2="${X0 + IW}" y2="${Y0 + 22}" stroke="${ink}" stroke-width="1"/>`;
  body += drawPrims(OBJECTS[obj], ox, oy, size, "line", ink, ground, 2.5);
  // Numbered markers on the drawing, legend underneath — like a real spec sheet.
  callouts.forEach(([px, py], i) => {
    const ax = ox + (px / 100) * size;
    const ay = oy + (py / 100) * size;
    body += `<circle cx="${n1(ax)}" cy="${n1(ay)}" r="8" fill="${ink}" stroke="${ground}" stroke-width="2"/>`;
    body += `<text x="${n1(ax)}" y="${n1(ay + 3.5)}" font-size="10" font-weight="700" text-anchor="middle" ${MONO} fill="${ground}">${i + 1}</text>`;
  });
  const ly = oy + size + 22;
  body += `<line x1="${ox}" y1="${ly - 10}" x2="${ox + size}" y2="${ly - 10}" stroke="${ink}" stroke-width="1"/><path d="M${ox} ${ly - 16} V${ly - 4} M${ox + size} ${ly - 16} V${ly - 4}" stroke="${ink}" stroke-width="1"/>`;
  callouts.forEach(([, , label], i) => {
    body += textEl(`${i + 1}  ${label}`, X0 + 8, ly + 18 + i * 18, 11, { fill: ink, font: MONO, maxW: IW - 16 });
  });
  body += textEl("SCALE 1:1 (EMOTIONALLY)", X0 + IW - 8, Y0 + IH - 6, 9, { fill: ink, font: MONO, anchor: "end", spacing: 1 });
  return {
    body,
    variant: "diagram",
    sig: { key: `diagram-${obj}`, vec: [] },
    description: `Technical diagram of ${an(OBJECT_NOUNS[obj][0])} with deeply honest labels.`,
    complexity: 0.55,
    features: {
      pictorial: range(rng, 0.65, 0.8), line_art: range(rng, 0.75, 0.9), typography: range(rng, 0.5, 0.7), wit: range(rng, 0.76, 0.95), architectural: range(rng, 0.3, 0.45),
      geometric: 0.3, clean_minimal: range(rng, 0.5, 0.7), density: range(rng, 0.45, 0.6), contrast: range(rng, 0.55, 0.7), retro: range(rng, 0.2, 0.35),
    },
  };
};

export const EXPANSION_CATEGORIES = ["scenes", "slogans", "pixel", "emblems", "objects"] as const satisfies readonly SourceCategory[];
export const EXPANSION_GENERATORS: Record<(typeof EXPANSION_CATEGORIES)[number], Generator[]> = {
  scenes: [mountains, celestialBody, seascape, landscape],
  slogans: [swissPoster, warningSign, receipt, quotePrint],
  pixel: [pixelSprite, gameScreen, pixelLandscape, terminal],
  emblems: [roundBadge, crest, stamp, ticketLabel],
  objects: [objectIcon, woodcut, oddOneOut, diagram],
};

/** Deterministic (no randomness) values for the dimensions added with this expansion. */
export function legacyExtras(variant: string): { pictorial: number; wit: number; retro: number; nature: number } {
  const table: Record<string, [number, number, number, number]> = {
    // [pictorial, wit, retro, nature]
    facade: [0.1, 0, 0.15, 0.02],
    perspective: [0.3, 0, 0.12, 0.02],
    skyline: [0.5, 0, 0.12, 0.05],
    slabs: [0.08, 0, 0.1, 0.02],
    monoform: [0.05, 0, 0.1, 0.03],
    scatter: [0.05, 0, 0.12, 0.03],
    concentric: [0.03, 0, 0.15, 0.03],
    tiling: [0.03, 0, 0.2, 0.02],
    word: [0.02, 0.15, 0.12, 0],
    coordinates: [0.05, 0.08, 0.25, 0.1],
    repeat: [0.02, 0.1, 0.2, 0],
    manifesto: [0.02, 0.12, 0.3, 0],
    radial: [0.1, 0, 0.35, 0.1],
    gradient: [0.05, 0, 0.35, 0.05],
    matrix: [0.12, 0, 0.65, 0.02],
    stipple: [0.2, 0, 0.15, 0.35],
    ridges: [0.15, 0, 0.2, 0.55],
    interference: [0.05, 0, 0.15, 0.35],
    contours: [0.15, 0, 0.1, 0.75],
    gesture: [0.08, 0, 0.05, 0.2],
  };
  const [pictorial, wit, retro, nature] = table[variant] ?? [0, 0, 0, 0];
  return { pictorial, wit, retro, nature };
}

