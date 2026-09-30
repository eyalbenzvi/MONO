/**
 * Your World Tour: a band tour's shirt in the condensed face. The name huge,
 * the tour spaced under it between stars, the years it ran, then the dates
 * in two columns (the year bold, the city after it), a rule between them.
 */
import { CAP, INK, STROKE, caption, captionLines, clip, f1, fitSize, line, text, textWidth, type Lines, house } from "../kit";
import { unpackPlaces } from "../specKit";
import { TOUR_MAX, TOUR_MIN, type Params } from "../specs/tour";
import { loadCities } from "../data";
import type { City, CustomSpec } from "../spec";
import type { RenderData } from "../renderers";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const COND = "condensed" as const;

function datesOf(p: Params, places: City[]): { city?: City; y?: number }[] {
  const byId = new Map(places.map((c) => [c.id, c]));
  return (unpackPlaces(p.x, { min: TOUR_MIN, max: TOUR_MAX }) ?? []).map((r) => ({ city: byId.get(r.c), y: r.y }));
}

/** The years the tour ran: "1990–2026", one year, or none. */
function span(dates: { y?: number }[]): string {
  const ys = dates.flatMap((d) => (d.y ? [d.y] : []));
  if (!ys.length) return "";
  const [a, b] = [Math.min(...ys), Math.max(...ys)];
  return a === b ? String(a) : `${a}–${b}`;
}

/** The caption's lines (ours). */
export function tourCaption(p: Params, places: City[] = []): Lines {
  const dates = datesOf(p, places);
  const cities = new Set(dates.map((d) => d.city?.id)).size;
  return [`${p.n}: ${p.t}`.length <= 24 ? `${p.n}: ${p.t}` : p.t, `${dates.length} dates · ${cities} ${cities === 1 ? "city" : "cities"}${span(dates) ? ` · ${span(dates)}` : ""}`, "No support act. Some dates sold out"];
}

/** A five-pointed star as one path, outlined. */
function star(cx: number, cy: number, r: number): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.42 : r;
    d += `${i ? "L" : "M"}${f1(cx + rr * Math.cos(a))} ${f1(cy + rr * Math.sin(a))}`;
  }
  return `<path d="${d}Z" fill="none" stroke="${INK}" stroke-width="${STROKE.fine}" stroke-linejoin="round"/>`;
}

export function tourBody(p: Params, places: City[] = []): string {
  const dates = datesOf(p, places);
  // The name huge: sized to the measure (a short name and a long one both fill it), lightly tracked.
  const name = p.n.toUpperCase();
  const NT = 0.03;
  const ns = fitSize(name, 244, 64, { family: COND, bold: true, track: NT, floor: 5 });
  const nameTop = 30;
  let s = text(150, nameTop + ns * CAP.condensed, clip(name, 244, ns, { family: COND, bold: true, spacing: ns * NT }), ns, { family: COND, bold: true, spacing: Math.round(ns * NT * 10) / 10 });
  let y = nameTop + ns * CAP.condensed + 26;
  // The tour, spaced wide between two stars.
  const title = p.t.toUpperCase();
  const TT = 0.15;
  const ts = fitSize(title, 190, 20, { family: COND, track: TT, floor: 5 });
  const tset = clip(title, 190, ts, { family: COND, spacing: ts * TT });
  const tw = textWidth(tset, ts, { family: COND, spacing: ts * TT }) - ts * TT;
  const tc = y - (ts * CAP.condensed) / 2;
  s += text(150 + (ts * TT) / 2, y, tset, ts, { family: COND, spacing: Math.round(ts * TT * 10) / 10 }) + star(150 - tw / 2 - 13, tc, 6) + star(150 + tw / 2 + 13, tc, 6);
  y += 18;
  const years = span(dates);
  if (years) s += text(150, y, years, 12, { family: COND, bold: true, spacing: 1.2 });
  y += 12;
  s += line(40, y, 260, y, STROKE.regular) + line(40, y + 3, 260, y + 3, STROKE.hairline);
  // The dates, down two columns (the first column filled first), either side of a hairline on the centre.
  const perCol = Math.ceil(dates.length / 2);
  const room = 296 - (y + 14);
  const pitch = Math.min(34, room / perCol);
  const size = Math.min(14, pitch * 0.62);
  const top = y + 14 + (room - pitch * (perCol - 1)) / 2 - size * 0.2;
  const colW = 102;
  const yearW = textWidth("0000", size, { family: COND, bold: true }) + 0.35 * size;
  // Every city at one size, as a tour shirt's list is set: the longest sets it (never under 0.45 of the years, nor the face’s
  // smallest), and a name longer still is cut.
  const CT = 0.04;
  const cityRoom = colW - yearW;
  const cities = dates.map((d) => (d.city?.name ?? "?").toUpperCase());
  const floor = Math.min(size, Math.max(5, size * 0.45));
  const cs = Math.max(floor, Math.min(size, ...cities.map((c) => fitSize(c, cityRoom, size, { family: COND, track: CT }))));
  dates.forEach((d, i) => {
    const col = i < perCol ? 0 : 1;
    const row = col ? i - perCol : i;
    const x = col ? 158 : 40;
    const yy = top + row * pitch + size * 0.4;
    s += text(x, yy, d.y ? String(d.y) : "—", size, { family: COND, bold: true, anchor: "start" });
    s += text(x + yearW, yy, clip(cities[i], cityRoom, cs, { family: COND, spacing: cs * CT }), cs, { family: COND, anchor: "start", spacing: Math.round(cs * CT * 100) / 100 });
  });
  s += line(150, top - size, 150, top + (perCol - 1) * pitch + size * 0.8, STROKE.hairline);
  // The foot, as a tour shirt's.
  s += line(40, 302, 260, 302, STROKE.hairline) + line(40, 305, 260, 305, STROKE.regular);
  s += text(150, 318, "ALL AGES · NO RE-ENTRY · MERCHANDISE AT THE DOOR", 6.5, { family: COND, spacing: 0.8 });
  return s + caption(344, ...captionLines(tourCaption(p, places), p.cap));
}

export const captionOf = (spec: CustomSpec, data: RenderData = {}) => tourCaption((spec as { p: Params }).p, data.places ?? []);

export const render = (spec: CustomSpec, color: BaseColor, data: RenderData = {}) => house(() => wrap(tourBody((spec as { p: Params }).p, data.places ?? []), color));

/** The place list, for the index cards and the bag (the editor passes its own). */
export async function prepare(): Promise<RenderData> {
  return { places: (await loadCities()).list };
}
