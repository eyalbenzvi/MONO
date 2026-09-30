/**
 * Your Signpost, in line drawing. A post on the ground with a finial and a
 * plate for home, and a board for each place stacked down it, pointing east
 * or west as the place lies, lettered with the city and its distance along
 * the great circle, a small arrow on each at the true initial bearing (north
 * up), and a compass at the foot. "Since": two boards pointing at each other's
 * city, and a plate with the distance and the year.
 */
import { CAP, DEG, INK, STROKE, caption, captionLines, circle, clip, f1, fitSize, line, text, textWidth, type Lines, house } from "../kit";
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
  return `<path d="M${at(-len / 2, 0)}L${at(len / 2, 0)}M${at(len / 2 - 3.2, -2.4)}L${at(len / 2, 0)}L${at(len / 2 - 3.2, 2.4)}" fill="none" stroke="${INK}" stroke-width="${STROKE.regular}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** The widest a board's lettering may be: from the post's edge (8) to the live area's edge (x 22), less the arrow and padding (34) and the point (h / 2). */
const labelRoom = (h: number) => 150 - 22 - 8 - 34 - h * 0.5;

/** A board's outline on the post, `w` long from the post's edge, its outer end a point; a hairline inside. */
function boardShape(side: 1 | -1, y: number, h: number, w: number): string {
  const x0 = 150 + side * 8;
  const x1 = x0 + side * w;
  const tip = x1 + side * h * 0.5;
  const d = `M${f1(x0)} ${f1(y)}H${f1(x1)}L${f1(tip)} ${f1(y + h / 2)}L${f1(x1)} ${f1(y + h)}H${f1(x0)}Z`;
  const inner = `M${f1(x0 + side * 3)} ${f1(y + 3)}H${f1(x1)}L${f1(tip - side * 4)} ${f1(y + h / 2)}L${f1(x1)} ${f1(y + h - 3)}H${f1(x0 + side * 3)}Z`;
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE.regular}" stroke-linejoin="round"/><path d="${inner}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}" stroke-linejoin="round"/>`;
}

/** A board on the post: from the post's edge out to one side, its outer end a point. */
function board(side: 1 | -1, y: number, h: number, label: string, size: number, arrowDeg: number): string {
  const x0 = 150 + side * 8;
  const w = textWidth(label, size, { family: COND, bold: true, spacing: 0.6 }) + 34;
  let s = boardShape(side, y, h, w);
  s += bearingArrow(x0 + side * 12, y + h / 2, arrowDeg, 12);
  s += text(x0 + side * 22, y + h / 2 + (size * CAP.condensed) / 2, label, size, { family: COND, bold: true, anchor: side > 0 ? "start" : "end", spacing: 0.6 });
  return s;
}

/** The post, the ground and the finial. */
function post(top: number): string {
  let s = `<path d="M146 ${top}V292M154 ${top}V292M146 ${top}L150 ${top - 9}L154 ${top}" fill="none" stroke="${INK}" stroke-width="${STROKE.bold}" stroke-linejoin="round"/>`;
  s += line(40, 292, 260, 292, STROKE.fine);
  // Tufts of grass along the ground.
  let d = "";
  for (let x = 48; x < 256; x += 13) if (Math.abs(x - 150) > 12) d += `M${x} 292l-2-6M${x + 2} 292l1-7M${x + 4} 292l3-5`;
  return s + `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE.fine}" stroke-linecap="round"/>`;
}

/** The compass at the foot: a ring, its ticks, N at the top. */
function compass(x: number, y: number): string {
  let s = circle(x, y, 13, STROKE.fine);
  let d = "";
  for (let a = 0; a < 360; a += 45) {
    const [sn, c] = [Math.sin(a * DEG), -Math.cos(a * DEG)];
    const r0 = a % 90 ? 10 : 8;
    d += `M${f1(x + sn * r0)} ${f1(y + c * r0)}L${f1(x + sn * 13)} ${f1(y + c * 13)}`;
  }
  s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}"/>` + bearingArrow(x, y, 0, 14);
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
      s += `<path d="M92 176H208V240H92Z" fill="${GROUND}" stroke="${INK}" stroke-width="${STROKE.regular}"/><path d="M96 180H204V236H96Z" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}"/>`;
      s += text(150, 204, dist(b.km, p.mi).toUpperCase(), 17, { family: COND, bold: true, spacing: 0.8 }) + text(150, 224, `APART SINCE ${p.y}`, 9, { family: COND, spacing: 1.6 });
    }
    return s + compass(250, 270) + caption(344, ...captionLines(signpostCaption(p, places), p.cap));
  }
  const n = boards.length;
  // The boards keep above the compass at the foot.
  // Few boards are big ones (a fingerpost's scale); more share the post's height.
  const pitch = Math.min(52, 170 / Math.max(1, n));
  const h = Math.min(40, pitch * 0.78);
  const top = 92;
  s += post(top - 34);
  // Home, on a plate at the top.
  const homeName = home ? home.name.toUpperCase() : "HOME";
  // Its letter-spacing counted (0.08 em), so the words stay on the plate; the plate grows with a long name (up to 170 wide), then the words get smaller, then cut.
  const homeLine = `FROM ${homeName}`;
  const hs = fitSize(homeLine, 170 - 16, 9, { family: COND, track: 0.08, floor: 6 });
  const homeSet = clip(homeLine, 170 - 16, hs, { family: COND, spacing: hs * 0.08 });
  const pw = Math.min(170, Math.max(92, textWidth(homeSet, hs, { family: COND, spacing: hs * 0.08 }) + 16));
  s += `<path d="M${f1(150 - pw / 2)} ${top - 30}H${f1(150 + pw / 2)}V${top - 12}H${f1(150 - pw / 2)}Z" fill="${GROUND}" stroke="${INK}" stroke-width="${STROKE.fine}"/>` + text(150, top - 21 + (hs * CAP.condensed) / 2, homeSet, hs, { family: COND, spacing: Math.round(hs * 0.8) / 10 });
  // Every board lettered alike, as a fingerpost is: the city in condensed capitals, one size for all (the longest name sets it, down
  // to a floor, and past that it's cut), the distance under it in the house's mono; every board the same length.
  const room = labelRoom(h);
  const names = boards.map((b) => b.city.name.toUpperCase());
  const dists = boards.map((b) => dist(b.km, p.mi).toUpperCase());
  const NT = 0.06, DT = 0.1;
  // The two lines keep 5 units clear of the board's edges (an accent over a capital included): name + gap + distance ≤ h − 10.
  const ns = Math.min(h * 0.46, (h - 10) / (CAP.condensed + 0.36 + 0.62 * CAP.plex), 16, ...names.map((t) => fitSize(t, room, 16, { family: COND, bold: true, track: NT, floor: 6 })));
  const ds = Math.max(4.5, Math.min(Math.round(ns * 0.62 * 10) / 10, ...dists.map((t) => fitSize(t, room, 10, { track: DT, floor: 4.5 }))));
  const set = names.map((t) => clip(t, room, ns, { family: COND, bold: true, spacing: ns * NT }));
  const wide = Math.max(...set.map((t) => textWidth(t, ns, { family: COND, bold: true, spacing: ns * NT })), ...dists.map((t) => textWidth(t, ds, { spacing: ds * DT })));
  const gap = ns * 0.36;
  const block = ns * CAP.condensed + gap + ds * CAP.plex;
  boards.forEach((b, i) => {
    const side = Math.sin(b.bearing * DEG) >= 0 ? 1 : -1;
    const y = top + i * pitch;
    const x0 = 150 + side * 8;
    const base = y + (h - block) / 2 + ns * CAP.condensed;
    const anchor = side > 0 ? "start" : "end";
    s += boardShape(side, y, h, wide + 32) + bearingArrow(x0 + side * 12, y + h / 2, b.bearing, 12);
    s += text(x0 + side * 22, base, set[i], ns, { family: COND, bold: true, anchor, spacing: Math.round(ns * NT * 100) / 100 });
    s += text(x0 + side * 22, base + gap + ds * CAP.plex, dists[i], ds, { anchor, spacing: Math.round(ds * DT * 100) / 100 });
  });
  // The compass at the foot, on the side the lowest board doesn't point to.
  const low = boards.length ? (Math.sin(boards[boards.length - 1].bearing * DEG) >= 0 ? 1 : -1) : 1;
  return s + compass(150 - low * 100, 272) + caption(344, ...captionLines(signpostCaption(p, places), p.cap));
}

export const captionOf = (spec: CustomSpec, data: RenderData = {}) => signpostCaption((spec as { p: Params }).p, data.places ?? []);

export const render = (spec: CustomSpec, color: BaseColor, data: RenderData = {}) => house(() => wrap(signpostBody((spec as { p: Params }).p, data.places ?? []), color));

/** The place list, for the index cards and the bag (the editor passes its own). */
export async function prepare(): Promise<RenderData> {
  return { places: (await loadCities()).list };
}
