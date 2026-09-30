/**
 * Your Line-up: a pitch seen from above in line drawing (its lines, the
 * centre circle, both boxes and goals, the corner arcs; or a basketball
 * court: the keys, the circles, the three-point arcs), the team in its
 * formation, each player a ring with their number and their name under it,
 * the one this print is for marked with a second ring. The team and the
 * season at the top.
 */
import { INK, caption, captionLines, circle, dot, f1, line, rect, text, textWidth, type Lines } from "../kit";
import { FORMATION_NAMES, POSITIONS, type Params } from "../specs/lineup";
import type { CustomSpec } from "../spec";
import { GROUND, wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const COND = "condensed" as const;
const X0 = 46, X1 = 254, Y0 = 60, Y1 = 318;

/** The caption's lines (ours). */
export function lineupCaption(p: Params): Lines {
  const me = p.me !== undefined ? p.x[p.me] : null;
  const named = p.x.filter(([n]) => n).length;
  return [p.t, [FORMATION_NAMES[p.f], p.s].filter(Boolean).join(" · "), me?.[0] ? `This one is ${me[0]}’s${me[1] !== undefined ? `, number ${me[1]}` : ""}` : `${named} of ${p.x.length} named`];
}

/** A quarter or half arc as a path: centre, radius, from and to (degrees, clockwise from +x). */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, w = 0.8): string {
  const p = (a: number) => `${f1(cx + r * Math.cos((a * Math.PI) / 180))} ${f1(cy + r * Math.sin((a * Math.PI) / 180))}`;
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `<path d="M${p(a0)}A${r} ${r} 0 ${large} 1 ${p(a1)}" fill="none" stroke="${INK}" stroke-width="${w}"/>`;
}

function football(small: boolean): string {
  const [w, h] = [X1 - X0, Y1 - Y0];
  const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
  let s = rect(X0, Y0, w, h, 1.2) + line(X0, cy, X1, cy, 0.8) + circle(cx, cy, small ? 18 : 26, 0.8) + dot(cx, cy, 1.4);
  for (const [goal, dir] of [[Y1, -1], [Y0, 1]] as const) {
    const bw = w * (small ? 0.5 : 0.6), bd = h * (small ? 0.13 : 0.16);
    s += `<path d="M${f1(cx - bw / 2)} ${goal}V${f1(goal + dir * bd)}H${f1(cx + bw / 2)}V${goal}" fill="none" stroke="${INK}" stroke-width=".8"/>`;
    {
      const gw = w * 0.28, gd = h * 0.055;
      s += `<path d="M${f1(cx - gw / 2)} ${goal}V${f1(goal + dir * gd)}H${f1(cx + gw / 2)}V${goal}" fill="none" stroke="${INK}" stroke-width=".8"/>`;
      s += dot(cx, goal + dir * h * 0.11, 1.2);
      s += arc(cx, goal + dir * h * 0.11, 24, dir < 0 ? 217 : 37, dir < 0 ? 323 : 143);
    }
    // The goal, outside the line.
    s += `<path d="M${f1(cx - w * 0.1)} ${goal}V${f1(goal - dir * 5)}H${f1(cx + w * 0.1)}V${goal}" fill="none" stroke="${INK}" stroke-width="1"/>`;
  }
  // Five-a-side is played in a cage: its boards, a second line round the pitch, and their posts.
  if (small) {
    s += rect(X0 - 6, Y0 - 12, w + 12, h + 24, 1.4);
    for (let y = Y0 - 12; y <= Y1 + 12; y += (h + 24) / 8) s += line(X0 - 9, y, X0 - 6, y, 1.2) + line(X1 + 6, y, X1 + 9, y, 1.2);
  }
  // The corner arcs.
  s += arc(X0, Y0, 5, 0, 90) + arc(X1, Y0, 5, 90, 180) + arc(X1, Y1, 5, 180, 270) + arc(X0, Y1, 5, 270, 360);
  return s;
}

function court(): string {
  const [w, h] = [X1 - X0, Y1 - Y0];
  const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
  let s = rect(X0, Y0, w, h, 1.2) + line(X0, cy, X1, cy, 0.8) + circle(cx, cy, 20, 0.8) + circle(cx, cy, 7, 0.6);
  for (const [end, dir] of [[Y1, -1], [Y0, 1]] as const) {
    const kw = w * 0.34, kd = h * 0.2;
    s += `<path d="M${f1(cx - kw / 2)} ${end}V${f1(end + dir * kd)}H${f1(cx + kw / 2)}V${end}" fill="none" stroke="${INK}" stroke-width=".8"/>`;
    s += arc(cx, end + dir * kd, kw / 2, dir < 0 ? 180 : 0, dir < 0 ? 360 : 180);
    // The three-point line: straight from the baseline, then the arc round the basket.
    const r3 = w * 0.44, by = end + dir * 14;
    const side = w * 0.42;
    const t = Math.asin(side / r3);
    const ya = by + dir * r3 * Math.cos(t);
    s += `<path d="M${f1(cx - side)} ${end}V${f1(ya)}A${f1(r3)} ${f1(r3)} 0 0 ${dir < 0 ? 1 : 0} ${f1(cx + side)} ${f1(ya)}V${end}" fill="none" stroke="${INK}" stroke-width=".8"/>`;
    s += line(cx - 9, end + dir * 8, cx + 9, end + dir * 8, 1.4) + circle(cx, by, 4, 1);
  }
  return s;
}

export function lineupBody(p: Params): string {
  let s = p.f === "bb" ? court() : football(p.f === "5");
  // The team and the season at the top.
  const head = p.s ? `${p.t.toUpperCase()} · ${p.s}` : p.t.toUpperCase();
  const hs = Math.round(Math.min(20, (20 * 250) / (textWidth(head, 20, { family: COND, bold: true }) + head.length * 1.2)) * 10) / 10;
  s += text(150, 42, head, hs, { family: COND, bold: true, spacing: 1.2 });
  const [w, h] = [X1 - X0, Y1 - Y0];
  POSITIONS[p.f].forEach(([u, v], i) => {
    const x = X0 + u * w;
    const y = Y1 - v * h - 6;
    const [name, num] = p.x[i];
    const mine = p.me === i;
    // The ring hides the lines under it (filled with the ground), a second ring round the one this print is for.
    // Fewer players, larger rings.
    const r = POSITIONS[p.f].length > 5 ? 9 : 12;
    s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="${GROUND}" stroke="${INK}" stroke-width="${mine ? 1.8 : 1.2}"/>`;
    if (mine) s += circle(x, y, r + 4, 0.8);
    if (num !== undefined) s += text(x, y + r * 0.37, String(num), r, { family: COND, bold: true });
    else s += circle(x, y, r * 0.45, 0.8) + dot(x, y, 1.4);
    if (name) {
      // Measured as it prints (upper case, its letter-spacing): it keeps to its 50 units, clear of the next player's.
      const shown = name.toUpperCase();
      const ns = Math.round(Math.min(8, (50 - shown.length * 0.3) / textWidth(shown, 1, { family: COND, bold: mine })) * 10) / 10;
      s += text(x, y + r + (mine ? 13 : 10), shown, ns, { family: COND, bold: mine, spacing: 0.3 });
    }
  });
  return s + caption(344, ...captionLines(lineupCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => lineupCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(lineupBody((spec as { p: Params }).p), color);
