/**
 * Your Maze: one to three initials and how hard it is. The way through
 * spells the initials (lib/custom/draw/maze); `s: 1` draws it, dotted.
 */
import { flag, wordsOf } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export type MazeLevel = (typeof MAZE_LEVELS)[number];
export interface Params {
  /** The initials: 1–3 capitals or figures (the pixel font's), no spaces. */
  x: string;
  /** How hard: 1 easy, 2 harder, 3 hardest (smaller cells, more turnings). */
  d: MazeLevel;
  /** Draw the way through, dotted. */
  s?: 1;
  w?: string;
}

export const NAME = "Your Maze";
export const MAZE_LEVELS = [1, 2, 3] as const;
export const MAZE_LEVEL_NAMES: Record<MazeLevel, string> = { 1: "Easy", 2: "Harder", 3: "Hardest" };
export const MAZE_MAX = 3;
export const MAZE_INITIALS = /^[A-Z0-9]{1,3}$/;

/** What's wrong with typed initials, in one line, or null (they're taken in capitals, spaces and full stops dropped). */
export function mazeProblem(typed: string): string | null {
  const x = mazeInitials(typed);
  if (!x) return "One to three letters or figures";
  const bad = [...x].find((ch) => !/[A-Z0-9]/.test(ch));
  if (bad) return `The maze can’t spell "${bad}". Letters A to Z and figures only`;
  return x.length > MAZE_MAX ? `Up to ${MAZE_MAX} letters` : null;
}
/** Typed initials as the spec keeps them: capitals, without spaces and full stops ("n. b." → "NB"). */
export const mazeInitials = (typed: string) => typed.toUpperCase().replace(/[\s.]/g, "");

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (typeof p.x !== "string" || !MAZE_INITIALS.test(p.x) || !MAZE_LEVELS.includes(p.d as never)) return null;
  const s = flag(p, "s");
  const w = wordsOf(p);
  if (!s || !w) return null;
  return { x: p.x, d: p.d as MazeLevel, ...s, ...w };
}

/** "N.B.": the initials as the caption and the bag write them. */
export const dotted = (x: string) => [...x].map((c) => `${c}.`).join("");
export const detail = (p: Params) => dotted(p.x);

export const PRODUCT: ProductMeta<Params> = {
  line: "A maze whose one way through spells your initials.",
  from: "One to three initials",
  group: "name",
  base: "matrix",
  wordsHint: "For Noa, aged 7",
  example: { x: "NB", d: 2 },
  hints: { dense: "Try an easier maze.", faint: "Try a harder maze." },
};
