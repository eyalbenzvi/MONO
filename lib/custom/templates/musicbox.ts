/**
 * Your Music Box: the tune punched in a 25-note music-box strip, drawn like
 * the catalogue's Terminal designs (the paper tape and the punched card: a
 * strip running down the print, round holes on a grid, its code printed
 * along the edge). Lanes across are the pitches, low on the left, the
 * naturals ruled and the sharps dashed like a keyboard's black keys; steps
 * down are eighths, beats ruled fine and bars heavier, numbered in the
 * margin. The feed edges are perforated and the strip starts with a pointed
 * leader. A short tune goes round again until the strip is full (a music box
 * plays in a loop), each pass opened with a double rule.
 */
import { INK, caption, f1, line, text, captionLines, type Lines } from "../kit";
import { titleWords } from "../specKit";
import type { CustomSpec } from "../spec";
import { PITCHES, isSharp, pitchName, unpackNotes, type Params } from "../specs/musicbox";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const LANE = 8.2;
const X0 = 150 - ((PITCHES - 1) * LANE) / 2;
const XL = X0 - 12, XR = X0 + (PITCHES - 1) * LANE + 12;
const LEAD = 22, Y0 = 54, GRID_H = 256;
/** A strip is at least this many steps long (a short tune goes round again). */
const MIN_STEPS = 32;

/** The drawing, the caption's lines as ours, and where the caption sits. */
function musicboxDraw(p: Params): [string, Lines, number] {
  const notes = unpackNotes(p.m) ?? [];
  const last = notes.length ? notes[notes.length - 1][0] : 0;
  // The tune's length, to the half bar (four eighths); passes to fill the strip.
  const len = Math.max(4, Math.ceil((last + 1) / 4) * 4);
  const reps = Math.ceil(MIN_STEPS / len);
  const steps = reps * len;
  const step = Math.min(LANE, GRID_H / steps);
  const y = (k: number) => Y0 + (k + 0.5) * step;
  const x = (pitch: number) => X0 + pitch * LANE;
  const yEnd = Y0 + steps * step;
  let s = "";

  // The strip: a pointed leader, the two feed edges, a square end.
  s += `<path d="M${f1(XL)} ${f1(Y0 - 6)}V${f1(LEAD + 12)}L150 ${LEAD}L${f1(XR)} ${f1(LEAD + 12)}V${f1(Y0 - 6)}" fill="none" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;
  s += line(XL, Y0 - 6, XL, yEnd + 4, 1.2) + line(XR, Y0 - 6, XR, yEnd + 4, 1.2) + line(XL, yEnd + 4, XR, yEnd + 4, 1.2);
  // The feed direction, in the leader.
  s += `<path d="M146 ${LEAD + 13}L150 ${LEAD + 8}L154 ${LEAD + 13}M150 ${LEAD + 8}V${LEAD + 20}" fill="none" stroke="${INK}" stroke-width=".6" stroke-linecap="round" stroke-linejoin="round"/>`;

  // Perforations: a ring every beat down both edges.
  let perf = "";
  for (let k = 0; k < steps; k += 2) {
    const yy = y(k) + step / 2;
    for (const px of [XL + 5, XR - 5]) perf += `M${f1(px - 1.2)} ${f1(yy)}a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0`;
  }
  s += `<path d="${perf}" fill="none" stroke="${INK}" stroke-width=".5"/>`;

  // Lanes: naturals ruled, sharps dashed; the natural's name above its lane (the Cs with their octave).
  let solid = "", dashed = "";
  for (let q = 0; q < PITCHES; q++) {
    const seg = `M${f1(x(q))} ${f1(Y0)}V${f1(yEnd)}`;
    if (isSharp(q)) dashed += seg;
    else {
      solid += seg;
      const nm = pitchName(q);
      s += text(x(q), Y0 - 9, nm.startsWith("C") ? nm : nm[0], nm.startsWith("C") ? 4 : 4.4, { bold: nm.startsWith("C") });
    }
  }
  s += `<path d="${solid}" fill="none" stroke="${INK}" stroke-width=".45"/><path d="${dashed}" fill="none" stroke="${INK}" stroke-width=".4" stroke-dasharray="1.2 1.6"/>`;

  // Steps: beats fine, bars heavier and numbered, each pass opened with a double rule.
  let beats = "", bars = "";
  for (let k = 0; k <= steps; k += 2) {
    const yy = Y0 + k * step;
    const inBar = k % len;
    if (k > 0 && k < steps && inBar === 0) {
      bars += `M${f1(XL)} ${f1(yy - 0.9)}H${f1(XR)}M${f1(XL)} ${f1(yy + 0.9)}H${f1(XR)}`;
    } else if (inBar % 8 === 0) bars += `M${f1(XL + 9)} ${f1(yy)}H${f1(XR - 9)}`;
    else if (step >= 3 || inBar % 4 === 0) beats += `M${f1(X0)} ${f1(yy)}H${f1(x(PITCHES - 1))}`;
    if (inBar % 8 === 0 && k < steps && (step * 8 >= 12 || inBar % 16 === 0)) s += text(XL - 3.5, yy + 1.6, String(inBar / 8 + 1), 4.4, { anchor: "end" });
  }
  s += `<path d="${beats}" fill="none" stroke="${INK}" stroke-width=".4"/><path d="${bars}" fill="none" stroke="${INK}" stroke-width=".8"/>`;

  // The holes, every pass: as large as the closest two allow (a clear gap between them), never past a third of a lane.
  const at: [number, number][] = [];
  for (let rep = 0; rep < reps; rep++) for (const [k, q] of notes) at.push([x(q), y(rep * len + k)]);
  let near = LANE;
  for (let i = 0; i < at.length; i++)
    for (let j = i + 1; j < at.length && at[j][1] - at[i][1] < near; j++) near = Math.min(near, Math.hypot(at[j][0] - at[i][0], at[j][1] - at[i][1]));
  const r = Math.round(Math.max(1, Math.min(LANE * 0.34, near / 2 - 0.7)) * 10) / 10;
  let holes = "";
  for (const [cx, cy] of at) holes += `M${f1(cx - r)} ${f1(cy)}a${r} ${r} 0 1 0 ${f1(2 * r)} 0a${r} ${r} 0 1 0 ${f1(-2 * r)} 0`;
  s += `<path d="${holes}" fill="${INK}"/>`;

  const title = titleWords(p) ?? "Music box";
  const sub = `${notes.length} notes · ${len / 2} beats · C4 to C6`;
  return [s, [title, sub, reps > 1 ? `25-note strip · played ${reps} times round` : "25-note strip"], 340];
}
/** The caption's lines (ours). */
export const musicboxCaption = (p: Params): Lines => musicboxDraw(p)[1];

export function musicboxBody(p: Params): string {
  const [s, lines, y] = musicboxDraw(p);
  return s + caption(y, ...captionLines(lines, p.cap));
}

export const captionOf = (spec: CustomSpec) => musicboxCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(musicboxBody((spec as { p: Params }).p), color);
