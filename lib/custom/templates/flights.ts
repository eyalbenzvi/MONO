/**
 * Your Flights. The departures board: a panel of split flaps, a row each (the
 * destination, its code, the year, a status), every character in a cell of
 * its own with the flap's split across it. The boarding pass: a ticket with a
 * perforated stub, from and to as large codes in the mono with their cities,
 * the passenger, the day, the seat and the gate, and a Code 128 barcode
 * (lib/custom/draw/code128). A generic ticket: no airline's.
 */
import { CAP, INK, STROKE, caption, captionLines, clip, f1, fitSize, line, longDate, rect, shortMonth, text, textWidth, type Lines, house } from "../kit";
import { code128Bars } from "../draw/code128";
import { emblem } from "../draw/emblems";
import { parseDate } from "../specKit";
import type { Params } from "../specs/flights";
import { loadAirports, type Airport, type Airports } from "../data";
import type { CustomSpec } from "../spec";
import type { RenderData } from "../renderers";
import { GROUND, wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const COND = "condensed" as const;

/** An airport's city as the board prints it: capitals, the words' letters only. */
const cityOf = (a: Airport | undefined) => (a?.city || a?.name || "").normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[^A-Z0-9 .-]/g, "");

/** The caption's lines (ours). */
export function flightsCaption(p: Params, airports?: Airports): Lines {
  if (p.k === "pass") {
    const [a, b] = [airports?.byCode(p.f!), airports?.byCode(p.t!)];
    const route = a && b ? `${a.city} to ${b.city}` : `${p.f} to ${p.t}`;
    const d = p.d ? parseDate(p.d) : null;
    return [p.n, route.length <= 36 ? route : `${p.f} to ${p.t}`, d ? longDate(...d) : "Date to be confirmed"];
  }
  const ys = p.x!.flatMap(([, y]) => (y ? [y] : []));
  const span = ys.length ? (Math.min(...ys) === Math.max(...ys) ? ` · ${ys[0]}` : ` · ${Math.min(...ys)}–${Math.max(...ys)}`) : "";
  return [p.n ? `${p.n}’s departures` : "Departures", `${p.x!.length} ${p.x!.length === 1 ? "flight" : "flights"}${span}`, "Every one of them boarded"];
}

/** A run of flap cells from x: each character in its own box, the flap's split across it (a hairline in an empty cell, a cut through the letter in a lettered one). */
function flaps(s: string, x: number, y: number, n: number, pitch: number, h: number): string {
  const w = pitch - 1.4;
  let out = "";
  let d = "";
  let cut = "";
  for (let i = 0; i < n; i++) {
    const cx = x + i * pitch;
    d += `M${f1(cx)} ${f1(y)}h${f1(w)}v${f1(h)}h${f1(-w)}z`;
    const ch = s[i];
    if (ch && ch !== " ") {
      const size = Math.round(h * 6.4) / 10;
      out += text(cx + w / 2, y + h / 2 + (size * CAP.plex) / 2, ch, size, { bold: true });
      cut += `M${f1(cx + 0.6)} ${f1(y + h / 2)}h${f1(w - 1.2)}`;
    } else d += `M${f1(cx)} ${f1(y + h / 2)}h${f1(w)}`;
  }
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}"/>` + out + (cut ? `<path d="${cut}" fill="none" stroke="${GROUND}" stroke-width=".7"/>` : "");
}

function board(p: Params, airports?: Airports): string {
  let s = rect(22, 34, 256, 282, STROKE.regular) + rect(26, 38, 248, 274, STROKE.hairline);
  s += emblem("plane", 46, 62, 24, 6) + text(63, 70, "DEPARTURES", 22, { family: COND, bold: true, anchor: "start", spacing: 1.8 });
  const who = p.n ? p.n.toUpperCase() : "";
  // The name at the right, in what DEPARTURES leaves (never over it): sized to that room, down to the face's smallest, then cut.
  const room = 266 - (63 + textWidth("DEPARTURES", 22, { family: COND, bold: true, spacing: 1.8 })) - 8;
  if (who) {
    const ws = fitSize(who, room, 10, { family: COND, track: 0.1, floor: 5 });
    s += text(266, 70 - (22 * CAP.condensed) / 2 + (ws * CAP.condensed) / 2, clip(who, room, ws, { family: COND, spacing: ws * 0.1 }), ws, { family: COND, anchor: "end", spacing: Math.round(ws) / 10 });
  }
  // The columns: destination, code, year, status; a cell each.
  const pitch = 8.6, cols = [11, 3, 4, 8], gap = 0.7;
  const x0 = 150 - (pitch * (cols.reduce((a, b) => a + b, 0) + gap * 3)) / 2;
  const at = cols.map((_, i) => x0 + pitch * (cols.slice(0, i).reduce((a, b) => a + b, 0) + gap * i));
  ["DESTINATION", "CODE", "YEAR", "STATUS"].forEach((h, i) => (s += text(at[i], 92, h, 6, { anchor: "start", spacing: 0.8 })));
  s += line(30, 97, 270, 97, STROKE.fine);
  const rows = p.x!;
  const latest = rows.reduce((m, [, y], i) => (y !== undefined && (m < 0 || y >= (rows[m][1] ?? -1)) ? i : m), -1);
  const last = latest >= 0 ? latest : rows.length - 1;
  const h = 14, rowPitch = Math.min(26, 190 / rows.length);
  // The rows centred down the panel.
  const top = 106 + (190 - rowPitch * rows.length) / 2;
  rows.forEach(([code, y], i) => {
    const ry = top + i * rowPitch;
    s += flaps(cityOf(airports?.byCode(code)).slice(0, cols[0]).padEnd(cols[0]), at[0], ry, cols[0], pitch, h);
    s += flaps(code, at[1], ry, cols[1], pitch, h);
    s += flaps(y ? String(y) : "", at[2], ry, cols[2], pitch, h);
    s += flaps(i === last ? "BOARDING" : "LANDED", at[3], ry, cols[3], pitch, h);
  });
  s += line(30, 300, 270, 300, STROKE.hairline) + text(150, 309, "PLEASE KEEP YOUR BELONGINGS WITH YOU AT ALL TIMES", 5.5, { spacing: 0.5 });
  return s;
}

function pass(p: Params, airports?: Airports): string {
  const [X0, Y0, X1, Y1, STUB] = [20, 70, 280, 266, 210];
  // The ticket: rounded corners, a notch each side of the perforation, the perforation dotted.
  const r = 10, nr = 7;
  const d = `M${X0 + r} ${Y0}H${STUB - nr}A${nr} ${nr} 0 0 0 ${STUB + nr} ${Y0}H${X1 - r}Q${X1} ${Y0} ${X1} ${Y0 + r}V${Y1 - r}Q${X1} ${Y1} ${X1 - r} ${Y1}H${STUB + nr}A${nr} ${nr} 0 0 0 ${STUB - nr} ${Y1}H${X0 + r}Q${X0} ${Y1} ${X0} ${Y1 - r}V${Y0 + r}Q${X0} ${Y0} ${X0 + r} ${Y0}Z`;
  let s = `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE.regular}"/>`;
  s += `<path d="M${STUB} ${Y0 + nr + 3}V${Y1 - nr - 3}" fill="none" stroke="${INK}" stroke-width="${STROKE.fine}" stroke-dasharray="1 3" stroke-linecap="round"/>`;
  s += text(34, Y0 + 22, "BOARDING PASS", 12, { family: COND, bold: true, anchor: "start", spacing: 1.4 }) + line(34, Y0 + 30, STUB - 14, Y0 + 30, STROKE.hairline);
  // From and to.
  const [a, b] = [airports?.byCode(p.f!), airports?.byCode(p.t!)];
  s += text(34, Y0 + 72, p.f!, 33, { bold: true, anchor: "start" }) + text(STUB - 14, Y0 + 72, p.t!, 33, { bold: true, anchor: "end" });
  s += emblem("plane", (34 + STUB - 14) / 2, Y0 + 60, 20, 6);
  const ca = cityOf(a), cb = cityOf(b);
  // Each city in its half of the line: smaller when long, and cut with an ellipsis only when even that won't do.
  const half = (STUB - 14 - 34) / 2 - 4;
  const fit = (c: string): [string, number] => {
    const w = (t: string, size: number) => textWidth(t, size) + t.length * 0.4;
    if (w(c, 7) <= half) return [c, 7];
    const size = Math.max(5, (7 * half) / w(c, 7));
    let t = c;
    while (t.length > 1 && w(t, size) > half) t = `${t.slice(0, -2).trimEnd()}…`;
    return [t, size];
  };
  const [[ta, sa], [tb, sb]] = [fit(ca), fit(cb)];
  s += text(34, Y0 + 86, ta, sa, { anchor: "start", spacing: 0.4 }) + text(STUB - 14, Y0 + 86, tb, sb, { anchor: "end", spacing: 0.4 });
  // The fields.
  const d8 = p.d ? parseDate(p.d) : null;
  const date = d8 ? `${String(d8[2]).padStart(2, "0")} ${shortMonth(d8[1])} ${d8[0]}` : "TBC";
  const fields: [string, string, number][] = [["PASSENGER", p.n!.toUpperCase(), 34], ["DATE", date, 34], ["SEAT", p.s ?? "ANY", 110], ["GATE", p.g ?? "TBC", 150]];
  const ps = fitSize(fields[0][1], 162, 10, { bold: true, floor: 5 });
  s += text(34, Y0 + 106, fields[0][0], 5.5, { anchor: "start", spacing: 0.7 }) + text(34, Y0 + 118, clip(fields[0][1], 162, ps, { bold: true }), ps, { anchor: "start", bold: true });
  for (const [k, v, x] of fields.slice(1)) s += text(x, Y0 + 134, k, 5.5, { anchor: "start", spacing: 0.7 }) + text(x, Y0 + 146, v, 10, { anchor: "start", bold: true });
  // The barcode: the route and the day, in code set B.
  const code = `${p.f}${p.t}${d8 ? `${d8[0]}${String(d8[1]).padStart(2, "0")}${String(d8[2]).padStart(2, "0")}` : ""}`;
  const bars = code128Bars(code, 0, 0, 1, 1)!;
  const mod = Math.min(1.2, 160 / bars.width);
  s += code128Bars(code, 34, Y0 + 158, mod, 24)!.svg;
  // The stub: the route, the seat, again.
  s += text(245, Y0 + 22, "STUB", 6, { spacing: 1.2 });
  s += text(245, Y0 + 52, p.f!, 16, { bold: true }) + text(245, Y0 + 70, "TO", 6, { spacing: 1 }) + text(245, Y0 + 90, p.t!, 16, { bold: true });
  s += line(222, Y0 + 104, 268, Y0 + 104, STROKE.hairline) + text(245, Y0 + 120, "SEAT", 5.5, { spacing: 0.8 }) + text(245, Y0 + 134, p.s ?? "ANY", 11, { bold: true });
  s += text(245, Y0 + 156, "GATE", 5.5, { spacing: 0.8 }) + text(245, Y0 + 170, p.g ?? "TBC", 11, { bold: true });
  // A line of small print under the ticket.
  s += text(150, Y1 + 20, "GATE CLOSES 20 MINUTES BEFORE DEPARTURE. IT REALLY DOES.", 5.5, { spacing: 0.5 });
  return s;
}

export function flightsBody(p: Params, airports?: Airports): string {
  return (p.k === "pass" ? pass(p, airports) : board(p, airports)) + caption(346, ...captionLines(flightsCaption(p, airports), p.cap));
}

export const captionOf = (spec: CustomSpec, data: RenderData = {}) => flightsCaption((spec as { p: Params }).p, data.airports);

export const render = (spec: CustomSpec, color: BaseColor, data: RenderData = {}) => house(() => wrap(flightsBody((spec as { p: Params }).p, data.airports), color));

/** The airports, for the index cards and the bag (the editor passes its own). */
export async function prepare(): Promise<RenderData> {
  return { airports: await loadAirports() };
}
