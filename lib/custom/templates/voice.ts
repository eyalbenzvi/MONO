/**
 * Your Voice: a harmonograph tuned by three seconds of your voice, drawn as
 * the catalogue's harmonographs are (lib/custom/draw/curves): two damped
 * pendulums per axis.
 *
 * - a:b, the two strongest harmonics as a simple fraction (never 1:1), is the ratio of the swings;
 * - d, how fast the voice faded, is the pendulums' damping (a held note runs long and fills the figure; a short one spirals in);
 * - ph, where in its cycle the voice began, turns the second pendulum on each axis;
 * - f, the pitch, mistunes the second pendulums a little (so the figure drifts, differently for every pitch) and is printed.
 *
 * Pendulums in step can draw a flat ellipse or a line; the y pendulums
 * start wherever the figure comes out roundest, so every voice draws an area.
 */
import { caption, captionLines, type Lines, house } from "../kit";
import { titleWords } from "../specKit";
import { harmonographPoints, tracePath } from "../draw/curves";
import type { CustomSpec, VoiceParams } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

type Four = [number, number, number, number];
const BOX = { x: 32, y: 34, w: 236, h: 274 };

export function voiceBody(p: VoiceParams): string {
  const { a, b, d, ph, f } = p;
  // A low ratio (2:1, 3:2) retraces the same ring unless its pendulums are mistuned further, so it precesses and fills; a high one is busy enough already.
  const m = Math.max(a, b);
  const spread = 0.004 + 0.04 / (m * m);
  const det: Four = [1, 1 + spread * (0.6 + ((f % 13) / 13) * 0.4), 1, 1 - spread * (0.6 + ((f % 11) / 11) * 0.4)];
  // The voice's fade (0.003 held to 0.03 clipped, as lib/custom/voice measures it) onto the catalogue's range of pendulum damping, so a held note fills the figure and a short one spirals in without piling up or dying out (gentler for a low ratio, which has fewer lines to lose).
  const k = 0.01 + ((d - 0.003) / 0.027) * 0.012 * Math.min(1, m / 3) ** 2;
  const damping: Four = [k, k * 1.15, k * 0.9, k * 1.05];
  const trace = (py: number) => harmonographPoints({ a, b, detune: det, phases: [ph, ph + 0.7, py, py + 0.5], damping, duration: Math.max(70, 150 * Math.min(1, 3.5 / m)), steps: 4000 });
  // The y pendulums start where the figure comes out roundest (a quarter turn on, or an eighth), so no voice draws a flattened ellipse or a bare line.
  const aspect = (pts: [number, number][]) => {
    const span = (i: 0 | 1) => Math.max(...pts.map((q) => q[i])) - Math.min(...pts.map((q) => q[i]));
    const r = span(0) / (span(1) || 1e-9);
    return Math.max(r, 1 / r);
  };
  const pts = [0, Math.PI / 2, Math.PI / 4].map(trace).reduce((best, t) => (aspect(t) < aspect(best) - 0.05 ? t : best));
  // A low ratio draws fewer lines, so a heavier pen; a high one a finer pen, so its turning points don't close up.
  return tracePath(pts, BOX, m <= 3 ? ".7" : m <= 5 ? ".6" : ".5") + caption(340, ...captionLines(voiceCaption(p), p.cap));
}

/** The caption's lines (ours): the words (the visitor's title) or "Your voice", and the pitch. */
export function voiceCaption(p: VoiceParams): Lines {
  const words = titleWords(p);
  return [words ?? "Your voice", words ? `Your voice · ${p.f} Hz` : `${p.f} Hz · ${p.a}:${p.b}`];
}

export const captionOf = (spec: CustomSpec) => voiceCaption((spec as { p: VoiceParams }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(voiceBody((spec as { p: VoiceParams }).p), color));
