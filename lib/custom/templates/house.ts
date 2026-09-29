/**
 * Your House: your house as an architect's elevation, in the catalogue's
 * architecture set's hand (lib/custom/draw/architecture): brickwork hatched
 * course by course (true brick proportions, broken at every opening),
 * windows with reveals and sills, a cornice from the orders' entablature
 * when the roof is flat, a dimension line and a scale bar. Storey heights
 * follow Vignola's superposed orders: the ground storey the tallest, each
 * one above a tenth lower (never under three quarters). The drawing is
 * fitted to the print; past eight floors the hatching takes a coarser
 * module, so its lines never crowd under the smallest stroke that prints.
 */
import { INK, caption, captionLines, f1, line, rect, text, type Lines } from "../kit";
import { ORDERS } from "../draw/architecture";
import type { CustomSpec, HouseParams } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

/** In metres: a bay (window and pier), the side piers, the plinth, the ground storey. */
const BAY = 1.5, PIER = 0.5, PLINTH = 0.45, GROUND = 3.4;
/** Brick courses (75 mm with the joint) and a stretcher with its joint (225 mm). */
const COURSE = 0.075, BRICK = 0.225;
const AREA = { w: 232, h: 246 };
const BASE = 294;
/** Hatching never closer than this (print units): the finest line a tee takes, with air between. */
const MIN_GAP = 2.6;

const ROOF_NAME: Record<HouseParams["r"], string> = { flat: "Flat roof", pitched: "Pitched roof", stepped: "Stepped gable", dome: "Dome" };

export function houseBody(p: HouseParams): string {
  // Storey heights after Vignola: each order above is a tenth lower than the one below.
  const storeys = Array.from({ length: p.fl }, (_, i) => Math.max(GROUND * 0.75, GROUND * 0.9 ** i));
  const W = p.wn * BAY + 2 * PIER;
  const wallH = PLINTH + storeys.reduce((a, b) => a + b, 0);
  const tuscan = ORDERS[0][1];
  const roofH = p.r === "flat" ? GROUND / 4 + 0.3 : p.r === "pitched" ? W * 0.32 : p.r === "stepped" ? W * 0.45 : W * 0.42;
  const k = Math.min(AREA.w / W, AREA.h / (wallH + roofH));
  const X0 = 150 - (W * k) / 2, X1 = 150 + (W * k) / 2;
  const top = BASE - wallH * k;
  const m = (v: number) => v * k;
  let s = "";

  // The openings: every bay's window on every floor; the door replaces one ground-floor window.
  const doorBay = p.dr === "l" ? 0 : p.dr === "r" ? p.wn - 1 : Math.floor((p.wn - 1) / 2);
  const openings: { x: number; y: number; w: number; h: number; door: boolean }[] = [];
  let y = BASE - m(PLINTH);
  storeys.forEach((h, floor) => {
    for (let b = 0; b < p.wn; b++) {
      const bx = X0 + m(PIER + b * BAY);
      const door = floor === 0 && b === doorBay;
      const ow = m(door ? 1.1 : 0.85), oh = m(door ? Math.min(h * 0.78, 2.5) : h * 0.5);
      const ox = bx + (m(BAY) - ow) / 2, oy = door ? y - oh : y - h * k * 0.3 - oh;
      openings.push({ x: ox, y: oy, w: ow, h: oh, door });
    }
    y -= m(h);
  });

  // Brickwork: bed joints every course (grouped when a course is too fine to hatch), perpends staggered, broken at the openings.
  const coarse = p.fl > 8 ? 2 : 1;
  let step = COURSE * coarse;
  while (m(step) < MIN_GAP) step += COURSE * coarse;
  const brick = BRICK * Math.max(1, Math.round(step / COURSE / 2));
  const inOpening = (x: number, yy: number) => openings.some((o) => x > o.x - 0.5 && x < o.x + o.w + 0.5 && yy > o.y - 0.5 && yy < o.y + o.h + 0.5);
  let d = "";
  let row = 0;
  for (let yy = BASE - m(PLINTH); yy > top + 0.5; yy -= m(step), row++) {
    // A bed joint, as runs between the openings.
    let run: number | null = null;
    for (let x = X0; x <= X1 + 0.01; x += 1) {
      const open = inOpening(x, yy);
      if (!open && run === null) run = x;
      if ((open || x > X1 - 0.5) && run !== null) {
        if (x - run > 1) d += `M${f1(run)} ${f1(yy)}H${f1(Math.min(x, X1))}`;
        run = null;
      }
    }
    // Perpends: a brick's length apart, half a brick over every other course.
    const next = yy - m(step);
    for (let x = X0 + (row % 2 ? m(brick) / 2 : m(brick)); x < X1 - 1; x += m(brick)) if (!inOpening(x, yy - 1) && !inOpening(x, next + 1) && next > top) d += `M${f1(x)} ${f1(yy)}V${f1(next)}`;
  }
  s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".55"/>`;

  // The wall's outline and the plinth.
  s += rect(X0, top, X1 - X0, BASE - top, 1.4) + line(X0, BASE - m(PLINTH), X1, BASE - m(PLINTH), 1);
  // Openings: reveals (a second outline inside), sills, glazing bars; the door's panels and number.
  for (const o of openings) {
    const r = Math.max(1.2, m(0.07));
    s += `<rect x="${f1(o.x)}" y="${f1(o.y)}" width="${f1(o.w)}" height="${f1(o.h)}" fill="none" stroke="${INK}" stroke-width="1"/>` + rect(o.x + r, o.y + r, o.w - 2 * r, o.h - 2 * r, 0.6);
    if (o.door) {
      s += line(o.x + o.w / 2, o.y + r, o.x + o.w / 2, o.y + o.h, 0.6) + rect(o.x + r * 2, o.y + o.h * 0.15, o.w / 2 - r * 3, o.h * 0.3, 0.5) + rect(o.x + o.w / 2 + r, o.y + o.h * 0.15, o.w / 2 - r * 3, o.h * 0.3, 0.5);
      if (p.no !== undefined) s += text(o.x + o.w / 2, o.y - Math.max(3, m(0.2)), String(p.no), Math.max(5, Math.min(11, m(0.45))), { bold: true });
    } else {
      s += line(o.x + o.w / 2, o.y + r, o.x + o.w / 2, o.y + o.h - r, 0.5) + line(o.x + r, o.y + o.h * 0.45, o.x + o.w - r, o.y + o.h * 0.45, 0.5);
      s += line(o.x - m(0.08), o.y + o.h + Math.max(1, m(0.06)), o.x + o.w + m(0.08), o.y + o.h + Math.max(1, m(0.06)), 1.2);
    }
  }

  // The roof.
  const cx = 150;
  if (p.r === "flat") {
    // The orders' entablature, a quarter of a Tuscan column of one storey: architrave, frieze, cornice.
    const e = m(GROUND / 4);
    s += rect(X0, top - e * 0.3, X1 - X0, e * 0.3, 1) + rect(X0, top - e * 0.65, X1 - X0, e * 0.35, 0.7) + rect(X0 - m(0.25), top - e, X1 - X0 + m(0.5), e * 0.35, 1.2);
    for (let x = X0 + m(0.3); x < X1 - 1; x += Math.max(4, m(0.45))) s += line(x, top - e * 0.65, x, top - e * 0.35, 0.5);
    void tuscan;
  } else if (p.r === "pitched") {
    const h = m(roofH);
    s += `<path d="M${f1(X0 - m(0.3))} ${f1(top)}L${f1(cx)} ${f1(top - h)}L${f1(X1 + m(0.3))} ${f1(top)}Z" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
    // Roof tiles as courses along the slope.
    for (let t = 1; t < 7; t++) {
      const f = t / 7;
      s += line(X0 - m(0.3) + (cx - X0 + m(0.3)) * f, top - h * f, X1 + m(0.3) - (X1 + m(0.3) - cx) * f, top - h * f, 0.5);
    }
  } else if (p.r === "stepped") {
    // A crow-stepped gable: five steps each side up to a finial.
    const steps = 5, h = m(roofH), sw = (X1 - X0) / 2 / (steps + 0.5);
    let pts = `M${f1(X0)} ${f1(top)}`;
    for (let i = 0; i < steps; i++) pts += `V${f1(top - (h * (i + 1)) / (steps + 1))}H${f1(X0 + sw * (i + 1))}`;
    pts += `V${f1(top - h)}H${f1(X1 - sw * steps)}`;
    for (let i = steps - 1; i >= 0; i--) pts += `V${f1(top - (h * (i + 1)) / (steps + 1))}H${f1(X1 - sw * i)}`;
    pts += `V${f1(top)}`;
    s += `<path d="${pts}" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
    s += rect(cx - m(0.35), top - h * 0.62, m(0.7), m(0.9), 0.8);
  } else {
    // A dome on a drum: the drum a fifth of the dome's height, ribs and a lantern.
    const R = Math.min((X1 - X0) / 2 * 0.8, m(roofH) * 0.8);
    const drum = m(roofH) * 0.18;
    s += rect(cx - R, top - drum, 2 * R, drum, 1.2);
    s += `<path d="M${f1(cx - R)} ${f1(top - drum)}A${f1(R)} ${f1(R)} 0 0 1 ${f1(cx + R)} ${f1(top - drum)}" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
    for (const f of [-0.6, -0.25, 0.25, 0.6]) s += `<path d="M${f1(cx + f * R)} ${f1(top - drum)}Q${f1(cx + f * R * 0.8)} ${f1(top - drum - R * 0.9)} ${f1(cx)} ${f1(top - drum - R)}" fill="none" stroke="${INK}" stroke-width=".6"/>`;
    s += rect(cx - m(0.3), top - drum - R - m(0.9), m(0.6), m(0.9), 0.9);
  }

  // A narrow house stands in its terrace: the neighbours in outline only, as an elevation shows what it adjoins.
  const side = (AREA.w - (X1 - X0)) / 2;
  if (side > 14) {
    const nfl = [Math.max(1, Math.min(p.fl, 4) - 1), Math.min(p.fl, 4)];
    let nd = "";
    [-1, 1].forEach((dir, i) => {
      const wallX = dir < 0 ? X0 : X1, farX = wallX + dir * side;
      let yy = BASE - m(PLINTH);
      const hs = Array.from({ length: nfl[i] }, (_, f) => Math.max(GROUND * 0.75, GROUND * 0.9 ** f));
      const nTop = BASE - m(PLINTH + hs.reduce((a, b) => a + b, 0));
      nd += `M${f1(farX)} ${f1(nTop)}H${f1(wallX)}M${f1(farX)} ${f1(BASE - m(PLINTH))}H${f1(wallX)}`;
      // A parapet a course of stone above the roof line.
      nd += `M${f1(farX)} ${f1(nTop - Math.max(2, m(0.3)))}H${f1(wallX)}`;
      hs.forEach((h) => {
        for (let b = 0; ; b++) {
          const bx = wallX + dir * m(PIER + b * BAY), ow = m(0.85), ox = bx + dir * (m(BAY) - ow) / 2 - (dir < 0 ? ow : 0);
          if (Math.min(ox, ox + ow) < 150 - AREA.w / 2 || Math.max(ox, ox + ow) > 150 + AREA.w / 2) break;
          const oh = m(h * 0.5), oy = yy - h * k * 0.3 - oh;
          nd += `M${f1(ox)} ${f1(oy)}h${f1(ow)}v${f1(oh)}h${f1(-ow)}ZM${f1(ox + ow / 2)} ${f1(oy)}v${f1(oh)}`;
        }
        yy -= m(h);
      });
    });
    s += `<path d="${nd}" fill="none" stroke="${INK}" stroke-width=".75"/>`;
  }

  // The dimension line across the front, and a scale bar in metres.
  // The ground in section under the whole sheet: a hatched band, as an elevation stands the building on it.
  let g = "";
  for (let x = 150 - 126; x < 150 + 126; x += 4) g += `M${f1(x)} ${f1(BASE + 5)}L${f1(x + 5)} ${f1(BASE)}`;
  s += `<path d="${g}" fill="none" stroke="${INK}" stroke-width=".55"/>` + line(150 - 128, BASE, 150 + 128, BASE, 1.6);
  const dy = BASE + 12;
  s += line(X0, dy, X1, dy, 0.6) + line(X0, dy - 3, X0, dy + 3, 0.8) + line(X1, dy - 3, X1, dy + 3, 0.8) + text(150, dy + 8, `${W.toFixed(1)} m`, 6);
  const unit = [1, 2, 5, 10].find((u) => m(u) >= 14) ?? 10;
  const sx = 150 - m(unit * 2) / 2, sy = dy + 18;
  for (let i = 0; i < 2; i++) s += rect(sx + i * m(unit), sy, m(unit), 3, 0.7);
  s += text(sx, sy + 10, "0", 5) + text(sx + m(unit), sy + 10, String(unit), 5) + text(sx + m(unit * 2), sy + 10, `${unit * 2} m`, 5);

  return s + caption(348, ...captionLines(houseCaption(p), p.cap));
}

/** The caption's lines (ours): the number (or the house's words, or "Elevation"), then the words and the floors. */
export function houseCaption(p: HouseParams): Lines {
  const title = p.no !== undefined ? `No. ${p.no}` : (p.w ?? "Elevation");
  const floors = `${p.fl} ${p.fl === 1 ? "floor" : "floors"} · ${ROOF_NAME[p.r]}`;
  return [title, p.no !== undefined && p.w ? p.w : floors, p.no !== undefined && p.w ? floors : undefined];
}

export const captionOf = (spec: CustomSpec) => houseCaption((spec as { p: HouseParams }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(houseBody((spec as { p: HouseParams }).p), color);
