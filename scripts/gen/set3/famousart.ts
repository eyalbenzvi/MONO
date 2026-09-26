/**
 * Famous Art: single-ink homages to public-domain masterpieces, drawn from
 * scratch (no reproductions). Hokusai's wave, Van Gogh's swirling night,
 * modern masters (Mondrian, Malevich, Kandinsky, Klimt) and four icons
 * (Munch, Leonardo ×2, Vermeer). Each piece hangs with a museum label.
 */
import { IH, IW, X0, Y0, int, n1, pick, range, smooth, type Generator, type Rng } from "../core";
import { MONO, SERIF, textEl, toneDefs } from "../art";
import { clip as clipTo, line, type Box } from "../svg";

const clip = (id: string, b: Box, body: string) => clipTo(id, body, b);
import { ART, MUSEUM_MEDIUMS } from "../copy3";

type P = [number, number];

const poly = (p: P[]) => `M${p.map(([x, y]) => `${n1(x)} ${n1(y)}`).join(" L")}`;

/**
 * Museum presentation: a plaque (title / after artist, year / medium), an
 * ornate frame, or a quiet caption. Returns the box the art fills.
 */
function hang(rng: Rng, key: string, ink: string, ground: string) {
  const credit = ART[key];
  const title = pick(rng, credit.titles);
  const style = pick(rng, ["plaque", "frame", "caption"] as const);
  const medium = pick(rng, MUSEUM_MEDIUMS);
  let svg = "";
  let box: Box;
  if (style === "plaque") {
    box = { x: X0 + 6, y: Y0 + 6, w: IW - 12, h: IH - 84 };
    svg += `<rect x="${X0}" y="${Y0}" width="${IW}" height="${IH - 72}" fill="none" stroke="${ink}" stroke-width="3"/>`;
    const py = Y0 + IH - 58;
    svg += `<rect x="${X0 + 30}" y="${py}" width="${IW - 60}" height="58" fill="none" stroke="${ink}" stroke-width="1.2"/>`;
    svg += textEl(title, X0 + IW / 2, py + 20, 14, { fill: ink, font: SERIF, italic: true, anchor: "middle", maxW: IW - 76 });
    svg += textEl(`after ${credit.artist}, ${credit.year}`, X0 + IW / 2, py + 36, 10, { fill: ink, font: MONO, anchor: "middle", maxW: IW - 76 });
    svg += textEl(medium, X0 + IW / 2, py + 50, 8.5, { fill: ink, font: MONO, anchor: "middle", maxW: IW - 76 });
  } else if (style === "frame") {
    box = { x: X0 + 18, y: Y0 + 18, w: IW - 36, h: IH - 76 };
    svg += `<rect x="${X0 + 3}" y="${Y0 + 3}" width="${IW - 6}" height="${IH - 46}" fill="none" stroke="${ink}" stroke-width="6"/>`;
    svg += `<rect x="${X0 + 12}" y="${Y0 + 12}" width="${IW - 24}" height="${IH - 64}" fill="none" stroke="${ink}" stroke-width="1.5"/>`;
    for (const [cx, cy] of [[X0 + 3, Y0 + 3], [X0 + IW - 3, Y0 + 3], [X0 + 3, Y0 + IH - 43], [X0 + IW - 3, Y0 + IH - 43]])
      svg += `<rect x="${cx - 7}" y="${cy - 7}" width="14" height="14" fill="${ground}" stroke="${ink}" stroke-width="2.5"/><rect x="${cx - 2.5}" y="${cy - 2.5}" width="5" height="5" fill="${ink}"/>`;
    svg += textEl(title, X0 + IW / 2, Y0 + IH - 17, 13, { fill: ink, font: SERIF, italic: true, anchor: "middle", maxW: IW - 8 });
    svg += textEl(`AFTER ${credit.artist.toUpperCase()}, ${credit.year}`, X0 + IW / 2, Y0 + IH - 3, 8.5, { fill: ink, font: MONO, anchor: "middle", maxW: IW - 8, spacing: 1.5 });
  } else {
    box = { x: X0, y: Y0, w: IW, h: IH - 44 };
    svg += textEl(title, X0, Y0 + IH - 22, 15, { fill: ink, font: SERIF, italic: true, maxW: IW });
    svg += textEl(`AFTER ${credit.artist.toUpperCase()} · ${credit.year}`, X0, Y0 + IH - 5, 9, { fill: ink, font: MONO, maxW: IW, spacing: 1.5 });
  }
  return { svg, box, title, credit, style };
}

const artFeatures = (rng: Rng) => ({
  classic: range(rng, 0.85, 1), pictorial: range(rng, 0.6, 0.8), typography: range(rng, 0.15, 0.28), retro: range(rng, 0.3, 0.45), contrast: range(rng, 0.6, 0.78),
});

/* ------------------------------------------------------------------ */
/* The Great Wave (after Hokusai)                                      */
/* ------------------------------------------------------------------ */

/** A curling wave as one ink silhouette with ground bands and foam claws. */
function curl(rng: Rng, b: Box, cx: number, cy: number, R: number, ink: string, ground: string, faceEnd: P) {
  const a0 = Math.PI;
  const a1 = Math.PI * 2 + 1.05;
  const thick0 = R * 0.3;
  const N = 40;
  const outer: P[] = [];
  const inner: P[] = [];
  const bands: P[][] = [[], [], []];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const a = a0 + (a1 - a0) * s;
    const r = R * (1 - 0.55 * s);
    const t = thick0 * (1 - s) ** 1.2;
    outer.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    inner.push([cx + (r - t) * Math.cos(a), cy + (r - t) * Math.sin(a)]);
    [0.3, 0.55, 0.8].forEach((f, k) => s < 0.85 && bands[k].push([cx + (r - t * f) * Math.cos(a), cy + (r - t * f) * Math.sin(a)]));
  }
  const bottom = b.y + b.h + 6;
  const back = `M${n1(b.x - 6)} ${n1(bottom)} C${n1(b.x + b.w * 0.02)} ${n1(cy + R * 1.3)} ${n1(cx - R * 1.08)} ${n1(cy + R * 0.7)} ${n1(outer[0][0])} ${n1(outer[0][1])}`;
  const innerRev = [...inner].reverse();
  const face = `C${n1(cx - R * 0.55)} ${n1(cy + R * 1.0)} ${n1(cx + R * 0.7)} ${n1(faceEnd[1] - R * 0.1)} ${n1(faceEnd[0])} ${n1(faceEnd[1])} L${n1(b.x + b.w + 6)} ${n1(bottom)} Z`;
  let svg = `<path d="${back} ${smooth(outer).replace(/^M[^Q]+/, "")} L${n1(innerRev[0][0])} ${n1(innerRev[0][1])} ${smooth(innerRev).replace(/^M[^Q]+/, "")} ${face}" fill="${ink}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>`;
  for (const [k, bd] of bands.entries()) {
    svg += line(smooth(bd), ground, 2.2 - k * 0.4);
    const off = thick0 * [0.3, 0.55, 0.8][k];
    svg += line(`M${n1(b.x + 10 + k * 14)} ${n1(bottom)} C${n1(b.x + b.w * 0.05 + off)} ${n1(cy + R * 1.2)} ${n1(cx - R * 1.05 + off)} ${n1(cy + R * 0.6)} ${n1(outer[0][0] + off)} ${n1(outer[0][1] + 4)}`, ground, 2 - k * 0.4);
  }
  // foam claws along the lip, spray falling into the hollow
  for (let i = Math.floor(N * 0.3); i <= N * 0.97; i += 2) {
    const [x, y] = outer[i];
    const a = a0 + (a1 - a0) * (i / N);
    const r = range(rng, 2.5, 5.5);
    svg += `<circle cx="${n1(x + Math.cos(a) * (r + 1))}" cy="${n1(y + Math.sin(a) * (r + 1))}" r="${n1(r)}" fill="${ground}" stroke="${ink}" stroke-width="1.8"/>`;
  }
  const tip = outer[N];
  for (let i = 0; i < 26; i++) {
    const x = tip[0] + range(rng, -R * 0.45, R * 0.35);
    const y = tip[1] + range(rng, 4, R * 0.75);
    svg += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(range(rng, 0.9, 2.4))}" fill="${ink}"/>`;
  }
  return svg;
}

export const greatWave: Generator = (rng, ink, ground) => {
  const h = hang(rng, "wave", ink, ground);
  const b = h.box;
  const R = b.w * range(rng, 0.27, 0.33);
  const cx = b.x + b.w * range(rng, 0.38, 0.46);
  const cy = b.y + b.h * range(rng, 0.32, 0.4);
  const mirror = rng() < 0.3;
  const fuji = rng() < 0.85;
  const boats = int(rng, 0, 2);
  const sky = pick(rng, ["plain", "dots", "clouds"] as const);
  let art = toneDefs(ink);
  if (sky === "dots") art += `<rect x="${n1(b.x)}" y="${n1(b.y)}" width="${n1(b.w)}" height="${n1(b.h * 0.45)}" fill="url(#t1)"/>`;
  if (sky === "clouds")
    for (let i = 0; i < 3; i++) {
      const y = b.y + 18 + i * 16;
      const x = b.x + b.w * range(rng, 0.5, 0.75);
      art += line(`M${n1(x - 40)} ${n1(y)} Q${n1(x)} ${n1(y - 8)} ${n1(x + 40)} ${n1(y)}`, ink, 1.4);
    }
  // The front face drops to the bottom, leaving an open trough (with Fuji) on the right.
  const faceEnd: P = [b.x + b.w * range(rng, 0.52, 0.62), b.y + b.h + 6];
  art += curl(rng, b, cx, cy, R, ink, ground, faceEnd);
  // swell lines across the foreground sea
  for (let y = b.y + b.h * 0.86, k = 0; y < b.y + b.h + 4; y += 9, k++) {
    let d = `M${n1(b.x - 4)} ${n1(y)}`;
    for (let x = b.x - 4; x < b.x + b.w + 8; x += 24) d += ` q6 -${4 + (k % 2) * 2} 12 0 t12 0`;
    art += line(d, ground, 1.6);
  }
  if (fuji) {
    const fx = b.x + b.w * 0.74;
    const fy = b.y + b.h * 0.86;
    const fw = b.w * 0.2;
    const fh = b.h * 0.1;
    art += `<path d="M${n1(fx - fw)} ${n1(fy)} L${n1(fx - fw * 0.18)} ${n1(fy - fh)} L${n1(fx + fw * 0.18)} ${n1(fy - fh)} L${n1(fx + fw)} ${n1(fy)} Z" fill="${ground}" stroke="${ink}" stroke-width="2"/><path d="M${n1(fx - fw)} ${n1(fy)} L${n1(fx - fw * 0.18)} ${n1(fy - fh)} L${n1(fx + fw * 0.18)} ${n1(fy - fh)} L${n1(fx + fw)} ${n1(fy)} Z" fill="url(#l1)"/>`;
    art += `<path d="M${n1(fx - fw * 0.18)} ${n1(fy - fh)} L${n1(fx + fw * 0.18)} ${n1(fy - fh)} L${n1(fx + fw * 0.42)} ${n1(fy - fh * 0.55)} L${n1(fx + fw * 0.2)} ${n1(fy - fh * 0.62)} L${n1(fx)} ${n1(fy - fh * 0.5)} L${n1(fx - fw * 0.22)} ${n1(fy - fh * 0.62)} L${n1(fx - fw * 0.42)} ${n1(fy - fh * 0.55)} Z" fill="${ground}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>`;
  }
  art += `<path d="M${n1(b.x + b.w * 0.45)} ${n1(b.y + b.h * 0.86)} H${n1(b.x + b.w + 6)} V${n1(b.y + b.h + 6)} H${n1(b.x + b.w * 0.45)} Z" fill="url(#l1)"/>`;
  // a smaller breaker in front
  art += curl(rng, b, b.x + b.w * 0.88, b.y + b.h * 0.9, R * 0.28, ink, ground, [b.x + b.w + 6, b.y + b.h + 6]);
  for (let i = 0; i < boats; i++) {
    const bx = cx - R * 0.2 + i * R * 0.7;
    const by = cy + R * (0.95 + i * 0.25);
    const bl = R * 0.7;
    art += `<path d="M${n1(bx - bl / 2)} ${n1(by - 6)} Q${n1(bx)} ${n1(by + 8)} ${n1(bx + bl / 2)} ${n1(by - 10)} Q${n1(bx)} ${n1(by + 2)} ${n1(bx - bl / 2)} ${n1(by - 6)} Z" fill="${ground}" stroke="${ground}" stroke-width="3"/>`;
    for (let k = 0; k < 6; k++) art += `<circle cx="${n1(bx - bl * 0.3 + k * bl * 0.12)}" cy="${n1(by - 4 + k * -0.4)}" r="1.8" fill="${ink}"/>`;
  }
  const cart = { x: mirror ? b.x + 8 : b.x + b.w - 30, y: b.y + 8 };
  let body = clip("wave", b, `<g${mirror ? ` transform="translate(${n1(2 * b.x + b.w)} 0) scale(-1 1)"` : ""}>${art}</g>`);
  body += `<rect x="${n1(cart.x)}" y="${n1(cart.y)}" width="22" height="92" fill="${ground}" stroke="${ink}" stroke-width="1.5"/>`;
  body += `<g transform="translate(${n1(cart.x + 15)} ${n1(cart.y + 46)}) rotate(90)">${textEl(h.title.toUpperCase(), 0, 0, 9, { fill: ink, font: SERIF, weight: 700, anchor: "middle", maxW: 84, spacing: 1 })}</g>`;
  body += h.svg;
  return {
    body,
    variant: "art-wave",
    sig: { key: `wave-${h.style}`, vec: [mirror ? 1 : 0, (R / b.w - 0.27) / 0.06] },
    description: `“${h.title}” — a single-ink homage to Hokusai's Great Wave (1831, public domain), claws of foam and all.`,
    complexity: 0.75,
    features: { ...artFeatures(rng), nature: range(rng, 0.65, 0.82), line_art: range(rng, 0.5, 0.65), density: range(rng, 0.6, 0.75), halftone_raster: sky === "dots" ? 0.35 : 0.12, wit: h.title.includes("(") || h.title.includes("Monday") ? range(rng, 0.45, 0.6) : range(rng, 0.1, 0.2), abstract: 0.2, dark_industrial: range(rng, 0.3, 0.45), clean_minimal: range(rng, 0.2, 0.35) },
  };
};

/* ------------------------------------------------------------------ */
/* The Starry Night (after Van Gogh)                                   */
/* ------------------------------------------------------------------ */

export const starryNight: Generator = (rng, ink, ground) => {
  const h = hang(rng, "starry", ink, ground);
  const b = h.box;
  const horizon = b.y + b.h * range(rng, 0.66, 0.74);
  const vortices = Array.from({ length: int(rng, 1, 2) }, (_, i) => ({
    x: b.x + b.w * (i === 0 ? range(rng, 0.35, 0.55) : range(rng, 0.6, 0.8)),
    y: b.y + b.h * (i === 0 ? range(rng, 0.26, 0.36) : range(rng, 0.42, 0.52)),
    s: (i === 0 ? 1 : -0.8) * range(rng, 0.8, 1.2),
    r: b.w * (i === 0 ? 0.2 : 0.13),
  }));
  const moon = { x: b.x + b.w * range(rng, 0.76, 0.86), y: b.y + b.h * range(rng, 0.1, 0.16), r: range(rng, 13, 18) };
  const starList = Array.from({ length: int(rng, 5, 8) }, () => ({ x: range(rng, b.x + 14, b.x + b.w - 14), y: range(rng, b.y + 14, horizon - 30), r: range(rng, 2.5, 4.5) }));
  const cyp = { x: b.x + b.w * (rng() < 0.7 ? range(rng, 0.12, 0.2) : range(rng, 0.8, 0.88)), w: b.w * range(rng, 0.11, 0.15), top: b.y + b.h * range(rng, 0.08, 0.2) };
  const phase = range(rng, 0, Math.PI * 2);
  const halos = [{ ...moon, r: moon.r * 2.2 }, ...starList.map((s) => ({ ...s, r: s.r * 3.4 }))];
  const field = (x: number, y: number): P => {
    let vx = 1;
    let vy = 0.35 * Math.sin((y - b.y) / 20 + x / 60 + phase);
    for (const v of vortices) {
      const dx = x - v.x;
      const dy = y - v.y;
      const f = v.s / ((dx * dx + dy * dy) / (v.r * v.r) + 0.6);
      vx += (-dy / v.r) * f * 2.2;
      vy += (dx / v.r) * f * 2.2;
    }
    const l = Math.hypot(vx, vy) || 1;
    return [vx / l, vy / l];
  };
  let art = toneDefs(ink);
  let strokes = "";
  for (let gy = b.y + 4; gy < horizon - 4; gy += 8)
    for (let gx = b.x + 2; gx < b.x + b.w; gx += 9) {
      let x = gx + range(rng, -3, 3);
      let y = gy + range(rng, -3, 3);
      if (halos.some((o) => Math.hypot(x - o.x, y - o.y) < o.r + 3)) continue;
      if (Math.abs(x - cyp.x) < cyp.w * 0.6 && y > cyp.top) continue;
      let d = `M${n1(x)} ${n1(y)}`;
      for (let k = 0; k < 4; k++) {
        const [vx, vy] = field(x, y);
        x += vx * 3.6;
        y += vy * 3.6;
        d += ` L${n1(x)} ${n1(y)}`;
      }
      strokes += d;
    }
  art += line(strokes, ink, 1.9);
  // moon + stars with dashed halos
  art += `<circle cx="${n1(moon.x)}" cy="${n1(moon.y)}" r="${n1(moon.r)}" fill="${ink}"/><circle cx="${n1(moon.x + moon.r * 0.45)}" cy="${n1(moon.y - moon.r * 0.25)}" r="${n1(moon.r * 0.8)}" fill="${ground}"/>`;
  for (const k of [1.45, 1.85]) art += `<circle cx="${n1(moon.x)}" cy="${n1(moon.y)}" r="${n1(moon.r * k)}" fill="none" stroke="${ink}" stroke-width="2" stroke-dasharray="5 4"/>`;
  for (const s of starList) {
    art += `<circle cx="${n1(s.x)}" cy="${n1(s.y)}" r="${n1(s.r)}" fill="${ink}"/>`;
    for (const k of [2, 3]) art += `<circle cx="${n1(s.x)}" cy="${n1(s.y)}" r="${n1(s.r * k)}" fill="none" stroke="${ink}" stroke-width="1.4" stroke-dasharray="3 3"/>`;
  }
  // hills + village
  const hill: P[] = [];
  for (let x = b.x - 4; x <= b.x + b.w + 4; x += 12) hill.push([x, horizon + Math.sin(x / 30 + phase) * 6 + range(rng, -2, 2)]);
  art += `<path d="${smooth(hill)} L${n1(b.x + b.w + 4)} ${n1(b.y + b.h + 4)} L${n1(b.x - 4)} ${n1(b.y + b.h + 4)} Z" fill="url(#l1)" stroke="${ink}" stroke-width="2"/>`;
  let village = "";
  const vy = horizon + b.h * 0.12;
  for (let x = b.x + 8; x < b.x + b.w - 14; x += range(rng, 16, 24)) {
    if (Math.abs(x - cyp.x) < cyp.w) continue;
    const w = range(rng, 10, 16);
    const hh = range(rng, 8, 13);
    const y = vy + range(rng, -6, 10);
    village += `<path d="M${n1(x)} ${n1(y)} V${n1(y - hh)} L${n1(x + w / 2)} ${n1(y - hh - 7)} L${n1(x + w)} ${n1(y - hh)} V${n1(y)} Z" fill="${ink}"/>`;
    if (rng() < 0.6) village += `<rect x="${n1(x + w * 0.35)}" y="${n1(y - hh * 0.65)}" width="3" height="3" fill="${ground}"/>`;
  }
  const sx = b.x + b.w * range(rng, 0.45, 0.6);
  village += `<path d="M${n1(sx - 6)} ${n1(vy + 4)} V${n1(vy - 18)} L${n1(sx)} ${n1(vy - 50)} L${n1(sx + 6)} ${n1(vy - 18)} V${n1(vy + 4)} Z" fill="${ink}"/>`;
  art += `<g stroke="${ground}" stroke-width="1.2">${village}</g>`;
  // cypress flame
  const left: P[] = [];
  const right: P[] = [];
  const bottom = b.y + b.h + 4;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const y = bottom - (bottom - cyp.top) * t;
    const w = cyp.w * (1 - t ** 1.6) * (0.75 + 0.25 * Math.sin(t * 9 + phase));
    left.push([cyp.x - w / 2 + Math.sin(t * 7) * 3, y]);
    right.push([cyp.x + w / 2 + Math.sin(t * 7 + 1) * 3, y]);
  }
  art += `<path d="${smooth([...left, ...right.reverse()], true)}" fill="${ink}"/>`;
  for (let i = 1; i < 6; i++) {
    const y0 = bottom - (bottom - cyp.top) * (i / 6);
    art += line(`M${n1(cyp.x - 2)} ${n1(y0 + 20)} Q${n1(cyp.x + 4)} ${n1(y0 + 6)} ${n1(cyp.x - 1)} ${n1(y0 - 8)}`, ground, 1.4);
  }
  const body = clip("starry", b, art) + h.svg;
  return {
    body,
    variant: "art-starry",
    sig: { key: `starry-${h.style}`, vec: [vortices.length - 1, cyp.x < b.x + b.w / 2 ? 0 : 1] },
    description: `“${h.title}” — a single-ink homage to Van Gogh's swirling night sky (1889, public domain), cypress and crescent moon included.`,
    complexity: 0.85,
    features: { ...artFeatures(rng), nature: range(rng, 0.55, 0.7), line_art: range(rng, 0.65, 0.8), density: range(rng, 0.72, 0.86), abstract: range(rng, 0.35, 0.5), halftone_raster: 0.15, wit: h.title.includes("ish") || h.title.includes("Sleep") ? range(rng, 0.4, 0.55) : range(rng, 0.1, 0.2), dark_industrial: range(rng, 0.35, 0.5), clean_minimal: range(rng, 0.1, 0.22) },
  };
};

/* ------------------------------------------------------------------ */
/* Modern masters                                                      */
/* ------------------------------------------------------------------ */

const TEXTURES = ["ink", "url(#t3)", "url(#l2)", "url(#t5)"];

function mondrian(rng: Rng, b: Box, ink: string) {
  const cells: Box[] = [{ ...b }];
  const splits: string[] = [];
  const target = int(rng, 5, 9);
  while (cells.length < target) {
    cells.sort((p, q) => q.w * q.h - p.w * p.h);
    const c = cells.shift()!;
    const vertical = c.w > c.h ? rng() < 0.75 : rng() < 0.25;
    const f = range(rng, 0.3, 0.7);
    if (vertical) {
      const x = c.x + c.w * f;
      cells.push({ ...c, w: x - c.x }, { ...c, x, w: c.x + c.w - x });
      splits.push(`M${n1(x)} ${n1(c.y)} V${n1(c.y + c.h)}`);
    } else {
      const y = c.y + c.h * f;
      cells.push({ ...c, h: y - c.y }, { ...c, y, h: c.y + c.h - y });
      splits.push(`M${n1(c.x)} ${n1(y)} H${n1(c.x + c.w)}`);
    }
  }
  let out = "";
  const fills = int(rng, 2, 4);
  for (let i = 0; i < fills; i++) {
    const c = cells[int(rng, 0, cells.length - 1)];
    const t = TEXTURES[i % TEXTURES.length];
    out += `<rect x="${n1(c.x)}" y="${n1(c.y)}" width="${n1(c.w)}" height="${n1(c.h)}" fill="${t === "ink" ? ink : t}"/>`;
  }
  const sw = range(rng, 5, 8);
  out += `<path d="${splits.join(" ")}" stroke="${ink}" stroke-width="${n1(sw)}" fill="none"/><rect x="${n1(b.x)}" y="${n1(b.y)}" width="${n1(b.w)}" height="${n1(b.h)}" fill="none" stroke="${ink}" stroke-width="${n1(sw)}"/>`;
  return { svg: out, vec: [(target - 5) / 4, fills / 4] };
}

function malevich(rng: Rng, b: Box, ink: string, ground: string) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (rng() < 0.25) {
    const s = Math.min(b.w, b.h) * 0.62;
    const j = () => range(rng, -4, 4);
    return {
      svg: `<path d="M${n1(cx - s / 2 + j())} ${n1(cy - s / 2 + j())} L${n1(cx + s / 2 + j())} ${n1(cy - s / 2 + j())} L${n1(cx + s / 2 + j())} ${n1(cy + s / 2 + j())} L${n1(cx - s / 2 + j())} ${n1(cy + s / 2 + j())} Z" fill="${ink}"/>`,
      vec: [1, 0],
    };
  }
  const axis = range(rng, -40, -15);
  let out = "";
  const n = int(rng, 8, 13);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = b.x + b.w * (0.2 + t * 0.6) + range(rng, -30, 30);
    const y = b.y + b.h * (0.15 + t * 0.7) + range(rng, -20, 20);
    const w = i === 0 ? range(rng, 70, 110) : range(rng, 20, 110);
    const hh = i === 0 ? range(rng, 40, 70) : range(rng, 5, 24);
    const style = pick(rng, ["ink", "ink", "outline", "url(#l2)", "url(#t3)"]);
    const rot = axis + (rng() < 0.2 ? 90 : 0) + range(rng, -6, 6);
    out += `<rect x="${n1(x - w / 2)}" y="${n1(y - hh / 2)}" width="${n1(w)}" height="${n1(hh)}" transform="rotate(${n1(rot)} ${n1(x)} ${n1(y)})" fill="${style === "outline" ? ground : style === "ink" ? ink : style}" stroke="${ink}" stroke-width="${style === "outline" ? 2 : 0}"/>`;
  }
  out += `<circle cx="${n1(b.x + b.w * range(rng, 0.2, 0.8))}" cy="${n1(b.y + b.h * range(rng, 0.15, 0.4))}" r="${n1(range(rng, 12, 26))}" fill="${ink}"/>`;
  return { svg: out, vec: [0, (axis + 40) / 25] };
}

function kandinsky(rng: Rng, b: Box, ink: string, ground: string) {
  const cols = 3;
  const rows = int(rng, 3, 4);
  const gap = 5;
  const cw = (b.w - gap * (cols + 1)) / cols;
  const ch = (b.h - gap * (rows + 1)) / rows;
  const s = Math.min(cw, ch);
  let out = "";
  const fillsets = [ink, ground, "url(#t2)", "url(#l1)", "url(#t4)", ground];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = b.x + gap + c * (cw + gap) + (cw - s) / 2;
      const y = b.y + gap + r * (ch + gap) + (ch - s) / 2;
      out += `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(s)}" height="${n1(s)}" fill="${pick(rng, [ground, "url(#t1)", ground])}" stroke="${ink}" stroke-width="2"/>`;
      const rings = int(rng, 3, 5);
      const ox = range(rng, -s * 0.08, s * 0.08);
      const oy = range(rng, -s * 0.08, s * 0.08);
      for (let k = 0; k < rings; k++) {
        const rr = (s * 0.42 * (rings - k)) / rings;
        const f = pick(rng, fillsets);
        out += `<circle cx="${n1(x + s / 2 + ox * (k / rings))}" cy="${n1(y + s / 2 + oy * (k / rings))}" r="${n1(rr)}" fill="${f}" stroke="${ink}" stroke-width="1.6"/>`;
      }
    }
  return { svg: out, vec: [(rows - 3) * 1] };
}

function spiralPath(cx: number, cy: number, r: number, turns: number, dir: number, a0: number) {
  const p: P[] = [];
  const steps = Math.ceil(turns * 14);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + dir * t * turns * Math.PI * 2;
    const rr = r * (1 - t * 0.92);
    p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return p;
}

function klimt(rng: Rng, b: Box, ink: string, ground: string) {
  const cx = b.x + b.w / 2;
  const base = b.y + b.h - 34;
  const top = b.y + b.h * range(rng, 0.42, 0.5);
  let out = "";
  // ornament band: triangles with eyes
  for (let x = b.x; x < b.x + b.w; x += 18) {
    out += `<path d="M${n1(x)} ${n1(b.y + b.h)} L${n1(x + 9)} ${n1(b.y + b.h - 22)} L${n1(x + 18)} ${n1(b.y + b.h)} Z" fill="none" stroke="${ink}" stroke-width="1.6"/><circle cx="${n1(x + 9)}" cy="${n1(b.y + b.h - 8)}" r="2.6" fill="${ink}"/>`;
  }
  out += `<path d="M${n1(cx - 12)} ${n1(base)} Q${n1(cx - 5)} ${n1((base + top) / 2)} ${n1(cx - 6)} ${n1(top)} L${n1(cx + 6)} ${n1(top)} Q${n1(cx + 5)} ${n1((base + top) / 2)} ${n1(cx + 12)} ${n1(base)} Z" fill="${ink}"/>`;
  const n = int(rng, 6, 9);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const t = i / (n - 1);
    const sx = cx + side * 4;
    const sy = top + (base - top) * t * 0.55;
    const ex = cx + side * b.w * range(rng, 0.22, 0.42);
    const ey = b.y + b.h * range(rng, 0.12, 0.55);
    const r = range(rng, 12, 26);
    const branch = `M${n1(sx)} ${n1(sy)} Q${n1((sx + ex) / 2)} ${n1(sy - 30)} ${n1(ex)} ${n1(ey + r)}`;
    out += line(branch, ink, 3.4);
    out += line(smooth(spiralPath(ex, ey, r, range(rng, 2, 3), side, Math.PI / 2)), ink, 2.6);
    // small curls off the branch
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2 - 10;
    out += line(smooth(spiralPath(mx, my - 8, 8, 1.6, -side, Math.PI / 2)), ink, 1.8);
  }
  if (rng() < 0.6) {
    const bx = cx + range(rng, -40, 40);
    const by = top - 12;
    out += `<path d="M${n1(bx)} ${n1(by)} q8 -10 18 -4 l8 -3 -5 7 q-6 10 -21 0 z" fill="${ink}" stroke="${ground}" stroke-width="1"/>`;
  }
  return { svg: out, vec: [(n - 6) / 3] };
}

export const modernMasters: Generator = (rng, ink, ground) => {
  const which = pick(rng, ["mondrian", "malevich", "kandinsky", "klimt"] as const);
  const h = hang(rng, which, ink, ground);
  const b = h.box;
  const inner = { x: b.x + 6, y: b.y + 6, w: b.w - 12, h: b.h - 12 };
  const r = which === "mondrian" ? mondrian(rng, inner, ink) : which === "malevich" ? malevich(rng, inner, ink, ground) : which === "kandinsky" ? kandinsky(rng, inner, ink, ground) : klimt(rng, inner, ink, ground);
  const body = toneDefs(ink) + clip("mm", b, r.svg) + h.svg;
  const geo = which === "mondrian" || which === "kandinsky";
  return {
    body,
    variant: `art-${which}`,
    sig: { key: `${which}-${h.style}`, vec: r.vec },
    description: `“${h.title}” — a single-ink homage to ${h.credit.artist} (${h.credit.year}, public domain).`,
    complexity: 0.6,
    features: {
      ...artFeatures(rng), pictorial: which === "klimt" ? range(rng, 0.45, 0.6) : range(rng, 0.15, 0.3), abstract: range(rng, 0.7, 0.9), geometric: geo || which === "malevich" ? range(rng, 0.75, 0.92) : range(rng, 0.3, 0.45),
      line_art: which === "klimt" ? range(rng, 0.7, 0.85) : range(rng, 0.3, 0.45), density: range(rng, 0.45, 0.65), clean_minimal: which === "klimt" ? 0.3 : range(rng, 0.55, 0.75),
      nature: which === "klimt" ? range(rng, 0.45, 0.6) : 0.02, halftone_raster: range(rng, 0.2, 0.35), wit: h.title.includes("(") || h.title.includes("Mood") || h.title.includes("Meeting") ? range(rng, 0.4, 0.55) : range(rng, 0.1, 0.2), dark_industrial: range(rng, 0.25, 0.4),
    },
  };
};

/* ------------------------------------------------------------------ */
/* Masterpiece icons: Munch, Leonardo ×2, Vermeer                      */
/* ------------------------------------------------------------------ */

function scream(rng: Rng, b: Box, ink: string, ground: string) {
  let out = "";
  const bands = int(rng, 6, 9);
  const skyH = b.h * 0.55;
  const waves: P[][] = [];
  const phase = range(rng, 0, Math.PI * 2);
  for (let i = 0; i <= bands; i++) {
    const y0 = b.y + (skyH * i) / bands;
    const pts: P[] = [];
    for (let x = b.x - 5; x <= b.x + b.w + 5; x += 10) pts.push([x, y0 + Math.sin(x / 28 + i * 0.9 + phase) * (5 + i * 0.8)]);
    waves.push(pts);
  }
  for (let i = 0; i < bands; i++) {
    if (i % 2 === 0) out += `<path d="${smooth(waves[i])} L${poly([...waves[i + 1]].reverse()).slice(1)} Z" fill="url(#l1)"/>`;
    out += line(smooth(waves[i]), ink, 2.2);
  }
  // fjord shore
  out += `<path d="M${n1(b.x - 5)} ${n1(b.y + skyH + 8)} Q${n1(b.x + b.w * 0.3)} ${n1(b.y + skyH - 10)} ${n1(b.x + b.w * 0.55)} ${n1(b.y + skyH + 22)} Q${n1(b.x + b.w * 0.3)} ${n1(b.y + skyH + 50)} ${n1(b.x - 5)} ${n1(b.y + skyH + 60)} Z" fill="url(#t2)" stroke="${ink}" stroke-width="2"/>`;
  // bridge in perspective
  const L: P = [b.x - 5, b.y + b.h + 5];
  const Rt: P = [b.x + b.w + 5, b.y + b.h * 0.52];
  out += `<path d="M${n1(L[0])} ${n1(L[1] - 70)} L${n1(Rt[0])} ${n1(Rt[1])} L${n1(Rt[0])} ${n1(Rt[1] + 18)} L${n1(L[0])} ${n1(L[1])} Z" fill="${ground}" stroke="${ink}" stroke-width="2.5"/>`;
  for (let i = 0; i < 9; i++) {
    const t = i / 9;
    const x = L[0] + (Rt[0] - L[0]) * t ** 0.8;
    const yTop = L[1] - 70 + (Rt[1] - (L[1] - 70)) * t ** 0.8;
    out += line(`M${n1(x)} ${n1(yTop)} L${n1(x + 10)} ${n1(yTop + 22 - t * 14)}`, ink, 1.6);
  }
  for (const dx of [0, 10]) out += `<path d="M${n1(b.x + b.w * 0.8 + dx)} ${n1(b.y + b.h * 0.56)} v-16 a3 3 0 0 1 6 0 v16 z" fill="${ink}"/>`;
  // the figure
  const fx = b.x + b.w * range(rng, 0.36, 0.46);
  const fy = b.y + b.h * 0.64;
  const s = b.w * 0.2;
  out += `<path d="M${n1(fx - s * 0.5)} ${n1(b.y + b.h + 5)} Q${n1(fx - s * 0.8)} ${n1(fy + s * 1.2)} ${n1(fx - s * 0.35)} ${n1(fy + s * 0.55)} L${n1(fx + s * 0.35)} ${n1(fy + s * 0.55)} Q${n1(fx + s * 0.9)} ${n1(fy + s * 1.3)} ${n1(fx + s * 0.6)} ${n1(b.y + b.h + 5)} Z" fill="${ink}"/>`;
  out += `<path d="M${n1(fx)} ${n1(fy - s * 0.75)} C${n1(fx + s * 0.55)} ${n1(fy - s * 0.75)} ${n1(fx + s * 0.5)} ${n1(fy + s * 0.2)} ${n1(fx + s * 0.12)} ${n1(fy + s * 0.55)} Q${n1(fx)} ${n1(fy + s * 0.62)} ${n1(fx - s * 0.12)} ${n1(fy + s * 0.55)} C${n1(fx - s * 0.5)} ${n1(fy + s * 0.2)} ${n1(fx - s * 0.55)} ${n1(fy - s * 0.75)} ${n1(fx)} ${n1(fy - s * 0.75)} Z" fill="${ground}" stroke="${ink}" stroke-width="2.5"/>`;
  for (const d of [-1, 1]) {
    out += `<ellipse cx="${n1(fx + d * s * 0.2)}" cy="${n1(fy - s * 0.2)}" rx="${n1(s * 0.09)}" ry="${n1(s * 0.14)}" fill="${ink}"/>`;
    out += `<ellipse cx="${n1(fx + d * s * 0.5)}" cy="${n1(fy - s * 0.05)}" rx="${n1(s * 0.13)}" ry="${n1(s * 0.34)}" transform="rotate(${d * -12} ${n1(fx + d * s * 0.5)} ${n1(fy - s * 0.05)})" fill="${ground}" stroke="${ink}" stroke-width="2.2"/>`;
  }
  out += `<ellipse cx="${n1(fx)}" cy="${n1(fy + s * 0.25)}" rx="${n1(s * 0.09)}" ry="${n1(s * 0.16)}" fill="${ink}"/>`;
  out += `<circle cx="${n1(fx - s * 0.04)}" cy="${n1(fy + s * 0.02)}" r="1.4" fill="${ink}"/><circle cx="${n1(fx + s * 0.04)}" cy="${n1(fy + s * 0.02)}" r="1.4" fill="${ink}"/>`;
  return { svg: out, vec: [(bands - 6) / 3] };
}

function vitruvian(rng: Rng, b: Box, ink: string, ground: string) {
  const cx = b.x + b.w / 2;
  const R = Math.min(b.w * 0.44, b.h * 0.36);
  const cy = b.y + b.h * 0.5;
  const side = R * 1.64;
  const bottom = cy + R;
  const top = bottom - side;
  let out = `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(R)}" fill="none" stroke="${ink}" stroke-width="2"/><rect x="${n1(cx - side / 2)}" y="${n1(top)}" width="${n1(side)}" height="${n1(side)}" fill="none" stroke="${ink}" stroke-width="2"/>`;
  for (let i = 1; i < 8; i++) out += line(`M${n1(cx - side / 2 + (side * i) / 8)} ${n1(bottom)} v5 M${n1(cx - side / 2)} ${n1(top + (side * i) / 8)} h-5`, ink, 1);
  // limbs: thick ink stroke with a ground core reads as an outlined body
  const neck: P = [cx, top + side * 0.14];
  const hip: P = [cx, top + side * 0.52];
  const sh = top + side * 0.2;
  const raise = range(rng, 0.35, 0.5);
  const spread = range(rng, 0.45, 0.6);
  const limbs = [
    `M${n1(cx - side / 2 + 4)} ${n1(sh)} L${n1(cx + side / 2 - 4)} ${n1(sh)}`,
    `M${n1(cx)} ${n1(sh)} L${n1(cx - Math.cos(raise) * R * 0.98)} ${n1(cy - Math.sin(raise) * R * 0.98 - (cy - sh) * 0.2)}`,
    `M${n1(cx)} ${n1(sh)} L${n1(cx + Math.cos(raise) * R * 0.98)} ${n1(cy - Math.sin(raise) * R * 0.98 - (cy - sh) * 0.2)}`,
    `M${n1(hip[0])} ${n1(hip[1])} L${n1(cx - side * 0.06)} ${n1(bottom - 2)} M${n1(hip[0])} ${n1(hip[1])} L${n1(cx + side * 0.06)} ${n1(bottom - 2)}`,
    `M${n1(hip[0])} ${n1(hip[1])} L${n1(cx - Math.sin(spread) * R * 0.96)} ${n1(cy + Math.cos(spread) * R * 0.96)} M${n1(hip[0])} ${n1(hip[1])} L${n1(cx + Math.sin(spread) * R * 0.96)} ${n1(cy + Math.cos(spread) * R * 0.96)}`,
    `M${n1(neck[0])} ${n1(neck[1])} L${n1(hip[0])} ${n1(hip[1])}`,
  ].join(" ");
  out += line(limbs, ink, 9) + line(limbs, ground, 4);
  out += `<ellipse cx="${n1(cx)}" cy="${n1(hip[1] - side * 0.16)}" rx="${n1(side * 0.09)}" ry="${n1(side * 0.2)}" fill="${ground}" stroke="${ink}" stroke-width="2.5"/>`;
  out += `<circle cx="${n1(cx)}" cy="${n1(top + side * 0.075)}" r="${n1(side * 0.062)}" fill="${ground}" stroke="${ink}" stroke-width="2.5"/>`;
  // mirror-writing scribbles
  for (const y0 of [b.y + 10, b.y + 22, bottom + 16, bottom + 28]) {
    if (y0 > b.y + b.h - 4) continue;
    let d = "";
    let x = b.x + 10;
    while (x < b.x + b.w - 14) {
      const w = range(rng, 8, 22);
      d += `M${n1(x)} ${n1(y0)} q${n1(w * 0.25)} -4 ${n1(w * 0.5)} 0 t${n1(w * 0.5)} 0 `;
      x += w + range(rng, 4, 8);
    }
    out += line(d, ink, 1);
  }
  return { svg: out, vec: [(raise - 0.35) / 0.15] };
}

function pearl(rng: Rng, b: Box, ink: string, ground: string) {
  const cx = b.x + b.w * range(rng, 0.46, 0.54);
  const cy = b.y + b.h * 0.42;
  const s = Math.min(b.w, b.h) * 0.3;
  let out = `<rect x="${n1(b.x)}" y="${n1(b.y)}" width="${n1(b.w)}" height="${n1(b.h)}" fill="${ink}"/>`;
  // shoulder + collar
  out += `<path d="M${n1(cx - s * 1.9)} ${n1(b.y + b.h + 4)} Q${n1(cx - s * 1.5)} ${n1(cy + s * 1.2)} ${n1(cx - s * 0.2)} ${n1(cy + s * 1.05)} Q${n1(cx + s * 1.3)} ${n1(cy + s * 1.1)} ${n1(cx + s * 1.6)} ${n1(b.y + b.h + 4)} Z" fill="${ground}"/>`;
  out += `<path d="M${n1(cx - s * 0.5)} ${n1(cy + s * 1.05)} Q${n1(cx + s * 0.1)} ${n1(cy + s * 1.5)} ${n1(cx + s * 0.9)} ${n1(cy + s * 1.1)}" fill="none" stroke="${ink}" stroke-width="2.5"/>`;
  for (let i = 0; i < 4; i++) out += line(`M${n1(cx - s * 1.2 + i * s * 0.6)} ${n1(b.y + b.h)} q${n1(s * 0.2)} ${n1(-s * 0.4)} ${n1(s * 0.1)} ${n1(-s * 0.7)}`, ink, 1.6);
  // neck + face (three-quarter view, looking over the shoulder)
  out += `<path d="M${n1(cx - s * 0.35)} ${n1(cy + s * 0.5)} L${n1(cx - s * 0.4)} ${n1(cy + s * 1.1)} L${n1(cx + s * 0.35)} ${n1(cy + s * 1.1)} L${n1(cx + s * 0.3)} ${n1(cy + s * 0.5)} Z" fill="${ground}"/>`;
  out += `<path d="M${n1(cx - s * 0.1)} ${n1(cy - s * 0.95)} C${n1(cx + s * 0.9)} ${n1(cy - s * 0.95)} ${n1(cx + s * 0.85)} ${n1(cy + s * 0.55)} ${n1(cx + s * 0.05)} ${n1(cy + s * 0.78)} C${n1(cx - s * 0.6)} ${n1(cy + s * 0.7)} ${n1(cx - s * 0.75)} ${n1(cy - s * 0.3)} ${n1(cx - s * 0.1)} ${n1(cy - s * 0.95)} Z" fill="${ground}"/>`;
  out += `<ellipse cx="${n1(cx - s * 0.02)}" cy="${n1(cy - s * 0.12)}" rx="${n1(s * 0.12)}" ry="${n1(s * 0.08)}" fill="${ink}"/><ellipse cx="${n1(cx + s * 0.5)}" cy="${n1(cy - s * 0.12)}" rx="${n1(s * 0.1)}" ry="${n1(s * 0.07)}" fill="${ink}"/>`;
  out += line(`M${n1(cx + s * 0.26)} ${n1(cy - s * 0.05)} L${n1(cx + s * 0.3)} ${n1(cy + s * 0.25)} L${n1(cx + s * 0.2)} ${n1(cy + s * 0.28)}`, ink, 1.8);
  out += `<ellipse cx="${n1(cx + s * 0.22)}" cy="${n1(cy + s * 0.48)}" rx="${n1(s * 0.13)}" ry="${n1(s * 0.06)}" fill="${ink}"/>`;
  // turban: band + top + falling cloth
  out += `<path d="M${n1(cx - s * 0.7)} ${n1(cy - s * 0.35)} Q${n1(cx - s * 0.2)} ${n1(cy - s * 0.8)} ${n1(cx + s * 0.75)} ${n1(cy - s * 0.55)} L${n1(cx + s * 0.7)} ${n1(cy - s * 0.95)} Q${n1(cx)} ${n1(cy - s * 1.35)} ${n1(cx - s * 0.75)} ${n1(cy - s * 0.85)} Z" fill="${ground}" stroke="${ink}" stroke-width="2"/>`;
  out += `<path d="M${n1(cx - s * 0.1)} ${n1(cy - s * 1.2)} Q${n1(cx + s * 0.1)} ${n1(cy - s * 1.9)} ${n1(cx + s * 0.55)} ${n1(cy - s * 1.25)} Q${n1(cx + s * 0.8)} ${n1(cy - s * 1.0)} ${n1(cx + s * 0.6)} ${n1(cy - s * 0.95)} Z" fill="url(#l1)" stroke="${ground}" stroke-width="2"/>`;
  out += `<path d="M${n1(cx - s * 0.7)} ${n1(cy - s * 0.6)} Q${n1(cx - s * 1.2)} ${n1(cy)} ${n1(cx - s * 0.95)} ${n1(cy + s * 0.9)} L${n1(cx - s * 0.65)} ${n1(cy + s * 0.9)} Q${n1(cx - s * 0.8)} ${n1(cy)} ${n1(cx - s * 0.45)} ${n1(cy - s * 0.45)} Z" fill="${ground}" stroke="${ink}" stroke-width="1.5"/>`;
  for (let i = 0; i < 3; i++) out += line(`M${n1(cx - s * 0.55 + i * s * 0.35)} ${n1(cy - s * (0.55 + i * 0.08))} Q${n1(cx - s * 0.4 + i * s * 0.35)} ${n1(cy - s * 0.95)} ${n1(cx - s * 0.2 + i * s * 0.35)} ${n1(cy - s * 1.1)}`, ink, 1.3);
  // the pearl
  const px = cx - s * 0.52;
  const py = cy + s * 0.42;
  out += `<circle cx="${n1(px)}" cy="${n1(py)}" r="${n1(s * 0.13)}" fill="${ground}" stroke="${ink}" stroke-width="1.5"/><circle cx="${n1(px - s * 0.04)}" cy="${n1(py - s * 0.04)}" r="${n1(s * 0.035)}" fill="${ink}"/>`;
  return { svg: out, vec: [0] };
}

function mona(rng: Rng, b: Box, ink: string, ground: string) {
  const cx = b.x + b.w / 2;
  const s = Math.min(b.w, b.h) * 0.24;
  const cy = b.y + b.h * 0.33;
  let out = "";
  // landscape
  const hz = b.y + b.h * 0.42;
  out += `<path d="M${n1(b.x)} ${n1(hz)} Q${n1(b.x + b.w * 0.2)} ${n1(hz - 24)} ${n1(b.x + b.w * 0.35)} ${n1(hz - 6)} L${n1(b.x + b.w * 0.35)} ${n1(b.y + b.h)} L${n1(b.x)} ${n1(b.y + b.h)} Z M${n1(b.x + b.w)} ${n1(hz - 14)} Q${n1(b.x + b.w * 0.8)} ${n1(hz - 34)} ${n1(b.x + b.w * 0.65)} ${n1(hz - 4)} L${n1(b.x + b.w * 0.65)} ${n1(b.y + b.h)} L${n1(b.x + b.w)} ${n1(b.y + b.h)} Z" fill="url(#l1)" stroke="${ink}" stroke-width="1.5"/>`;
  out += line(`M${n1(b.x + 8)} ${n1(hz + 30)} Q${n1(b.x + b.w * 0.2)} ${n1(hz + 10)} ${n1(b.x + 20)} ${n1(hz + 5)} M${n1(b.x + b.w - 10)} ${n1(hz + 20)} Q${n1(b.x + b.w * 0.82)} ${n1(hz + 12)} ${n1(b.x + b.w - 30)} ${n1(hz)}`, ink, 1.5);
  // robe & hair frame
  out += `<path d="M${n1(cx - s * 2.1)} ${n1(b.y + b.h + 4)} Q${n1(cx - s * 1.9)} ${n1(cy + s * 1.6)} ${n1(cx - s * 0.9)} ${n1(cy + s * 1.35)} L${n1(cx + s * 0.9)} ${n1(cy + s * 1.35)} Q${n1(cx + s * 1.9)} ${n1(cy + s * 1.6)} ${n1(cx + s * 2.1)} ${n1(b.y + b.h + 4)} Z" fill="${ink}"/>`;
  out += `<path d="M${n1(cx - s * 0.6)} ${n1(cy + s * 1.35)} Q${n1(cx)} ${n1(cy + s * 2.0)} ${n1(cx + s * 0.6)} ${n1(cy + s * 1.35)} Z" fill="${ground}"/>`;
  for (let i = 0; i < 5; i++) out += line(`M${n1(cx - s * 1.3 + i * s * 0.65)} ${n1(b.y + b.h)} q${n1(s * 0.1)} ${n1(-s * 0.5)} 0 ${n1(-s * 0.9)}`, ground, 1.3);
  out += `<path d="M${n1(cx - s * 0.95)} ${n1(cy + s * 1.4)} Q${n1(cx - s * 1.1)} ${n1(cy - s * 1.2)} ${n1(cx)} ${n1(cy - s * 1.15)} Q${n1(cx + s * 1.1)} ${n1(cy - s * 1.2)} ${n1(cx + s * 0.95)} ${n1(cy + s * 1.4)} L${n1(cx + s * 0.6)} ${n1(cy + s * 1.4)} Q${n1(cx + s * 0.75)} ${n1(cy)} ${n1(cx)} ${n1(cy - s * 0.85)} Q${n1(cx - s * 0.75)} ${n1(cy)} ${n1(cx - s * 0.6)} ${n1(cy + s * 1.4)} Z" fill="${ink}"/>`;
  // face
  out += `<ellipse cx="${n1(cx)}" cy="${n1(cy + s * 0.1)}" rx="${n1(s * 0.6)}" ry="${n1(s * 0.82)}" fill="${ground}" stroke="${ink}" stroke-width="2"/>`;
  for (const d of [-1, 1]) {
    out += `<ellipse cx="${n1(cx + d * s * 0.26)}" cy="${n1(cy - s * 0.02)}" rx="${n1(s * 0.1)}" ry="${n1(s * 0.05)}" fill="${ink}"/>`;
    out += line(`M${n1(cx + d * s * 0.4)} ${n1(cy - s * 0.12)} Q${n1(cx + d * s * 0.26)} ${n1(cy - s * 0.18)} ${n1(cx + d * s * 0.12)} ${n1(cy - s * 0.12)}`, ink, 1.2);
  }
  out += line(`M${n1(cx)} ${n1(cy)} L${n1(cx + s * 0.05)} ${n1(cy + s * 0.28)} L${n1(cx - s * 0.06)} ${n1(cy + s * 0.3)}`, ink, 1.5);
  out += line(`M${n1(cx - s * 0.2)} ${n1(cy + s * 0.46)} Q${n1(cx)} ${n1(cy + s * 0.53)} ${n1(cx + s * 0.2)} ${n1(cy + s * 0.44)}`, ink, 1.8);
  // folded hands
  const hy = b.y + b.h - s * 0.55;
  out += `<ellipse cx="${n1(cx - s * 0.25)}" cy="${n1(hy)}" rx="${n1(s * 0.55)}" ry="${n1(s * 0.22)}" fill="${ground}" stroke="${ink}" stroke-width="2"/><ellipse cx="${n1(cx + s * 0.3)}" cy="${n1(hy + s * 0.1)}" rx="${n1(s * 0.5)}" ry="${n1(s * 0.2)}" transform="rotate(-8 ${n1(cx + s * 0.3)} ${n1(hy + s * 0.1)})" fill="${ground}" stroke="${ink}" stroke-width="2"/>`;
  return { svg: out, vec: [0] };
}

export const masterpiece: Generator = (rng, ink, ground) => {
  const which = pick(rng, ["scream", "vitruvian", "pearl", "mona"] as const);
  const h = hang(rng, which, ink, ground);
  const b = h.box;
  const r = which === "scream" ? scream(rng, b, ink, ground) : which === "vitruvian" ? vitruvian(rng, b, ink, ground) : which === "pearl" ? pearl(rng, b, ink, ground) : mona(rng, b, ink, ground);
  const body = toneDefs(ink) + clip("mp", b, r.svg) + h.svg;
  const funny = /Monday|Wi-Fi|Group|Approx|Stretch|Arms|Unimpressed|Knows|Selfie|Just One|Looking/.test(h.title);
  return {
    body,
    variant: `art-${which}`,
    sig: { key: `${which}-${h.style}`, vec: r.vec },
    description: `“${h.title}” — a single-ink homage to ${h.credit.artist} (${h.credit.year}, public domain).`,
    complexity: 0.7,
    features: {
      ...artFeatures(rng), figurative: range(rng, 0.65, 0.85), line_art: which === "vitruvian" ? range(rng, 0.75, 0.9) : range(rng, 0.45, 0.6), density: which === "pearl" ? range(rng, 0.6, 0.75) : range(rng, 0.45, 0.62),
      wit: funny ? range(rng, 0.5, 0.65) : range(rng, 0.1, 0.22), geometric: which === "vitruvian" ? range(rng, 0.5, 0.65) : 0.12, nature: which === "scream" ? 0.3 : 0.1, abstract: which === "scream" ? 0.35 : 0.1,
      halftone_raster: range(rng, 0.15, 0.28), dark_industrial: which === "pearl" ? range(rng, 0.55, 0.7) : range(rng, 0.25, 0.4), clean_minimal: range(rng, 0.25, 0.42),
    },
  };
};
