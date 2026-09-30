/**
 * Your Signpost, in line drawing. A post on the ground with a finial and a
 * plate for home, and a board for each place stacked down it, pointing east
 * or west as the place lies, lettered with the city and its distance along
 * the great circle, a small arrow on each at the true initial bearing (north
 * up), and a compass at the foot. "Since": two boards pointing at each other's
 * city, and a plate with the distance and the year.
 */
import { DEG, INK, caption, captionLines, circle, f1, line, text, textWidth, type Lines } from "../kit";
import { unpackPlaces } from "../specKit";
import type { Params } from "../specs/signpost";
import { loadCities } from "../data";
import type { City, CustomSpec } from "../spec";
import type { RenderData } from "../renderers";
import { GROUND, wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const COND = "condensed" as const;
const R_EARTH = 6371.0088;

/** The great-circle distance in kilometres, and the initial bearing in degrees from north. */
export function greatCircle(a: Pick<City, "lat" | "lon">, b: Pick<City, "lat" | "lon">): { km: number; bearing: number } {
  const [p1, p2] = [a.lat * DEG, b.lat * DEG];
  const dl = (b.lon - a.lon) * DEG;
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const km = 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return { km, bearing: ((Math.atan2(y, x) / DEG) % 360 + 360) % 360 };
}

const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const dist = (km: number, mi?: 1) => (mi ? `${thousands(km / 1.609344)} mi` : `${thousands(km)} km`);

interface Board {
  city: City;
  km: number;
  bearing: number;
}

function boardsOf(p: Params, places: City[]): { home?: City; boards: Board[] } {
  const byId = new Map(places.map((c) => [c.id, c]));
  const home = byId.get(p.h);
  const rows = unpackPlaces(p.x, { min: 1, max: 6, years: false }) ?? [];
  const boards: Board[] = [];
  for (const r of rows) {
    const city = byId.get(r.c);
    if (home && city) boards.push({ city, ...greatCircle(home, city) });
  }
  return { home, boards };
}

/** The caption's lines (ours). */
export function signpostCaption(p: Params, places: City[] = []): Lines {
  const { home, boards } = boardsOf(p, places);
  if (p.k === "since") {
    const b = boards[0];
    const both = home && b ? `${home.name} to ${b.city.name}` : "";
    return [both && both.length <= 24 ? both : "Two places", b ? `${dist(b.km, p.mi)} apart` : undefined, `Since ${p.y}`];
  }
  const far = boards.length ? Math.max(...boards.map((b) => b.km)) : 0;
  return [home && home.name.length <= 19 ? `From ${home.name}` : "From home", boards.length ? `${boards.length} ${boards.length === 1 ? "place" : "places"} · ${dist(far, p.mi)} at the farthest` : undefined, "Distances along the great circle"];
}

/** A small arrow at a bearing (north up), centred at (x, y): its coordinates turned, not the element. */
function bearingArrow(x: number, y: number, deg: number, len: number): string {
  const [s, c] = [Math.sin(deg * DEG), -Math.cos(deg * DEG)];
  const at = (u: number, v: number) => `${f1(x + u * s - v * c)} ${f1(y + u * c + v * s)}`;
  return `<path d="M${at(-len / 2, 0)}L${at(len / 2, 0)}M${at(len / 2 - 3.2, -2.4)}L${at(len / 2, 0)}L${at(len / 2 - 3.2, 2.4)}" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** The widest a board's lettering may be: from the post's edge to the print's margin, less the arrow, the padding and the point. */
const labelRoom = (h: number) => 150 - 8 - 14 - 34 - h * 0.5;

/** A board on the post: from the post's edge out to one side, its outer end a point. */
function board(side: 1 | -1, y: number, h: number, label: string, size: number, arrowDeg: number): string {
  const x0 = 150 + side * 8;
  const w = textWidth(label, size, { family: COND, bold: true, spacing: 0.6 }) + 34;
  const x1 = x0 + side * w;
  const tip = x1 + side * h * 0.5;
  const d = `M${f1(x0)} ${f1(y)}H${f1(x1)}L${f1(tip)} ${f1(y + h / 2)}L${f1(x1)} ${f1(y + h)}H${f1(x0)}Z`;
  const inner = `M${f1(x0 + side * 3)} ${f1(y + 3)}H${f1(x1)}L${f1(tip - side * 4)} ${f1(y + h / 2)}L${f1(x1)} ${f1(y + h - 3)}H${f1(x0 + side * 3)}Z`;
  let s = `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><path d="${inner}" fill="none" stroke="${INK}" stroke-width=".4" stroke-linejoin="round"/>`;
  s += bearingArrow(x0 + side * 12, y + h / 2, arrowDeg, 12);
  s += text(x0 + side * 22, y + h / 2 + size * 0.36, label, size, { family: COND, bold: true, anchor: side > 0 ? "start" : "end", spacing: 0.6 });
  return s;
}

/** The post, the ground and the finial. */
function post(top: number): string {
  let s = `<path d="M146 ${top}V292M154 ${top}V292M146 ${top}L150 ${top - 9}L154 ${top}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
  s += line(40, 292, 260, 292, 1);
  // Tufts of grass along the ground.
  let d = "";
  for (let x = 48; x < 256; x += 13) if (Math.abs(x - 150) > 12) d += `M${x} 292l-2-6M${x + 2} 292l1-7M${x + 4} 292l3-5`;
  return s + `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".6" stroke-linecap="round"/>`;
}

/** The compass at the foot: a ring, its ticks, N at the top. */
function compass(x: number, y: number): string {
  let s = circle(x, y, 13, 0.9);
  let d = "";
  for (let a = 0; a < 360; a += 45) {
    const [sn, c] = [Math.sin(a * DEG), -Math.cos(a * DEG)];
    const r0 = a % 90 ? 10 : 8;
    d += `M${f1(x + sn * r0)} ${f1(y + c * r0)}L${f1(x + sn * 13)} ${f1(y + c * 13)}`;
  }
  s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".7"/>` + bearingArrow(x, y, 0, 14);
  return s + text(x, y - 17, "N", 8, { family: COND, bold: true });
}

export function signpostBody(p: Params, places: City[] = []): string {
  const { home, boards } = boardsOf(p, places);
  let s = "";
  if (p.k === "since") {
    const b = boards[0];
    s += post(70);
    if (home && b) {
      const back = greatCircle(b.city, home);
      const la = home.name.toUpperCase(), lb = b.city.name.toUpperCase();
      const size = Math.min(15, ...[la, lb].map((l) => (15 * labelRoom(30)) / (textWidth(l, 15, { family: COND, bold: true }) + l.length * 0.6 * 1.05)));
      // Each board names the other city and points at it from its own.
      s += board(Math.sin(b.bearing * DEG) >= 0 ? 1 : -1, 84, 30, lb, size, b.bearing);
      s += board(Math.sin(back.bearing * DEG) >= 0 ? 1 : -1, 126, 30, la, size, back.bearing);
      // The plate: the distance and the year.
      s += `<path d="M92 176H208V240H92Z" fill="${GROUND}" stroke="${INK}" stroke-width="1.1"/><path d="M96 180H204V236H96Z" fill="none" stroke="${INK}" stroke-width=".6"/>`;
      s += text(150, 204, dist(b.km, p.mi).toUpperCase(), 17, { family: COND, bold: true, spacing: 0.8 }) + text(150, 224, `APART SINCE ${p.y}`, 9, { family: COND, spacing: 1.6 });
    }
    return s + compass(250, 270) + caption(344, ...captionLines(signpostCaption(p, places), p.cap));
  }
  const n = boards.length;
  // The boards keep above the compass at the foot.
  const pitch = Math.min(40, 166 / Math.max(1, n));
  const h = Math.min(28, pitch * 0.74);
  const top = 92;
  s += post(top - 34);
  // Home, on a plate at the top.
  const homeName = home ? home.name.toUpperCase() : "HOME";
  // Its letter-spacing counted (a fixed 0.8 a letter, whatever the size), so the words stay on the plate.
  const homeLine = `FROM ${homeName}`;
  const hs = Math.min(9, (90 - homeLine.length * 0.8) / textWidth(homeLine, 1, { family: COND }));
  s += `<path d="M104 ${top - 30}H196V${top - 12}H104Z" fill="${GROUND}" stroke="${INK}" stroke-width="1"/>` + text(150, top - 18, `FROM ${homeName}`, hs, { family: COND, spacing: 0.8 });
  boards.forEach((b, i) => {
    const label = `${b.city.name.toUpperCase()}  ${dist(b.km, p.mi).toUpperCase()}`;
    const size = Math.min(h * 0.46, (h * 0.46 * labelRoom(h)) / (textWidth(label, h * 0.46, { family: COND, bold: true }) + label.length * 0.6 * 1.05));
    s += board(Math.sin(b.bearing * DEG) >= 0 ? 1 : -1, top + i * pitch, h, label, Math.round(size * 10) / 10, b.bearing);
  });
  return s + compass(250, 270) + caption(344, ...captionLines(signpostCaption(p, places), p.cap));
}

export const captionOf = (spec: CustomSpec, data: RenderData = {}) => signpostCaption((spec as { p: Params }).p, data.places ?? []);

export const render = (spec: CustomSpec, color: BaseColor, data: RenderData = {}) => wrap(signpostBody((spec as { p: Params }).p, data.places ?? []), color);

/** The place list, for the index cards and the bag (the editor passes its own). */
export async function prepare(): Promise<RenderData> {
  return { places: (await loadCities()).list };
}
