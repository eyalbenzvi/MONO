/**
 * Caricatures: a procedural face engine with exaggerated features (head
 * shape, nose, eyes, hair, hats, facial hair, props) drawn as bold single-
 * ink line art. Every face is an original archetype (“The Barista”), never
 * a real person. Four formats: portrait, WANTED poster, mugshot, bobblehead.
 */
import { IH, IW, W, X0, Y0, int, n1, pick, pts, range, smooth, type Generator, type Rng } from "../core";
import { MONO, OBJECTS, SERIF, drawPrims, fitLines, textEl, toneDefs, wrap } from "../art";
import { ARCHETYPES, BOBBLE_TAGLINES, WANTED_CRIMES, WANTED_REWARDS, type Archetype } from "../copy3";

const CX = W / 2;

interface FaceParams {
  hw: number; // head half-width
  hh: number; // head half-height
  jaw: number; // lower-face width relative to the top
  eyeS: number;
  noseS: number;
  mouthS: number;
  earS: number;
}

function faceParams(rng: Rng): FaceParams {
  return {
    hw: range(rng, 50, 66),
    hh: range(rng, 62, 78),
    jaw: range(rng, 0.72, 1.28),
    eyeS: range(rng, 0.8, 1.5),
    noseS: range(rng, 1, 1.75),
    mouthS: range(rng, 0.8, 1.35),
    earS: range(rng, 0.8, 1.5),
  };
}

/** Vertical extent of a drawn figure (local units), for fitting it to a box. */
function extent(a: Archetype, p: FaceParams, withBody: boolean) {
  const top =
    a.hat === "toque" ? 2.05 : a.hair === "pompadour" ? 1.85 : a.hair === "mohawk" ? 1.7 : a.hair === "bun" ? 1.5 : a.hat === "beanie" ? 1.45 : a.hair === "spiky" ? 1.45 : 1.3;
  return { top: -p.hh * top, bottom: withBody ? p.hh * 2.15 : p.hh * 1.1 };
}

/**
 * Draws the figure centred on the head at (0,0) in local units. Strokes are
 * in local units too (the caller scales the group). `flip` mirrors it.
 */
function figure(a: Archetype, p: FaceParams, ink: string, ground: string, opts: { body: boolean; sw: number; neckSpring?: boolean }) {
  const { hw, hh, jaw, eyeS, noseS, mouthS, earS } = p;
  const sw = opts.sw;
  const S = (d: string, fill: string, w = sw) => `<path d="${d}" fill="${fill}" stroke="${ink}" stroke-width="${n1(w)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const Ln = (d: string, w = sw, col = ink) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${n1(w)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const C = (cx: number, cy: number, r: number, fill: string, w = sw) => `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="${fill}" stroke="${ink}" stroke-width="${n1(w)}"/>`;
  const hp = (t: number, k = 1): [number, number] => {
    const lower = Math.sin(t) > 0;
    return [k * hw * Math.cos(t) * (lower ? jaw : 1), k * hh * Math.sin(t) * (lower ? 1.04 : 1)];
  };
  const arc = (from: number, to: number, k = 1, steps = 18) => Array.from({ length: steps + 1 }, (_, i) => hp(from + ((to - from) * i) / steps, k));
  const headD = smooth(arc(0, Math.PI * 2, 1, 24).slice(0, 24), true);

  let back = "";
  let out = "";

  /* body */
  if (opts.body) {
    const bw = a.body === "buff" ? hw * 2.25 : hw * 1.05;
    const top = hh * 1.1;
    if (opts.neckSpring) {
      let d = `M0 ${n1(hh * 0.85)}`;
      for (let i = 1; i <= 8; i++) d += ` L${i % 2 ? -hw * 0.18 : hw * 0.18} ${n1(hh * 0.85 + i * hh * 0.07)}`;
      back += Ln(d, sw * 0.9);
    } else back += S(`M${n1(-hw * 0.26)} ${n1(hh * 0.6)} V${n1(top + 6)} H${n1(hw * 0.26)} V${n1(hh * 0.6)} Z`, ground);
    const shoulders = `M${n1(-bw)} ${n1(hh * 2.3)} L${n1(-bw)} ${n1(top + hh * 0.45)} Q${n1(-bw)} ${n1(top)} ${n1(-bw * 0.5)} ${n1(top - 2)} L${n1(bw * 0.5)} ${n1(top - 2)} Q${n1(bw)} ${n1(top)} ${n1(bw)} ${n1(top + hh * 0.45)} L${n1(bw)} ${n1(hh * 2.3)} Z`;
    back += S(shoulders, ground);
    if (a.body === "buff") back += Ln(`M${n1(-bw * 0.55)} ${n1(top + hh * 0.5)} Q${n1(-bw * 0.3)} ${n1(top + hh * 0.75)} 0 ${n1(top + hh * 0.5)} Q${n1(bw * 0.3)} ${n1(top + hh * 0.75)} ${n1(bw * 0.55)} ${n1(top + hh * 0.5)}`, sw * 0.8);
    back += Ln(`M${n1(-hw * 0.3)} ${n1(top - 1)} L0 ${n1(top + hh * 0.35)} L${n1(hw * 0.3)} ${n1(top - 1)}`, sw * 0.8);
    if (a.extras?.includes("tie")) back += S(`M${n1(-hw * 0.1)} ${n1(top + hh * 0.18)} L${n1(hw * 0.1)} ${n1(top + hh * 0.18)} L${n1(hw * 0.16)} ${n1(top + hh * 0.95)} L0 ${n1(top + hh * 1.1)} L${n1(-hw * 0.16)} ${n1(top + hh * 0.95)} Z`, ink, sw * 0.6);
    if (a.extras?.includes("bowtie"))
      back += S(`M0 ${n1(top + 4)} L${n1(-hw * 0.34)} ${n1(top - 8)} L${n1(-hw * 0.34)} ${n1(top + 16)} Z M0 ${n1(top + 4)} L${n1(hw * 0.34)} ${n1(top - 8)} L${n1(hw * 0.34)} ${n1(top + 16)} Z`, ink, sw * 0.6);
  }

  /* hair & hats that sit behind the head */
  if (a.hair === "bun") back += C(0, -hh * 1.12, hh * 0.34, ink);
  if (a.hair === "curly")
    for (let i = 0; i <= 12; i++) {
      const [x, y] = hp(Math.PI * 0.92 + (i / 12) * Math.PI * 1.16, 1.08);
      back += C(x, y, hw * 0.24, ink, sw * 0.6);
    }
  if (a.hair === "pompadour") back += S(`M${n1(-hw * 0.95)} ${n1(-hh * 0.35)} C${n1(-hw * 1.15)} ${n1(-hh * 1.7)} ${n1(hw * 0.7)} ${n1(-hh * 2.0)} ${n1(hw * 1.08)} ${n1(-hh * 1.05)} Q${n1(hw * 0.6)} ${n1(-hh * 1.2)} ${n1(hw * 0.95)} ${n1(-hh * 0.35)} Z`, ink);
  if (a.hat === "toque") {
    for (const [x, y, r] of [[-0.55, -1.45, 0.42], [0, -1.65, 0.5], [0.55, -1.45, 0.42], [-0.3, -1.25, 0.4], [0.3, -1.25, 0.4]])
      back += C(hw * x, hh * y, hw * r, ground);
  }

  /* ears */
  for (const s of [-1, 1]) {
    const ex = s * hw * 0.98;
    back += C(ex, hh * 0.04, 11 * earS, ground);
    back += Ln(`M${n1(ex - s * 3 * earS)} ${n1(hh * 0.04 - 5 * earS)} Q${n1(ex + s * 4 * earS)} ${n1(hh * 0.04)} ${n1(ex - s * 2 * earS)} ${n1(hh * 0.04 + 5 * earS)}`, sw * 0.6);
  }

  /* head */
  out += S(headD, ground);
  if (a.facial === "stubble") out += `<path d="${smooth(arc(Math.PI * 0.08, Math.PI * 0.92, 0.95))} L${n1(-hw * 0.5)} ${n1(hh * 0.25)} L${n1(hw * 0.5)} ${n1(hh * 0.25)} Z" fill="url(#t1)"/>`;
  if (a.extras?.includes("cheeks")) for (const s of [-1, 1]) out += `<circle cx="${n1(s * hw * 0.55)}" cy="${n1(hh * 0.3)}" r="${n1(hw * 0.17)}" fill="url(#t2)"/>`;

  const ey = -hh * 0.08;
  const ex = hw * 0.38;
  const er = hw * 0.14 * eyeS;
  const ny = hh * 0.1;
  const ns = hw * 0.22 * noseS;
  const noseBottom = a.nose === "button" ? ny + ns * 0.6 : ny + ns * 1.05;
  const my = Math.max(hh * 0.52, noseBottom + 10);
  const mw = hw * 0.42 * mouthS;

  /* beard sits under everything else on the face */
  if (a.facial === "beard") {
    const outer = arc(-0.05, Math.PI + 0.05, 1.07, 16).map(([x, y]) => [x, y > 0 ? y * 1.35 : y] as [number, number]);
    out += `<path d="${smooth(outer)} L${n1(-hw * 0.5)} ${n1(hh * 0.28)} Q0 ${n1(hh * 0.16)} ${n1(hw * 0.5)} ${n1(hh * 0.28)} Z" fill="${ink}" stroke="${ink}" stroke-width="${n1(sw)}" stroke-linejoin="round"/>`;
  }

  /* hair on top of the head */
  const capTop = (k: number, fringe: string) => `M${pts([hp(Math.PI - 0.25, k)])} ${smooth(arc(Math.PI - 0.25, Math.PI * 2 + 0.25, k)).slice(1)} ${fringe} Z`;
  if (a.hair === "slick" || a.hair === "bun" || a.hair === "pompadour")
    out += S(capTop(1.05, `L${n1(hw * 0.9)} ${n1(-hh * 0.18)} Q${n1(hw * 0.2)} ${n1(-hh * 0.28)} ${n1(-hw * 0.3)} ${n1(-hh * 0.58)} Q${n1(-hw * 0.7)} ${n1(-hh * 0.35)} ${n1(-hw * 0.95)} ${n1(-hh * 0.12)}`), ink);
  if (a.hair === "slick") out += Ln(`M${n1(-hw * 0.3)} ${n1(-hh * 1.02)} Q${n1(-hw * 0.36)} ${n1(-hh * 0.8)} ${n1(-hw * 0.3)} ${n1(-hh * 0.6)}`, sw * 0.7, ground);
  if (a.hair === "messy" || a.hair === "spiky") {
    const spiky = a.hair === "spiky";
    const n = spiky ? 9 : 14;
    const crown = Array.from({ length: n * 2 + 1 }, (_, i) => hp(Math.PI - 0.2 + (i / (n * 2)) * (Math.PI + 0.4), i % 2 ? (spiky ? 1.45 : 1.12 + (i % 4) * 0.05) : 1.02));
    let fringe = "";
    for (let i = 0; i <= 8; i++) fringe += ` L${n1(hw * (0.95 - (i / 8) * 1.9))} ${n1(-hh * (i % 2 ? 0.4 : 0.55))}`;
    out += S(`M${pts(crown).replace(/ /g, " L")}${fringe} Z`, ink);
    if (!spiky)
      for (let i = 0; i < 5; i++) {
        const [x, y] = hp(Math.PI * 1.15 + i * 0.18, 1.05);
        out += Ln(`M${n1(x)} ${n1(y)} q${n1((i - 2) * 6)} ${n1(-14)} ${n1((i - 2) * 11)} ${n1(-18)}`, sw * 0.7);
      }
  }
  if (a.hair === "curly") for (let i = 0; i < 6; i++) out += C(-hw * 0.6 + i * hw * 0.24, -hh * 0.72 + (i % 2) * 6, hw * 0.16, ink, sw * 0.5);
  if (a.hair === "mohawk") {
    let d = `M${n1(-hw * 0.16)} ${n1(-hh * 0.9)}`;
    for (let i = 0; i <= 6; i++) {
      const t = Math.PI * 1.22 + (i / 6) * Math.PI * 0.56;
      const [x, y] = hp(t, 1.62 - Math.abs(i - 3) * 0.06);
      const [bx, by] = hp(t + 0.05, 0.98);
      d += ` L${n1(x * 0.8)} ${n1(y)} L${n1(bx * 0.8)} ${n1(by)}`;
    }
    out += S(d + " Z", ink);
  }
  if (a.hair === "ring") {
    for (const s of [-1, 1]) out += S(`M${n1(s * hw * 0.98)} ${n1(-hh * 0.55)} Q${n1(s * hw * 1.3)} ${n1(-hh * 0.2)} ${n1(s * hw * 1.05)} ${n1(hh * 0.02)} Q${n1(s * hw * 0.88)} ${n1(-hh * 0.25)} ${n1(s * hw * 0.98)} ${n1(-hh * 0.55)} Z`, ink);
  }
  if (a.hair === "ring" || a.hair === "bald") out += Ln(`M${n1(-hw * 0.45)} ${n1(-hh * 0.72)} Q${n1(-hw * 0.3)} ${n1(-hh * 0.88)} ${n1(-hw * 0.05)} ${n1(-hh * 0.9)}`, sw * 0.6);

  /* hats */
  if (a.hat === "cap") {
    out += S(capTop(1.08, `L${n1(hw * 1.05)} ${n1(-hh * 0.32)} L${n1(-hw * 1.05)} ${n1(-hh * 0.32)}`), ink);
    out += S(`M${n1(hw * 0.5)} ${n1(-hh * 0.38)} Q${n1(hw * 1.9)} ${n1(-hh * 0.48)} ${n1(hw * 1.85)} ${n1(-hh * 0.24)} L${n1(hw * 0.6)} ${n1(-hh * 0.22)} Z`, ink);
    out += Ln(`M0 ${n1(-hh * 1.06)} Q${n1(-hw * 0.15)} ${n1(-hh * 0.7)} 0 ${n1(-hh * 0.36)}`, sw * 0.6, ground);
  }
  if (a.hat === "beanie") {
    out += S(capTop(1.1, `L${n1(hw * 1.1)} ${n1(-hh * 0.3)} L${n1(-hw * 1.1)} ${n1(-hh * 0.3)}`), ink);
    for (let i = -3; i <= 3; i++) out += Ln(`M${n1(i * hw * 0.26)} ${n1(-hh * 0.34)} V${n1(-hh * (1.0 - Math.abs(i) * 0.1))}`, sw * 0.5, ground);
    out += S(`M${n1(-hw * 1.12)} ${n1(-hh * 0.5)} H${n1(hw * 1.12)} V${n1(-hh * 0.22)} H${n1(-hw * 1.12)} Z`, ink);
    out += C(0, -hh * 1.22, hh * 0.18, "url(#t4)");
  }
  if (a.hat === "beret") {
    out += `<ellipse cx="${n1(hw * 0.12)}" cy="${n1(-hh * 0.84)}" rx="${n1(hw * 1.1)}" ry="${n1(hh * 0.3)}" transform="rotate(-9 ${n1(hw * 0.12)} ${n1(-hh * 0.84)})" fill="${ink}" stroke="${ink}" stroke-width="${n1(sw)}"/>`;
    out += Ln(`M${n1(hw * 0.2)} ${n1(-hh * 1.1)} l3 -9`, sw * 1.2);
  }
  if (a.hat === "toque") {
    out += S(`M${n1(-hw * 0.82)} ${n1(-hh * 0.95)} H${n1(hw * 0.82)} V${n1(-hh * 0.5)} Q0 ${n1(-hh * 0.42)} ${n1(-hw * 0.82)} ${n1(-hh * 0.5)} Z`, ground);
    for (const x of [-0.4, 0, 0.4]) out += Ln(`M${n1(hw * x)} ${n1(-hh * 0.92)} V${n1(-hh * 0.55)}`, sw * 0.5);
  }
  if (a.hat === "headphones" || a.hat === "headset") {
    out += Ln(`M${n1(-hw * 1.02)} ${n1(-hh * 0.05)} Q0 ${n1(-hh * 2.0)} ${n1(hw * 1.02)} ${n1(-hh * 0.05)}`, sw * 2.6);
    for (const s of [-1, 1]) out += S(`M${n1(s * hw * 0.86)} ${n1(-hh * 0.3)} h${n1(s * hw * 0.36)} v${n1(hh * 0.62)} h${n1(-s * hw * 0.36)} Z`, ink);
    if (a.hat === "headset") {
      out += Ln(`M${n1(-hw * 1.0)} ${n1(hh * 0.25)} Q${n1(-hw * 0.95)} ${n1(my + 6)} ${n1(-mw * 0.9)} ${n1(my + 4)}`, sw);
      out += `<circle cx="${n1(-mw * 0.85)}" cy="${n1(my + 4)}" r="${n1(sw * 1.3)}" fill="${ink}"/>`;
    }
  }

  /* brows */
  const by = ey - er * (a.eyes === "glasses" || a.eyes === "sunglasses" ? 2.5 : 2);
  for (const s of [-1, 1]) {
    const x0 = s * (ex - er * 1.2);
    const x1 = s * (ex + er * 1.2);
    if (a.brows === "arch") out += Ln(`M${n1(x0)} ${n1(by + 2)} Q${n1(s * ex)} ${n1(by - er * 0.9)} ${n1(x1)} ${n1(by + 2)}`, sw * 1.1);
    if (a.brows === "flat") out += Ln(`M${n1(x0)} ${n1(by)} L${n1(x1)} ${n1(by)}`, sw * 1.1);
    if (a.brows === "angry") out += Ln(`M${n1(x0)} ${n1(by + er * 0.6)} L${n1(x1)} ${n1(by - er * 0.4)}`, sw * 1.3);
    if (a.brows === "worried") out += Ln(`M${n1(x0)} ${n1(by - er * 0.5)} L${n1(x1)} ${n1(by + er * 0.4)}`, sw * 1.1);
    if (a.brows === "bushy") out += S(`M${n1(x0)} ${n1(by + 3)} Q${n1(s * ex)} ${n1(by - er * 1.4)} ${n1(x1 + s * 4)} ${n1(by)} Q${n1(s * ex)} ${n1(by - er * 0.2)} ${n1(x0)} ${n1(by + 3)} Z`, ink, sw * 0.8);
  }

  /* eyes */
  for (const s of [-1, 1]) {
    const x = s * ex;
    switch (a.eyes) {
      case "dots":
      case "side":
        out += `<ellipse cx="${n1(x)}" cy="${n1(ey)}" rx="${n1(er)}" ry="${n1(er * 1.15)}" fill="${ground}" stroke="${ink}" stroke-width="${n1(sw * 0.8)}"/>`;
        out += `<circle cx="${n1(x + (a.eyes === "side" ? er * 0.45 : -s * er * 0.15))}" cy="${n1(ey + er * 0.1)}" r="${n1(er * 0.5)}" fill="${ink}"/>`;
        break;
      case "wide":
        out += C(x, ey, er * 1.35, ground, sw * 0.8);
        out += `<circle cx="${n1(x)}" cy="${n1(ey)}" r="${n1(er * 0.3)}" fill="${ink}"/>`;
        break;
      case "tired":
        out += `<ellipse cx="${n1(x)}" cy="${n1(ey)}" rx="${n1(er)}" ry="${n1(er * 0.9)}" fill="${ground}" stroke="${ink}" stroke-width="${n1(sw * 0.8)}"/>`;
        out += `<circle cx="${n1(x)}" cy="${n1(ey + er * 0.3)}" r="${n1(er * 0.45)}" fill="${ink}"/>`;
        out += S(`M${n1(x - er * 1.1)} ${n1(ey)} Q${n1(x)} ${n1(ey - er * 1.4)} ${n1(x + er * 1.1)} ${n1(ey)} Z`, ground, sw * 0.8);
        out += Ln(`M${n1(x - er)} ${n1(ey + er * 1.3)} Q${n1(x)} ${n1(ey + er * 2)} ${n1(x + er)} ${n1(ey + er * 1.3)} M${n1(x - er * 0.8)} ${n1(ey + er * 1.8)} Q${n1(x)} ${n1(ey + er * 2.4)} ${n1(x + er * 0.8)} ${n1(ey + er * 1.8)}`, sw * 0.5);
        break;
      case "sunglasses":
        out += S(`M${n1(x - er * 1.7)} ${n1(ey - er * 1.1)} H${n1(x + er * 1.7)} V${n1(ey + er * 0.3)} Q${n1(x + er * 1.5)} ${n1(ey + er * 1.5)} ${n1(x)} ${n1(ey + er * 1.4)} Q${n1(x - er * 1.5)} ${n1(ey + er * 1.5)} ${n1(x - er * 1.7)} ${n1(ey + er * 0.3)} Z`, ink, sw * 0.8);
        out += Ln(`M${n1(x - er)} ${n1(ey - er * 0.4)} l${n1(er * 0.6)} ${n1(-er * 0.4)}`, sw * 0.5, ground);
        break;
      case "glasses":
        out += C(x, ey, er * 1.55, "none", sw * 0.8);
        out += `<circle cx="${n1(x - s * er * 0.1)}" cy="${n1(ey)}" r="${n1(er * 0.4)}" fill="${ink}"/>`;
        break;
      case "spiral": {
        const sp: [number, number][] = [];
        for (let t = 0; t < Math.PI * 5; t += 0.4) sp.push([x + Math.cos(t * s) * (t / (Math.PI * 5)) * er * 1.4, ey + Math.sin(t * s) * (t / (Math.PI * 5)) * er * 1.4]);
        out += C(x, ey, er * 1.5, ground, sw * 0.8) + Ln(smooth(sp), sw * 0.55);
        break;
      }
      case "closed":
        out += Ln(`M${n1(x - er)} ${n1(ey)} Q${n1(x)} ${n1(ey - er * 1.1)} ${n1(x + er)} ${n1(ey)}`, sw);
        break;
    }
  }
  if (a.eyes === "sunglasses" || a.eyes === "glasses") out += Ln(`M${n1(-ex + er * 1.5)} ${n1(ey - er * 0.4)} Q0 ${n1(ey - er)} ${n1(ex - er * 1.5)} ${n1(ey - er * 0.4)}`, sw * 0.8);

  /* nose */
  switch (a.nose) {
    case "bulb":
      out += Ln(`M${n1(-ns * 0.15)} ${n1(ey + er * 0.5)} Q${n1(-ns * 0.45)} ${n1(ny)} ${n1(-ns * 0.3)} ${n1(ny + ns * 0.2)}`, sw * 0.8);
      out += C(0, ny + ns * 0.45, ns * 0.62, ground);
      break;
    case "hook":
      out += S(`M${n1(-ns * 0.2)} ${n1(ey + er * 0.4)} Q${n1(ns * 1.6)} ${n1(ny + ns * 0.2)} ${n1(ns * 0.45)} ${n1(ny + ns * 1.0)} Q0 ${n1(ny + ns * 1.1)} ${n1(-ns * 0.45)} ${n1(ny + ns * 0.72)}`, ground);
      break;
    case "ski":
      out += S(`M0 ${n1(ey + er * 0.4)} Q${n1(ns * 0.15)} ${n1(ny + ns * 0.3)} ${n1(ns * 1.1)} ${n1(ny + ns * 0.45)} Q${n1(ns * 0.7)} ${n1(ny + ns * 1.05)} ${n1(-ns * 0.35)} ${n1(ny + ns * 0.82)}`, ground);
      break;
    case "long":
      out += S(`M${n1(-ns * 0.25)} ${n1(ny - ns * 0.5)} L${n1(ns * 2.3)} ${n1(ny + ns * 0.62)} Q${n1(ns * 1.2)} ${n1(ny + ns * 1.02)} ${n1(-ns * 0.4)} ${n1(ny + ns * 0.9)}`, ground);
      break;
    case "button":
      out += C(0, ny + ns * 0.3, ns * 0.36, ground, sw * 0.8);
      break;
  }

  /* mouth */
  const mouthInk = a.facial === "beard" ? ground : ink;
  switch (a.mouth) {
    case "grin":
      out += `<path d="M${n1(-mw)} ${n1(my)} Q0 ${n1(my + mw * 1.15)} ${n1(mw)} ${n1(my)} Z" fill="${mouthInk}" stroke="${mouthInk}" stroke-width="${n1(sw * 0.8)}" stroke-linejoin="round"/>`;
      out += `<path d="M${n1(-mw * 0.78)} ${n1(my + 1.5)} L${n1(mw * 0.78)} ${n1(my + 1.5)} L${n1(mw * 0.6)} ${n1(my + mw * 0.26)} L${n1(-mw * 0.6)} ${n1(my + mw * 0.26)} Z" fill="${a.facial === "beard" ? ink : ground}"/>`;
      break;
    case "smile":
      out += Ln(`M${n1(-mw)} ${n1(my)} Q0 ${n1(my + mw * 0.75)} ${n1(mw)} ${n1(my)}`, sw, mouthInk);
      break;
    case "smirk":
      out += Ln(`M${n1(-mw * 0.7)} ${n1(my + mw * 0.12)} Q${n1(mw * 0.2)} ${n1(my + mw * 0.3)} ${n1(mw)} ${n1(my - mw * 0.22)}`, sw, mouthInk);
      break;
    case "flat":
      out += Ln(`M${n1(-mw * 0.55)} ${n1(my + 2)} L${n1(mw * 0.55)} ${n1(my)}`, sw, mouthInk);
      break;
    case "open":
      out += `<ellipse cx="0" cy="${n1(my + mw * 0.3)}" rx="${n1(mw * 0.45)}" ry="${n1(mw * 0.55)}" fill="${mouthInk}"/>`;
      break;
    case "yell":
      out += `<ellipse cx="0" cy="${n1(my + mw * 0.4)}" rx="${n1(mw * 0.7)}" ry="${n1(mw * 0.85)}" fill="${mouthInk}"/>`;
      out += `<rect x="${n1(-mw * 0.45)}" y="${n1(my - mw * 0.35)}" width="${n1(mw * 0.9)}" height="${n1(mw * 0.22)}" fill="${ground}"/>`;
      break;
    case "wobbly": {
      let d = `M${n1(-mw * 0.7)} ${n1(my)}`;
      for (let i = 1; i <= 6; i++) d += ` L${n1(-mw * 0.7 + (i * mw * 1.4) / 6)} ${n1(my + (i % 2 ? -3 : 3))}`;
      out += Ln(d, sw * 0.9, mouthInk);
      break;
    }
    case "pout":
      out += `<path d="M${n1(-mw * 0.42)} ${n1(my)} Q0 ${n1(my - mw * 0.4)} ${n1(mw * 0.42)} ${n1(my)} Q0 ${n1(my + mw * 0.5)} ${n1(-mw * 0.42)} ${n1(my)} Z" fill="${mouthInk}"/>`;
      break;
  }

  /* moustaches */
  if (a.facial === "moustache" || a.facial === "handlebar") {
    const yy = my - Math.max(6, mw * 0.3);
    const w2 = mw * 1.15;
    let d = `M0 ${n1(yy - 4)} Q${n1(w2 * 0.5)} ${n1(yy - 12)} ${n1(w2)} ${n1(yy + 2)} Q${n1(w2 * 0.5)} ${n1(yy + 2)} 0 ${n1(yy + 3)} Q${n1(-w2 * 0.5)} ${n1(yy + 2)} ${n1(-w2)} ${n1(yy + 2)} Q${n1(-w2 * 0.5)} ${n1(yy - 12)} 0 ${n1(yy - 4)} Z`;
    out += S(d, ink, sw * 0.6);
    if (a.facial === "handlebar")
      for (const s of [-1, 1]) out += Ln(`M${n1(s * w2)} ${n1(yy + 2)} q${n1(s * 10)} ${n1(-2)} ${n1(s * 9)} ${n1(-12)} q${n1(-s * 1)} ${n1(-5)} ${n1(-s * 6)} ${n1(-3)}`, sw);
  }

  /* extras */
  if (a.extras?.includes("sweat")) out += S(`M${n1(hw * 0.8)} ${n1(-hh * 0.62)} Q${n1(hw * 0.68)} ${n1(-hh * 0.4)} ${n1(hw * 0.8)} ${n1(-hh * 0.36)} Q${n1(hw * 0.92)} ${n1(-hh * 0.4)} ${n1(hw * 0.8)} ${n1(-hh * 0.62)} Z`, ground, sw * 0.7);
  if (a.extras?.includes("thought")) {
    out += C(hw * 1.05, -hh * 0.95, 5, ground, sw * 0.6) + C(hw * 1.28, -hh * 1.22, 8, ground, sw * 0.6);
    const bx = hw * 1.45;
    const byy = -hh * 1.62;
    for (const [dx, dy, r] of [[-18, 4, 14], [0, -6, 17], [18, 3, 14], [0, 10, 14]]) out += C(bx + dx, byy + dy, r, ground, sw * 0.6);
    out += `<path d="M${n1(bx - 26)} ${n1(byy + 2)} H${n1(bx + 26)}" stroke="${ground}" stroke-width="${n1(sw * 3.5)}"/>`;
    for (const dx of [-10, 0, 10]) out += `<circle cx="${n1(bx + dx)}" cy="${n1(byy + 2)}" r="${n1(sw * 0.7)}" fill="${ink}"/>`;
  }
  if (a.extras?.includes("phone")) {
    const px = hw * 0.95;
    const py = hh * 0.1;
    out += `<g transform="rotate(12 ${n1(px)} ${n1(py)})"><rect x="${n1(px - hw * 0.2)}" y="${n1(py - hw * 0.38)}" width="${n1(hw * 0.4)}" height="${n1(hw * 0.76)}" rx="${n1(hw * 0.07)}" fill="${ink}" stroke="${ink}" stroke-width="${n1(sw * 0.6)}"/><rect x="${n1(px - hw * 0.14)}" y="${n1(py - hw * 0.3)}" width="${n1(hw * 0.28)}" height="${n1(hw * 0.52)}" fill="url(#t3)" stroke="${ground}" stroke-width="${n1(sw * 0.4)}"/></g>`;
    out += S(`M${n1(px - hw * 0.25)} ${n1(py + hw * 0.3)} q${n1(-hw * 0.1)} ${n1(hw * 0.3)} ${n1(hw * 0.2)} ${n1(hw * 0.45)} q${n1(hw * 0.25)} ${n1(-hw * 0.1)} ${n1(hw * 0.2)} ${n1(-hw * 0.45)}`, ground, sw * 0.7);
  }
  return back + out;
}

/** Scale + place a figure so its extent fills a box; returns the SVG group. */
function placeFigure(rng: Rng, a: Archetype, box: { x: number; y: number; w: number; h: number }, ink: string, ground: string, opts: { body: boolean; neckSpring?: boolean }) {
  const p = faceParams(rng);
  const flip = rng() < 0.5 ? -1 : 1;
  const e = extent(a, p, opts.body);
  const halfW = Math.max(p.hw * (a.body === "buff" && opts.body ? 2.3 : 1.35), a.hat === "cap" ? p.hw * 1.9 : 0, a.extras?.includes("thought") ? p.hw * 1.9 : 0);
  const k = Math.min(box.h / (e.bottom - e.top), box.w / (halfW * 2));
  const cy = box.y - e.top * k;
  const g = figure(a, p, ink, ground, { body: opts.body, sw: 4.2 / k, neckSpring: opts.neckSpring });
  const cx = box.x + box.w / 2 + (a.extras?.includes("thought") || a.hat === "cap" ? -flip * p.hw * 0.35 * k : 0);
  return { svg: `<g transform="translate(${n1(cx)} ${n1(cy)}) scale(${n1(k * flip * 1000) / 1000} ${n1(k * 1000) / 1000})">${g}</g>`, p, k, flip };
}

/** The archetype's prop (coffee, cactus, camera), drawn over the figure. */
const propFor = (a: Archetype, x: number, y: number, size: number, ink: string, ground: string) =>
  a.prop && OBJECTS[a.prop] ? `<circle cx="${n1(x + size / 2)}" cy="${n1(y + size / 2)}" r="${n1(size * 0.55)}" fill="${ground}" stroke="${ink}" stroke-width="2.5"/>` + drawPrims(OBJECTS[a.prop], x + size * 0.12, y + size * 0.1, size * 0.76, "solid", ink, ground, 3) : "";

const clipBox = (id: string, x: number, y: number, w: number, h: number, body: string) =>
  `<clipPath id="${id}"><rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}"/></clipPath><g clip-path="url(#${id})">${body}</g>`;

const sigVec = (p: FaceParams) => [(p.noseS - 1) / 0.75, (p.hw - 50) / 16];

const baseFeatures = (rng: Rng) => ({
  figurative: range(rng, 0.85, 1), wit: range(rng, 0.72, 0.92), pictorial: range(rng, 0.75, 0.9), line_art: range(rng, 0.6, 0.78),
  contrast: range(rng, 0.6, 0.78), clean_minimal: range(rng, 0.35, 0.55), abstract: 0.05, geometric: 0.1,
});

/* ------------------------------------------------------------------ */

export const caricaturePortrait: Generator = (rng, ink, ground) => {
  const a = pick(rng, ARCHETYPES);
  const bg = pick(rng, ["rays", "dots", "plain"] as const);
  const line = pick(rng, a.lines);
  const nameY = Y0 + IH - 62;
  let body = toneDefs(ink);
  const box = { x: X0 + 6, y: Y0 + 8, w: IW - 12, h: nameY - Y0 - 30 };
  if (bg === "rays") {
    const cy = Y0 + box.h * 0.4;
    let rays = "";
    for (let i = 0; i < 36; i += 2) {
      const t0 = (i / 36) * Math.PI * 2;
      const t1 = ((i + 1) / 36) * Math.PI * 2;
      rays += `M${CX} ${n1(cy)} L${n1(CX + Math.cos(t0) * 400)} ${n1(cy + Math.sin(t0) * 400)} L${n1(CX + Math.cos(t1) * 400)} ${n1(cy + Math.sin(t1) * 400)} Z`;
    }
    body += clipBox("rays", X0, Y0, IW, nameY - Y0 - 24, `<path d="${rays}" fill="url(#t1)"/>`);
  }
  if (bg === "dots") body += `<circle cx="${CX}" cy="${n1(Y0 + box.h * 0.42)}" r="${n1(Math.min(IW, box.h) * 0.46)}" fill="url(#t2)"/>`;
  const fig = placeFigure(rng, a, box, ink, ground, { body: true });
  body += clipBox("fig", X0, Y0, IW, nameY - Y0 - 24, fig.svg);
  body += propFor(a, fig.flip > 0 ? X0 + 4 : X0 + IW - 74, nameY - 106, 70, ink, ground);
  body += `<line x1="${X0}" y1="${nameY - 24}" x2="${X0 + IW}" y2="${nameY - 24}" stroke="${ink}" stroke-width="3"/>`;
  body += textEl(a.name.toUpperCase(), CX, nameY + 6, 30, { fill: ink, weight: 900, anchor: "middle", maxW: IW - 10, spacing: 1 });
  wrap(line, 34).slice(0, 2).forEach((l, i) => (body += textEl(l, CX, nameY + 30 + i * 15, 12.5, { fill: ink, font: SERIF, italic: true, anchor: "middle", maxW: IW - 16 })));
  return {
    body,
    variant: "caricature-portrait",
    sig: { key: `portrait-${a.name}`, vec: sigVec(fig.p) },
    description: `Caricature of ${a.name}, an original archetype (not a real person). ${line}`,
    complexity: 0.6,
    features: { ...baseFeatures(rng), typography: range(rng, 0.3, 0.45), density: range(rng, 0.45, 0.6), halftone_raster: bg === "plain" ? 0.05 : range(rng, 0.3, 0.45), retro: range(rng, 0.2, 0.35), dark_industrial: range(rng, 0.15, 0.3) },
  };
};

export const caricatureWanted: Generator = (rng, ink, ground) => {
  const a = pick(rng, ARCHETYPES);
  const crime = pick(rng, WANTED_CRIMES);
  const reward = pick(rng, WANTED_REWARDS);
  let body = toneDefs(ink);
  body += `<rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}" fill="none" stroke="${ink}" stroke-width="4"/><rect x="${X0 + 7}" y="${Y0 + 7}" width="${IW - 14}" height="${IH - 14}" fill="none" stroke="${ink}" stroke-width="1.2"/>`;
  for (const [x, y] of [[X0 + 14, Y0 + 14], [X0 + IW - 14, Y0 + 14], [X0 + 14, Y0 + IH - 14], [X0 + IW - 14, Y0 + IH - 14]]) body += `<circle cx="${x}" cy="${y}" r="2.5" fill="${ink}"/>`;
  body += textEl("WANTED", CX, Y0 + 62, 52, { fill: ink, font: SERIF, weight: 700, anchor: "middle", maxW: IW - 36, spacing: 2 });
  body += textEl("FOR", CX, Y0 + 82, 11, { fill: ink, weight: 700, anchor: "middle", spacing: 4 });
  const fit = fitLines(crime, IW - 50, 38, "sansBold", 1.05, 18);
  fit.lines.forEach((l, i) => (body += textEl(l, CX, Y0 + 98 + fit.size * (0.8 + i * 1.05), fit.size, { fill: ink, weight: 900, anchor: "middle", maxW: IW - 50 })));
  const py = Y0 + 142;
  const ph = 126;
  body += `<rect x="${X0 + 34}" y="${py}" width="${IW - 68}" height="${ph}" fill="url(#t1)" stroke="${ink}" stroke-width="2.5"/>`;
  const fig = placeFigure(rng, a, { x: X0 + 40, y: py + 8, w: IW - 80, h: ph * 1.25 }, ink, ground, { body: true });
  body += clipBox("ph", X0 + 34, py, IW - 68, ph, fig.svg);
  body += `<rect x="${X0 + 34}" y="${py}" width="${IW - 68}" height="${ph}" fill="none" stroke="${ink}" stroke-width="2.5"/>`;
  body += textEl(a.name.toUpperCase(), CX, py + ph + 23, 17, { fill: ink, font: SERIF, weight: 700, anchor: "middle", maxW: IW - 40, spacing: 1 });
  body += textEl("REWARD", CX, Y0 + IH - 38, 12, { fill: ink, weight: 700, anchor: "middle", spacing: 5 });
  body += textEl(reward, CX, Y0 + IH - 18, 15, { fill: ink, weight: 900, anchor: "middle", maxW: IW - 40 });
  return {
    body,
    variant: "caricature-wanted",
    sig: { key: `wanted-${a.name}`, vec: sigVec(fig.p) },
    description: `WANTED poster for ${a.name} (an original caricature), sought for ${crime.toLowerCase()}. Reward: ${reward.toLowerCase()}.`,
    complexity: 0.65,
    features: { ...baseFeatures(rng), typography: range(rng, 0.5, 0.65), retro: range(rng, 0.55, 0.72), density: range(rng, 0.5, 0.65), halftone_raster: range(rng, 0.2, 0.3), dark_industrial: range(rng, 0.25, 0.4), classic: range(rng, 0.1, 0.2) },
  };
};

export const caricatureMugshot: Generator = (rng, ink, ground) => {
  const a = pick(rng, ARCHETYPES);
  const charge = pick(rng, WANTED_CRIMES);
  const num = `${String(int(rng, 1, 99)).padStart(2, "0")}-${int(rng, 1000, 9999)}`;
  let body = toneDefs(ink);
  // height chart
  const top = Y0 + 6;
  const bottom = Y0 + IH - 96;
  for (let y = bottom, i = 0; y > top; y -= 14, i++) {
    const major = i % 4 === 0;
    body += `<line x1="${X0}" y1="${n1(y)}" x2="${n1(major ? X0 + IW : X0 + 18)}" y2="${n1(y)}" stroke="${ink}" stroke-width="${major ? 1.4 : 0.8}"/>`;
    if (major && i > 0) body += textEl(`${4 + Math.floor(i / 8)}'${(i % 8) * 1.5 || ""}`.replace(/'$/, "'"), X0 + 3, y - 3, 9, { fill: ink, font: MONO });
  }
  const fig = placeFigure(rng, a, { x: X0 + 20, y: top + 14, w: IW - 40, h: bottom - top + 40 }, ink, ground, { body: true });
  body += clipBox("mug", X0, top - 4, IW, bottom - top + 4, fig.svg);
  // placard
  const py = Y0 + IH - 88;
  body += `<rect x="${X0 + 20}" y="${py}" width="${IW - 40}" height="84" fill="${ink}"/>`;
  body += textEl("MONO COUNTY P.D.", CX, py + 16, 10, { fill: ground, font: MONO, weight: 700, anchor: "middle", spacing: 2 });
  body += textEl(a.name.toUpperCase(), CX, py + 42, 20, { fill: ground, weight: 900, anchor: "middle", maxW: IW - 56 });
  body += textEl(`No. ${num}`, CX, py + 59, 11, { fill: ground, font: MONO, anchor: "middle" });
  body += textEl(`CHARGE: ${charge}`, CX, py + 75, 9, { fill: ground, font: MONO, anchor: "middle", maxW: IW - 56 });
  return {
    body,
    variant: "caricature-mugshot",
    sig: { key: `mugshot-${a.name}`, vec: sigVec(fig.p) },
    description: `Mugshot of ${a.name}, an original caricature, booked for ${charge.toLowerCase()}.`,
    complexity: 0.6,
    features: { ...baseFeatures(rng), typography: range(rng, 0.4, 0.55), retro: range(rng, 0.35, 0.5), density: range(rng, 0.5, 0.65), architectural: 0.15, dark_industrial: range(rng, 0.35, 0.5), geometric: 0.25 },
  };
};

export const caricatureBobble: Generator = (rng, ink, ground) => {
  const a = pick(rng, ARCHETYPES);
  const tagline = pick(rng, BOBBLE_TAGLINES);
  let body = toneDefs(ink);
  body += textEl("COLLECTOR'S EDITION", CX, Y0 + 14, 10, { fill: ink, font: MONO, weight: 700, anchor: "middle", spacing: 2 });
  const p = faceParams(rng);
  const flip = rng() < 0.5 ? -1 : 1;
  const headK = Math.min(150 / (p.hh * 2.9), 120 / (p.hw * 1.5));
  const baseY = Y0 + IH - 72;
  // tiny body on a base
  const bodyTop = baseY - 70;
  const bw = 26;
  let fig = "";
  fig += `<path d="M${CX - bw} ${baseY} V${bodyTop + 30} Q${CX - bw} ${bodyTop} ${CX} ${bodyTop} Q${CX + bw} ${bodyTop} ${CX + bw} ${bodyTop + 30} V${baseY} Z" fill="${ground}" stroke="${ink}" stroke-width="4"/>`;
  fig += `<path d="M${CX} ${bodyTop + 6} V${baseY - 26} M${CX - bw} ${bodyTop + 26} L${CX - bw - 14} ${bodyTop + 44} M${CX + bw} ${bodyTop + 26} L${CX + bw + 14} ${bodyTop + 44} M${CX - bw + 6} ${baseY - 26} H${CX + bw - 6}" stroke="${ink}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
  if (a.extras?.includes("tie")) fig += `<path d="M${CX - 5} ${bodyTop + 6} H${CX + 5} L${CX + 7} ${bodyTop + 36} L${CX} ${bodyTop + 44} L${CX - 7} ${bodyTop + 36} Z" fill="${ink}"/>`;
  // spring neck
  let spring = `M${CX} ${bodyTop}`;
  for (let i = 1; i <= 7; i++) spring += ` L${CX + (i % 2 ? -9 : 9)} ${bodyTop - i * 4}`;
  fig += `<path d="${spring} L${CX} ${bodyTop - 30}" stroke="${ink}" stroke-width="3" fill="none" stroke-linejoin="round"/>`;
  // big head
  const headCy = bodyTop - 30 - p.hh * 1.05 * headK;
  const head = figure(a, p, ink, ground, { body: false, sw: 4.2 / headK });
  fig += `<g transform="translate(${CX} ${n1(headCy)}) rotate(${n1(range(rng, -8, 8))}) scale(${n1(headK * flip * 1000) / 1000} ${n1(headK * 1000) / 1000})">${head}</g>`;
  // wobble lines
  for (const s of [-1, 1]) {
    const x = CX + s * (p.hw * headK * 1.4 + 8);
    fig += `<path d="M${n1(x)} ${n1(headCy - 16)} q${s * 7} 16 0 32 M${n1(x + s * 8)} ${n1(headCy - 10)} q${s * 5} 10 0 20" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
  }
  body += clipBox("bob", X0, Y0 + 22, IW, baseY - Y0 - 22 + 4, fig);
  // base with name plate
  body += `<path d="M${X0 + 40} ${baseY} H${X0 + IW - 40} L${X0 + IW - 26} ${baseY + 40} H${X0 + 26} Z" fill="${ink}"/>`;
  body += textEl(a.name.toUpperCase(), CX, baseY + 26, 15, { fill: ground, weight: 900, anchor: "middle", maxW: IW - 90, spacing: 1 });
  body += textEl(tagline, CX, Y0 + IH - 8, 11, { fill: ink, font: SERIF, italic: true, anchor: "middle", maxW: IW - 10 });
  return {
    body,
    variant: "caricature-bobble",
    sig: { key: `bobble-${a.name}`, vec: sigVec(p) },
    description: `Bobblehead of ${a.name}, an original caricature, on a spring. ${tagline}`,
    complexity: 0.55,
    features: { ...baseFeatures(rng), typography: range(rng, 0.3, 0.42), retro: range(rng, 0.3, 0.45), density: range(rng, 0.38, 0.52), clean_minimal: range(rng, 0.45, 0.6), dark_industrial: range(rng, 0.15, 0.3) },
  };
};
