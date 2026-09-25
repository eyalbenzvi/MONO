/**
 * Iconic Images: world landmarks (drawn from scratch), vintage travel
 * posters, space-age icons and universal motifs. No photographs, logos or
 * trademarks — every picture is an original single-ink drawing.
 */
import { IH, IW, W, X0, Y0, int, n1, pick, range, smooth, type Generator, type Rng } from "../core";
import { MONO, SERIF, drawPrims, fitLines, sizeToFit, textEl, toneDefs } from "../art";
import { LANDMARK_INFO, MOTIF_CAPTIONS, SPACE_CAPTIONS, TRAVEL_TAGLINES } from "../copy3";
import { LANDMARKS, LANDMARK_KEYS } from "./landmarks";

/** "NEW YORK" → "New York" (place names are stored in caps for the poster type). */
const placeName = (place: string) => place.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const CX = W / 2;
type P = [number, number];
const line = (d: string, ink: string, w: number) => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${n1(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;

function drawLandmark(key: string, x: number, y: number, size: number, style: "solid" | "line" | "woodcut", ink: string, ground: string, sw = 2.5) {
  const { prims, tilt } = LANDMARKS[key];
  const g = drawPrims(prims, x, y, size, style, ink, ground, sw, "l2");
  return tilt ? `<g transform="rotate(${tilt} ${n1(x + size / 2)} ${n1(y + size * 0.96)})">${g}</g>` : g;
}

/** Caption block fitted to a box, bold sans, centred. */
function caption(txt: string, y: number, boxH: number, ink: string, maxSize = 34) {
  const fit = fitLines(txt, IW - 20, boxH, "sansBold", 1.08, maxSize);
  return fit.lines.map((l, i) => textEl(l, CX, y + fit.size * (0.85 + i * 1.08), fit.size, { fill: ink, weight: 900, anchor: "middle", maxW: IW - 20 })).join("");
}

const iconicFeatures = (rng: Rng) => ({
  pictorial: range(rng, 0.75, 0.9), contrast: range(rng, 0.65, 0.82), typography: range(rng, 0.3, 0.45), abstract: 0.05,
});

/* ------------------------------------------------------------------ */
/* Landmark card                                                       */
/* ------------------------------------------------------------------ */

export const landmark: Generator = (rng, ink, ground) => {
  const key = pick(rng, LANDMARK_KEYS);
  const info = LANDMARK_INFO[key];
  const style = pick(rng, ["solid", "line", "woodcut"] as const);
  const sky = pick(rng, ["sun", "moon", "dots", "none"] as const);
  const line1 = pick(rng, info.lines);
  let body = toneDefs(ink);
  body += `<rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}" fill="none" stroke="${ink}" stroke-width="2"/>`;
  body += textEl(`Nº ${String(int(rng, 1, 99)).padStart(2, "0")} · WONDERS OF THE WORLD`, CX, Y0 + 18, 9, { fill: ink, font: MONO, anchor: "middle", spacing: 1.5, maxW: IW - 20 });
  const size = 210;
  const lx = CX - size / 2;
  const ly = Y0 + 36;
  const baseY = ly + size * 0.97;
  if (sky === "sun") body += `<circle cx="${n1(CX + range(rng, -50, 50))}" cy="${n1(ly + range(rng, 50, 90))}" r="${n1(range(rng, 30, 44))}" fill="url(#t2)" stroke="${ink}" stroke-width="2"/>`;
  if (sky === "moon") {
    const mx = CX + pick(rng, [-70, 70]);
    const my = ly + 34;
    body += `<circle cx="${n1(mx)}" cy="${n1(my)}" r="16" fill="${ink}"/><circle cx="${n1(mx + 7)}" cy="${n1(my - 4)}" r="14" fill="${ground}"/>`;
  }
  if (sky === "dots") body += `<rect x="${X0 + 12}" y="${n1(ly + 10)}" width="${IW - 24}" height="${n1(size * 0.8)}" fill="url(#t1)"/>`;
  // a ground-coloured halo keeps the silhouette crisp over any sky
  if (sky !== "none") body += drawLandmark(key, lx, ly, size, "line", ground, ink, 8);
  body += drawLandmark(key, lx, ly, size, style, ink, ground, 2.5);
  body += `<line x1="${X0 + 12}" y1="${n1(baseY)}" x2="${X0 + IW - 12}" y2="${n1(baseY)}" stroke="${ink}" stroke-width="2.5"/>`;
  const nameSize = sizeToFit(info.place, IW - 30, "sansBold", 40, 3);
  body += textEl(info.place, CX, Y0 + IH - 50, nameSize, { fill: ink, weight: 900, anchor: "middle", spacing: 3, maxW: IW - 30 });
  body += textEl(info.coords, CX, Y0 + IH - 32, 10, { fill: ink, font: MONO, anchor: "middle", maxW: IW - 30 });
  body += textEl(line1, CX, Y0 + IH - 12, 12.5, { fill: ink, font: SERIF, italic: true, anchor: "middle", maxW: IW - 24 });
  return {
    body,
    variant: "iconic-landmark",
    sig: { key: `landmark-${key}`, vec: [style === "solid" ? 0 : style === "line" ? 0.5 : 1] },
    description: `${info.name}, ${info.place === "THE COAST" ? "somewhere on the coast" : placeName(info.place)} — an original ${style === "line" ? "line drawing" : style === "solid" ? "silhouette" : "woodcut"}. ${line1}`,
    complexity: 0.6,
    features: {
      ...iconicFeatures(rng), architectural: key === "moai" || key === "stonehenge" ? range(rng, 0.4, 0.55) : range(rng, 0.62, 0.8), classic: range(rng, 0.25, 0.4), retro: range(rng, 0.35, 0.5),
      line_art: style === "line" ? range(rng, 0.7, 0.85) : range(rng, 0.3, 0.45), density: range(rng, 0.4, 0.55), clean_minimal: range(rng, 0.5, 0.68), wit: range(rng, 0.3, 0.5),
      halftone_raster: sky === "dots" || style === "woodcut" ? 0.35 : 0.1, nature: key === "lighthouse" || key === "moai" ? 0.35 : 0.1, geometric: range(rng, 0.3, 0.45), dark_industrial: range(rng, 0.25, 0.4),
    },
  };
};

/* ------------------------------------------------------------------ */
/* Travel poster                                                       */
/* ------------------------------------------------------------------ */

export const travelPoster: Generator = (rng, ink, ground) => {
  const key = pick(rng, LANDMARK_KEYS);
  const info = LANDMARK_INFO[key];
  const tagline = pick(rng, TRAVEL_TAGLINES[key]);
  const bg = pick(rng, ["rays", "stripes", "dots"] as const);
  const verb = pick(rng, ["VISIT", "SEE", "FLY TO", "DISCOVER"]);
  let body = toneDefs(ink);
  body += `<rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}" fill="none" stroke="${ink}" stroke-width="5"/><rect x="${X0 + 8}" y="${Y0 + 8}" width="${IW - 16}" height="${IH - 16}" fill="none" stroke="${ink}" stroke-width="1.2"/>`;
  body += textEl(verb, CX, Y0 + 32, 13, { fill: ink, weight: 700, anchor: "middle", spacing: 6 });
  const nameSize = sizeToFit(info.place, IW - 40, "sansBold", 50, 2);
  body += textEl(info.place, CX, Y0 + 36 + nameSize * 0.85, nameSize, { fill: ink, weight: 900, anchor: "middle", spacing: 2, maxW: IW - 40 });
  const art = { x: X0 + 16, y: Y0 + 48 + nameSize, w: IW - 32, h: IH - 110 - nameSize };
  const horizon = art.y + art.h * 0.78;
  const sunX = CX;
  let scene = "";
  if (bg === "rays") {
    let d = "";
    for (let i = 0; i < 24; i += 2) {
      const a0 = Math.PI + (i / 24) * Math.PI;
      const a1 = Math.PI + ((i + 1) / 24) * Math.PI;
      d += `M${sunX} ${n1(horizon)} L${n1(sunX + Math.cos(a0) * 400)} ${n1(horizon + Math.sin(a0) * 400)} L${n1(sunX + Math.cos(a1) * 400)} ${n1(horizon + Math.sin(a1) * 400)} Z`;
    }
    scene += `<path d="${d}" fill="url(#t2)"/>`;
  }
  if (bg === "stripes") for (let i = 0, y = horizon - 4; y > art.y; i++, y -= 7 + i * 1.6) scene += `<rect x="${n1(art.x)}" y="${n1(y - Math.max(0.6, 4 - i * 0.45))}" width="${n1(art.w)}" height="${n1(Math.max(0.6, 4 - i * 0.45))}" fill="${ink}"/>`;
  if (bg === "dots") scene += `<rect x="${n1(art.x)}" y="${n1(art.y)}" width="${n1(art.w)}" height="${n1(horizon - art.y)}" fill="url(#t1)"/>`;
  scene += `<circle cx="${sunX}" cy="${n1(horizon)}" r="${n1(art.w * 0.26)}" fill="${ground}" stroke="${ink}" stroke-width="2.5"/>`;
  const size = Math.min(art.w * 0.88, (horizon - art.y) * 1.03);
  const lx = CX - size / 2;
  const ly = horizon - size * 0.97;
  scene += drawLandmark(key, lx, ly, size, "line", ground, ink, 9);
  scene += drawLandmark(key, lx, ly, size, "solid", ink, ground, 2.5);
  scene += `<rect x="${n1(art.x)}" y="${n1(horizon)}" width="${n1(art.w)}" height="${n1(art.y + art.h - horizon)}" fill="${ink}"/>`;
  for (let y = horizon + 6, k = 0; y < art.y + art.h - 2; y += 6, k++) scene += `<line x1="${n1(art.x + 10 + k * 6)}" y1="${n1(y)}" x2="${n1(art.x + art.w - 10 - k * 6)}" y2="${n1(y)}" stroke="${ground}" stroke-width="1.4" stroke-dasharray="${n1(14 - k)} ${n1(5 + k)}"/>`;
  body += `<clipPath id="tp"><rect x="${n1(art.x)}" y="${n1(art.y)}" width="${n1(art.w)}" height="${n1(art.h)}"/></clipPath><g clip-path="url(#tp)">${scene}</g>`;
  body += `<rect x="${n1(art.x)}" y="${n1(art.y)}" width="${n1(art.w)}" height="${n1(art.h)}" fill="none" stroke="${ink}" stroke-width="2"/>`;
  const tl = fitLines(tagline, IW - 40, 30, "serifItalic", 1.15, 14);
  const tlTop = Y0 + IH - 57 + (30 - tl.lines.length * tl.size * 1.15) / 2;
  tl.lines.forEach((l, i) => (body += textEl(l, CX, tlTop + tl.size * (0.9 + i * 1.15), tl.size, { fill: ink, font: SERIF, italic: true, anchor: "middle", maxW: IW - 36 })));
  body += textEl("MONO TRAVEL BUREAU · EST. 2026", CX, Y0 + IH - 20, 8.5, { fill: ink, font: MONO, anchor: "middle", spacing: 1.5, maxW: IW - 36 });
  return {
    body,
    variant: "iconic-travel",
    sig: { key: `travel-${key}`, vec: [bg === "rays" ? 0 : bg === "stripes" ? 0.5 : 1] },
    description: `Vintage travel poster: ${verb.toLowerCase()} ${info.place === "THE COAST" ? "the coast" : placeName(info.place)}. “${tagline}”`,
    complexity: 0.7,
    features: {
      ...iconicFeatures(rng), retro: range(rng, 0.8, 0.95), architectural: range(rng, 0.45, 0.6), typography: range(rng, 0.5, 0.65), geometric: range(rng, 0.4, 0.55), density: range(rng, 0.6, 0.75),
      halftone_raster: bg === "stripes" ? 0.2 : range(rng, 0.35, 0.5), wit: range(rng, 0.45, 0.65), classic: range(rng, 0.3, 0.45), clean_minimal: range(rng, 0.3, 0.45), line_art: 0.2, nature: range(rng, 0.2, 0.35), dark_industrial: range(rng, 0.3, 0.45),
    },
  };
};

/* ------------------------------------------------------------------ */
/* Space age                                                           */
/* ------------------------------------------------------------------ */

function starfield(rng: Rng, n: number, ink: string, y0: number, y1: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += `<circle cx="${n1(range(rng, X0 + 4, X0 + IW - 4))}" cy="${n1(range(rng, y0, y1))}" r="${n1(rng() < 0.1 ? 1.8 : range(rng, 0.5, 1.1))}"/>`;
  return `<g fill="${ink}">${s}</g>`;
}

function astronaut(rng: Rng, ink: string, ground: string) {
  const cy = Y0 + 140;
  const R = 92;
  let s = starfield(rng, 40, ink, Y0 + 4, Y0 + 60);
  s += `<path d="M${X0 - 4} ${Y0 + IH - 60} Q${X0 + 10} ${cy + 70} ${CX - 60} ${cy + 78} L${CX + 60} ${cy + 78} Q${X0 + IW - 10} ${cy + 70} ${X0 + IW + 4} ${Y0 + IH - 60} Z" fill="${ground}" stroke="${ink}" stroke-width="4"/>`;
  s += `<rect x="${CX - 36}" y="${cy + 96}" width="72" height="40" rx="5" fill="${ground}" stroke="${ink}" stroke-width="3"/>`;
  for (let i = 0; i < 3; i++) s += `<rect x="${CX - 26 + i * 20}" y="${cy + 104}" width="12" height="8" fill="${ink}"/><circle cx="${CX - 20 + i * 20}" cy="${cy + 124}" r="3.5" fill="${i === 1 ? ink : ground}" stroke="${ink}" stroke-width="2"/>`;
  s += line(`M${CX - 60} ${cy + 100} q-20 20 -8 48 M${CX + 60} ${cy + 100} q20 20 8 48`, ink, 4);
  s += `<rect x="${CX - 62}" y="${cy + 70}" width="124" height="16" rx="6" fill="${ground}" stroke="${ink}" stroke-width="4"/>`;
  s += `<circle cx="${CX}" cy="${cy}" r="${R}" fill="${ground}" stroke="${ink}" stroke-width="7"/>`;
  s += `<ellipse cx="${CX}" cy="${cy + 6}" rx="${R * 0.76}" ry="${R * 0.62}" fill="${ink}"/>`;
  // reflection: earth crescent, stars, a highlight
  const ex = CX + range(rng, 10, 30);
  const ey = cy - 12;
  s += `<clipPath id="visor"><ellipse cx="${CX}" cy="${cy + 6}" rx="${R * 0.76}" ry="${R * 0.62}"/></clipPath><g clip-path="url(#visor)">`;
  s += `<circle cx="${n1(ex)}" cy="${n1(ey)}" r="22" fill="${ground}"/><circle cx="${n1(ex - 9)}" cy="${n1(ey - 5)}" r="20" fill="${ink}"/>`;
  s += starfield(rng, 14, ground, cy - 50, cy + 50);
  s += line(`M${CX - R * 0.6} ${cy - 10} Q${CX - R * 0.5} ${cy - R * 0.5} ${CX - R * 0.1} ${cy - R * 0.55}`, ground, 5);
  s += `</g>`;
  s += `<circle cx="${CX - R * 0.8}" cy="${cy - R * 0.2}" r="6" fill="${ground}" stroke="${ink}" stroke-width="3"/><circle cx="${CX + R * 0.8}" cy="${cy - R * 0.2}" r="6" fill="${ground}" stroke="${ink}" stroke-width="3"/>`;
  return s;
}

function footprint(rng: Rng, ink: string, ground: string) {
  let s = `<rect x="${X0}" y="${Y0}" width="${IW}" height="${IH - 84}" fill="url(#t1)"/>`;
  const cx = CX + range(rng, -10, 10);
  const top = Y0 + 26;
  const len = IH - 140;
  const w = 88;
  const rot = range(rng, -14, 14);
  const sole = `M${cx - w * 0.42} ${top + len * 0.2} Q${cx - w * 0.5} ${top} ${cx} ${top} Q${cx + w * 0.5} ${top} ${cx + w * 0.44} ${top + len * 0.22} L${cx + w * 0.34} ${top + len * 0.62} Q${cx + w * 0.38} ${top + len} ${cx} ${top + len} Q${cx - w * 0.38} ${top + len} ${cx - w * 0.34} ${top + len * 0.62} Z`;
  let treads = "";
  for (let i = 0; i < 13; i++) {
    const y = top + 14 + i * ((len - 26) / 13);
    treads += `<rect x="${cx - w * 0.5}" y="${n1(y)}" width="${w}" height="${n1(((len - 26) / 13) * 0.45)}" fill="${ground}"/>`;
  }
  s += `<g transform="rotate(${n1(rot)} ${n1(cx)} ${n1(top + len / 2)})"><clipPath id="sole"><path d="${sole}"/></clipPath><path d="${sole}" fill="${ink}"/><g clip-path="url(#sole)">${treads}</g><path d="${sole}" fill="none" stroke="${ink}" stroke-width="4"/></g>`;
  return s;
}

function earthrise(rng: Rng, ink: string, ground: string) {
  let s = starfield(rng, 60, ink, Y0 + 4, Y0 + IH - 150);
  const ex = CX + range(rng, -30, 30);
  const ey = Y0 + range(rng, 100, 130);
  const r = range(rng, 50, 62);
  s += `<circle cx="${n1(ex)}" cy="${n1(ey)}" r="${n1(r)}" fill="url(#t2)" stroke="${ink}" stroke-width="2.5"/>`;
  s += `<path d="M${n1(ex)} ${n1(ey - r)} A${n1(r)} ${n1(r)} 0 0 1 ${n1(ex)} ${n1(ey + r)} A${n1(r * 0.45)} ${n1(r)} 0 0 0 ${n1(ex)} ${n1(ey - r)} Z" fill="${ink}"/>`;
  for (let i = 0; i < 4; i++) s += line(`M${n1(ex + r * 0.15)} ${n1(ey - r * 0.6 + i * r * 0.35)} q${n1(r * 0.25)} ${n1(-r * 0.1)} ${n1(r * 0.5)} ${n1(r * 0.05)}`, ground, 2.5);
  const moonY = Y0 + IH - 110;
  s += `<path d="M${X0 - 10} ${moonY + 40} Q${CX} ${moonY - 40} ${X0 + IW + 10} ${moonY + 40} V${Y0 + IH - 84} H${X0 - 10} Z" fill="url(#t3)" stroke="${ink}" stroke-width="3"/>`;
  for (let i = 0; i < 6; i++) {
    const x = range(rng, X0 + 20, X0 + IW - 20);
    const y = moonY + range(rng, 20, 34);
    s += `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(range(rng, 8, 18))}" ry="${n1(range(rng, 2.5, 5))}" fill="${ground}" stroke="${ink}" stroke-width="1.8"/>`;
  }
  return s;
}

function launch(rng: Rng, ink: string, ground: string) {
  let s = starfield(rng, 30, ink, Y0 + 4, Y0 + 120);
  const cx = CX + range(rng, -6, 14);
  const top = Y0 + range(rng, 18, 40);
  const bw = 34;
  const bh = 150;
  // tower
  const tx = cx - 72;
  s += `<path d="M${tx} ${Y0 + IH - 110} V${top + 40} M${tx + 22} ${Y0 + IH - 110} V${top + 40}" stroke="${ink}" stroke-width="3"/>`;
  let lat = "";
  for (let y = top + 40; y < Y0 + IH - 118; y += 16) lat += `M${tx} ${y} L${tx + 22} ${y + 16} M${tx + 22} ${y} L${tx} ${y + 16} `;
  s += line(lat, ink, 1.4) + line(`M${tx + 22} ${top + 70} H${cx - bw / 2} M${tx + 22} ${top + 120} H${cx - bw / 2}`, ink, 2.5);
  // rocket
  s += `<path d="M${cx - bw / 2} ${top + 50} Q${cx - bw / 2} ${top + 6} ${cx} ${top} Q${cx + bw / 2} ${top + 6} ${cx + bw / 2} ${top + 50} V${top + bh} H${cx - bw / 2} Z" fill="${ground}" stroke="${ink}" stroke-width="4"/>`;
  s += `<path d="M${cx - bw / 2} ${top + bh - 36} L${cx - bw / 2 - 18} ${top + bh + 4} L${cx - bw / 2} ${top + bh} Z M${cx + bw / 2} ${top + bh - 36} L${cx + bw / 2 + 18} ${top + bh + 4} L${cx + bw / 2} ${top + bh} Z" fill="${ink}"/>`;
  s += `<circle cx="${cx}" cy="${top + 52}" r="8" fill="${ink}"/><circle cx="${cx}" cy="${top + 52}" r="3.5" fill="${ground}"/>`;
  s += `<rect x="${cx - bw / 2}" y="${top + 86}" width="${bw}" height="12" fill="url(#l2)"/><path d="M${cx - bw / 2} ${top + 30} H${cx + bw / 2}" stroke="${ink}" stroke-width="2"/>`;
  s += `<path d="M${cx - 11} ${top + bh} L${cx} ${top + bh + 42} L${cx + 11} ${top + bh} Z" fill="${ink}"/>`;
  // exhaust clouds
  const cy = Y0 + IH - 112;
  for (let i = 0; i < 14; i++) {
    const x = cx + range(rng, -110, 110);
    const r = range(rng, 14, 30) * (1 - Math.abs(x - cx) / 260);
    s += `<circle cx="${n1(x)}" cy="${n1(cy + range(rng, -8, 18))}" r="${n1(r)}" fill="${ground}" stroke="${ink}" stroke-width="2.5"/>`;
  }
  return s;
}

export const spaceAge: Generator = (rng, ink, ground) => {
  const kind = pick(rng, ["astronaut", "footprint", "earthrise", "launch"] as const);
  const cap = pick(rng, SPACE_CAPTIONS[kind]);
  let body = toneDefs(ink);
  const art = kind === "astronaut" ? astronaut(rng, ink, ground) : kind === "footprint" ? footprint(rng, ink, ground) : kind === "earthrise" ? earthrise(rng, ink, ground) : launch(rng, ink, ground);
  body += `<clipPath id="sp"><rect x="${X0}" y="${Y0}" width="${IW}" height="${IH - 84}"/></clipPath><g clip-path="url(#sp)">${art}</g>`;
  body += `<line x1="${X0}" y1="${Y0 + IH - 80}" x2="${X0 + IW}" y2="${Y0 + IH - 80}" stroke="${ink}" stroke-width="3"/>`;
  body += caption(cap, Y0 + IH - 72, 46, ink, 30);
  body += textEl(`MISSION LOG · DAY ${int(rng, 1, 999)} · ALL SYSTEMS NOMINAL`, CX, Y0 + IH - 6, 8.5, { fill: ink, font: MONO, anchor: "middle", spacing: 1, maxW: IW });
  return {
    body,
    variant: `iconic-${kind}`,
    sig: { key: `space-${kind}`, vec: [] },
    description: `Space-age ${kind === "earthrise" ? "earthrise over the moon" : kind === "footprint" ? "boot print in moon dust" : kind === "launch" ? "rocket launch" : "astronaut helmet"}: “${cap}”.`,
    complexity: 0.6,
    features: {
      ...iconicFeatures(rng), retro: range(rng, 0.6, 0.78), wit: /VIBE|OFFICE|FOREVER|FINALLY|MORE|STEPPED|WISH/.test(cap) ? range(rng, 0.6, 0.78) : range(rng, 0.3, 0.45), typography: range(rng, 0.45, 0.6),
      halftone_raster: kind === "astronaut" ? 0.1 : range(rng, 0.4, 0.55), density: range(rng, 0.5, 0.65), line_art: range(rng, 0.35, 0.5), nature: kind === "earthrise" ? 0.45 : 0.15, geometric: range(rng, 0.3, 0.45),
      figurative: kind === "astronaut" ? range(rng, 0.4, 0.55) : 0, dark_industrial: range(rng, 0.4, 0.55), clean_minimal: range(rng, 0.35, 0.5), classic: 0.15,
    },
  };
};

/* ------------------------------------------------------------------ */
/* Universal motifs                                                    */
/* ------------------------------------------------------------------ */

function ufo(rng: Rng, ink: string, ground: string, top: number, h: number) {
  const cy = top + h * 0.25;
  let s = starfield(rng, 30, ink, top, top + h * 0.5);
  s += `<path d="M${CX - 50} ${cy + 12} L${CX - 100} ${top + h - 6} L${CX + 100} ${top + h - 6} L${CX + 50} ${cy + 12} Z" fill="url(#l1)"/>`;
  s += `<path d="M${X0 - 4} ${top + h - 10} Q${CX} ${top + h - 26} ${X0 + IW + 4} ${top + h - 8} V${top + h + 4} H${X0 - 4} Z" fill="${ink}"/>`;
  // cow, mid-abduction
  const kx = CX + range(rng, -20, 20);
  const ky = cy + h * 0.38;
  s += `<g transform="rotate(${n1(range(rng, -25, 25))} ${n1(kx)} ${n1(ky)})"><rect x="${n1(kx - 22)}" y="${n1(ky - 11)}" width="44" height="22" rx="8" fill="${ground}" stroke="${ink}" stroke-width="3"/><path d="M${n1(kx - 16)} ${n1(ky + 11)} v10 M${n1(kx - 6)} ${n1(ky + 11)} v10 M${n1(kx + 8)} ${n1(ky + 11)} v10 M${n1(kx + 17)} ${n1(ky + 11)} v10" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><rect x="${n1(kx + 18)}" y="${n1(ky - 16)}" width="16" height="14" rx="4" fill="${ground}" stroke="${ink}" stroke-width="3"/><circle cx="${n1(kx - 6)}" cy="${n1(ky - 2)}" r="5" fill="${ink}"/><circle cx="${n1(kx + 9)}" cy="${n1(ky + 3)}" r="4" fill="${ink}"/></g>`;
  s += `<path d="M${CX - 34} ${cy - 4} A34 30 0 0 1 ${CX + 34} ${cy - 4} Z" fill="${ground}" stroke="${ink}" stroke-width="4"/>`;
  s += `<ellipse cx="${CX}" cy="${cy + 2}" rx="96" ry="20" fill="${ink}"/>`;
  for (let i = -3; i <= 3; i++) s += `<circle cx="${CX + i * 24}" cy="${cy + 4 + Math.abs(i) * -1}" r="4.5" fill="${ground}"/>`;
  return s;
}

function palms(rng: Rng, ink: string, ground: string, top: number, h: number) {
  const horizon = top + h * 0.66;
  const r = 78;
  let s = `<clipPath id="sun"><rect x="${X0}" y="${top}" width="${IW}" height="${n1(horizon - top)}"/></clipPath><g clip-path="url(#sun)"><circle cx="${CX}" cy="${n1(horizon)}" r="${r}" fill="${ink}"/>`;
  for (let i = 0; i < 6; i++) s += `<rect x="${CX - r}" y="${n1(horizon - 8 - i * 11)}" width="${2 * r}" height="${n1(Math.max(1, 6 - i))}" fill="${ground}"/>`;
  s += `</g>`;
  for (let y = horizon + 6, k = 0; y < top + h; y += 8, k++) s += `<line x1="${n1(CX - 30 - k * 14)}" y1="${n1(y)}" x2="${n1(CX + 30 + k * 14)}" y2="${n1(y)}" stroke="${ink}" stroke-width="2" stroke-dasharray="${10 + k * 4} 6"/>`;
  for (const [bx, lean, sc] of [[X0 + range(rng, 30, 60), 1, 1], [X0 + IW - range(rng, 30, 60), -1, 0.8]] as const) {
    const tx = bx + lean * 40 * sc;
    const ty = top + h * (0.18 + (1 - sc) * 0.3);
    const base = top + h - 4;
    s += `<path d="M${n1(bx)} ${n1(base)} Q${n1(bx + lean * 8)} ${n1((base + ty) / 2)} ${n1(tx)} ${n1(ty)}" fill="none" stroke="${ground}" stroke-width="${n1(14 * sc)}" stroke-linecap="round"/>`;
    s += `<path d="M${n1(bx)} ${n1(base)} Q${n1(bx + lean * 8)} ${n1((base + ty) / 2)} ${n1(tx)} ${n1(ty)}" fill="none" stroke="${ink}" stroke-width="${n1(9 * sc)}" stroke-linecap="round"/>`;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI + (i / 6) * Math.PI + range(rng, -0.1, 0.1);
      const L = range(rng, 44, 58) * sc;
      const ex = tx + Math.cos(a) * L;
      const ey = ty + Math.sin(a) * L * 0.55 + L * 0.35;
      const mx = tx + Math.cos(a) * L * 0.5;
      const my = ty + Math.sin(a) * L * 0.55 - 8;
      s += `<path d="M${n1(tx)} ${n1(ty)} Q${n1(mx)} ${n1(my - 6)} ${n1(ex)} ${n1(ey)} Q${n1(mx)} ${n1(my + 6)} ${n1(tx)} ${n1(ty)} Z" fill="${ink}" stroke="${ground}" stroke-width="1.5"/>`;
    }
  }
  return s;
}

function dna(rng: Rng, ink: string, ground: string, top: number, h: number) {
  const amp = range(rng, 48, 62);
  const turns = range(rng, 1.6, 2.3);
  const phase = range(rng, 0, Math.PI);
  const pt = (t: number, off: number): P => [CX + Math.sin(t * turns * Math.PI * 2 + phase + off) * amp, top + 8 + t * (h - 16)];
  let s = "";
  for (let i = 0; i <= 22; i++) {
    const t = i / 22;
    const [x1, y] = pt(t, 0);
    const [x2] = pt(t, Math.PI);
    s += `<line x1="${n1(x1)}" y1="${n1(y)}" x2="${n1(x2)}" y2="${n1(y)}" stroke="${ink}" stroke-width="3"/>`;
    s += `<circle cx="${n1((x1 + x2) / 2)}" cy="${n1(y)}" r="2.2" fill="${ground}" stroke="${ink}" stroke-width="1.5"/>`;
  }
  for (const off of [Math.PI, 0]) {
    const p = Array.from({ length: 61 }, (_, i) => pt(i / 60, off));
    s += line(smooth(p), ground, 12) + line(smooth(p), ink, 7);
  }
  return s;
}

function atom(rng: Rng, ink: string, ground: string, top: number, h: number) {
  const cy = top + h / 2;
  const rx = Math.min(IW * 0.44, h * 0.5);
  const ry = rx * 0.34;
  const base = range(rng, 0, 60);
  let s = "";
  for (let k = 0; k < 3; k++) {
    const rot = base + k * 60;
    s += `<ellipse cx="${CX}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" transform="rotate(${n1(rot)} ${CX} ${n1(cy)})" fill="none" stroke="${ink}" stroke-width="4"/>`;
    const a = range(rng, 0, Math.PI * 2);
    const ex = Math.cos(a) * rx;
    const ey = Math.sin(a) * ry;
    const rr = (rot * Math.PI) / 180;
    s += `<circle cx="${n1(CX + ex * Math.cos(rr) - ey * Math.sin(rr))}" cy="${n1(cy + ex * Math.sin(rr) + ey * Math.cos(rr))}" r="8" fill="${ink}" stroke="${ground}" stroke-width="3"/>`;
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = i === 0 ? 0 : 7 + (i % 3) * 3;
    s += `<circle cx="${n1(CX + Math.cos(a) * r)}" cy="${n1(cy + Math.sin(a) * r)}" r="8" fill="${i % 2 ? ink : ground}" stroke="${ink}" stroke-width="2.5"/>`;
  }
  return s;
}

function dove(rng: Rng, ink: string, ground: string, top: number, h: number) {
  const s0 = Math.min(IW, h) / 100;
  const ox = CX - 50 * s0;
  const oy = top + h / 2 - 50 * s0;
  const body = "M12 58 Q30 50 44 54 Q52 30 78 8 Q70 34 66 52 Q80 46 94 50 Q82 58 66 62 Q56 76 34 72 Q24 70 18 64 L6 66 Z";
  const wing = "M44 54 Q44 34 30 16 Q52 26 58 50 Z";
  let s = `<g transform="translate(${n1(ox)} ${n1(oy)}) scale(${n1(s0 * 1000) / 1000})">`;
  s += `<path d="${body}" fill="${ink}" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"/>`;
  s += `<path d="${wing}" fill="${ground}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>`;
  s += `<circle cx="16" cy="60" r="1.6" fill="${ground}"/>`;
  s += `<path d="M6 66 Q-6 72 -14 84" fill="none" stroke="${ink}" stroke-width="2"/>`;
  for (let i = 0; i < 4; i++) s += `<path d="M${-2 - i * 3.5} ${71 + i * 3.5} q${-6 - rng() * 2} -2 ${-9} ${3} q${5} ${3} ${9} ${-3} Z" fill="${ink}"/>`;
  s += `</g>`;
  return s;
}

function anchor(rng: Rng, ink: string, ground: string, top: number, h: number) {
  const k = Math.min(IW, h) / 100;
  let s = `<g transform="translate(${n1(CX - 50 * k)} ${n1(top + h / 2 - 50 * k)}) scale(${n1(k * 1000) / 1000})" fill="none" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round">`;
  s += `<circle cx="50" cy="12" r="7" stroke-width="5"/><path d="M50 19 V90" stroke-width="7"/><path d="M32 30 H68" stroke-width="6"/>`;
  s += `<path d="M14 62 Q18 88 50 90 Q82 88 86 62" stroke-width="7"/><path d="M8 68 L14 58 L22 66 Z M92 68 L86 58 L78 66 Z" fill="${ink}" stroke-width="3"/>`;
  s += `<path d="M50 20 Q70 30 44 44 Q28 54 56 62 Q72 70 46 78" stroke="${ground}" stroke-width="6"/><path d="M50 20 Q70 30 44 44 Q28 54 56 62 Q72 70 46 78" stroke-width="2.5" stroke-dasharray="${n1(4 + rng() * 2)} 3"/>`;
  s += `</g>`;
  return s;
}

function plane(rng: Rng, ink: string, ground: string, top: number, h: number) {
  const px = CX + 50;
  const py = top + h * 0.3;
  let s = `<path d="M${X0 + 10} ${n1(top + h - 20)} C${X0 + 60} ${n1(top + h * 0.3)} ${CX - 60} ${n1(top + h * 1.0)} ${CX - 30} ${n1(top + h * 0.55)} S${CX + 10} ${n1(top + h * 0.35)} ${px - 40} ${n1(py + 20)}" fill="none" stroke="${ink}" stroke-width="2.5" stroke-dasharray="7 6" stroke-linecap="round"/>`;
  s += `<g transform="rotate(${n1(range(rng, -18, -6))} ${px} ${n1(py)})"><path d="M${px - 60} ${n1(py + 10)} L${px + 60} ${n1(py - 26)} L${px - 18} ${n1(py + 34)} Z" fill="${ground}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="M${px - 18} ${n1(py + 34)} L${px - 10} ${n1(py + 14)} L${px + 60} ${n1(py - 26)} M${px - 10} ${n1(py + 14)} L${px - 60} ${n1(py + 10)}" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="M${px - 18} ${n1(py + 34)} L${px - 10} ${n1(py + 14)} L${px - 4} ${n1(py + 26)} Z" fill="${ink}"/></g>`;
  return s;
}

const MOTIFS = { ufo, palms, dna, atom, dove, anchor, plane };

export const motif: Generator = (rng, ink, ground) => {
  const kind = pick(rng, Object.keys(MOTIFS) as (keyof typeof MOTIFS)[]);
  const cap = pick(rng, MOTIF_CAPTIONS[kind]);
  const capTop = rng() < 0.4;
  const capH = 60;
  const artTop = capTop ? Y0 + capH + 12 : Y0 + 8;
  const artH = IH - capH - 24;
  let body = toneDefs(ink);
  body += `<clipPath id="mo"><rect x="${X0}" y="${n1(artTop)}" width="${IW}" height="${n1(artH)}"/></clipPath><g clip-path="url(#mo)">${MOTIFS[kind](rng, ink, ground, artTop, artH)}</g>`;
  body += caption(cap, capTop ? Y0 : Y0 + IH - capH, capH, ink, 34);
  return {
    body,
    variant: `iconic-${kind}`,
    sig: { key: `motif-${kind}`, vec: [capTop ? 1 : 0] },
    description: `A bold ${kind === "palms" ? "palm-and-sunset" : kind === "plane" ? "paper plane" : kind} icon with the caption “${cap}”.`,
    complexity: 0.45,
    features: {
      ...iconicFeatures(rng), wit: range(rng, 0.6, 0.82), typography: range(rng, 0.5, 0.65), retro: kind === "palms" || kind === "ufo" ? range(rng, 0.65, 0.8) : range(rng, 0.35, 0.5), geometric: kind === "atom" || kind === "dna" ? range(rng, 0.55, 0.7) : range(rng, 0.25, 0.4),
      nature: kind === "palms" || kind === "dove" ? range(rng, 0.5, 0.65) : 0.08, line_art: range(rng, 0.4, 0.6), density: range(rng, 0.38, 0.52), clean_minimal: range(rng, 0.5, 0.68), halftone_raster: kind === "ufo" ? 0.3 : 0.08, dark_industrial: range(rng, 0.25, 0.4), classic: 0.1,
    },
  };
};


