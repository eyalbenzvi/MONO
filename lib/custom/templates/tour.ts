/**
 * Your World Tour: a band tour's shirt in the condensed face. The name huge,
 * the tour spaced under it between stars, the years it ran, then the dates
 * in two columns (the year bold, the city after it), a rule between them.
 */
import { INK, caption, captionLines, f1, line, text, textWidth, type Lines } from "../kit";
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
  return `<path d="${d}Z" fill="none" stroke="${INK}" stroke-width=".9" stroke-linejoin="round"/>`;
}

export function tourBody(p: Params, places: City[] = []): string {
  const dates = datesOf(p, places);
  const name = p.n.toUpperCase();
  const ns = Math.round(Math.min(64, (64 * 240) / (textWidth(name, 64, { family: COND, bold: true }) + name.length * 2)) * 10) / 10;
  let s = text(150, 30 + ns * 0.78, name, ns, { family: COND, bold: true, spacing: 2 });
  let y = 30 + ns * 0.78 + 26;
  const title = p.t.toUpperCase();
  const ts = Math.round(Math.min(20, (20 * 190) / (textWidth(title, 20, { family: COND }) + title.length * 3)) * 10) / 10;
  const tw = textWidth(title, ts, { family: COND }) + title.length * 3;
  s += text(150, y, title, ts, { family: COND, spacing: 3 }) + star(150 - tw / 2 - 14, y - ts * 0.35, 6) + star(150 + tw / 2 + 12, y - ts * 0.35, 6);
  y += 18;
  const years = span(dates);
  if (years) s += text(150, y, years, 12, { family: COND, bold: true, spacing: 2 });
  y += 12;
  s += line(40, y, 260, y, 1.2) + line(40, y + 3, 260, y + 3, 0.4);
  // The dates, down two columns (the first column filled first).
  const perCol = Math.ceil(dates.length / 2);
  const room = 296 - (y + 14);
  const pitch = Math.min(34, room / perCol);
  const size = Math.min(14, pitch * 0.62);
  const top = y + 14 + (room - pitch * (perCol - 1)) / 2 - size * 0.2;
  const colW = 104;
  dates.forEach((d, i) => {
    const col = i < perCol ? 0 : 1;
    const row = col ? i - perCol : i;
    const x = col ? 162 : 40;
    const yy = top + row * pitch + size * 0.4;
    const yr = d.y ? String(d.y) : "—";
    s += text(x, yy, yr, size, { family: COND, bold: true, anchor: "start" });
    const city = (d.city?.name ?? "?").toUpperCase();
    const left = x + textWidth("0000", size, { family: COND, bold: true }) + 7;
    const cs = Math.round(Math.min(size, (size * (colW - (left - x))) / (textWidth(city, size, { family: COND }) + city.length * 0.4)) * 10) / 10;
    s += text(left, yy, city, cs, { family: COND, anchor: "start", spacing: 0.4 });
  });
  s += line(152, top - size, 152, top + (perCol - 1) * pitch + size * 0.8, 0.6);
  // The foot, as a tour shirt's.
  s += line(40, 302, 260, 302, 0.4) + line(40, 305, 260, 305, 1.2);
  s += text(150, 318, "ALL AGES · NO RE-ENTRY · MERCHANDISE AT THE DOOR", 7, { family: COND, spacing: 1.2 });
  return s + caption(344, ...captionLines(tourCaption(p, places), p.cap));
}

export const captionOf = (spec: CustomSpec, data: RenderData = {}) => tourCaption((spec as { p: Params }).p, data.places ?? []);

export const render = (spec: CustomSpec, color: BaseColor, data: RenderData = {}) => wrap(tourBody((spec as { p: Params }).p, data.places ?? []), color);

/** The place list, for the index cards and the bag (the editor passes its own). */
export async function prepare(): Promise<RenderData> {
  return { places: (await loadCities()).list };
}
