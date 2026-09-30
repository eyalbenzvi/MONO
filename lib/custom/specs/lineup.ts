/**
 * Your Line-up: a team on a pitch, seen from above. A formation (football
 * eleven in 4-4-2, 4-3-3 or 3-5-2, five-a-side, or basketball), a name and a
 * number at each position, the team and the season at the top. For the whole
 * team, one print a player, each marking its own (`me`). Drawn by
 * lib/custom/templates/lineup.
 */
import { int, label, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export type Formation = "442" | "433" | "352" | "5" | "bb";
/** A position: the player's name ("" for none) and their number (optional). */
export type Player = [name: string, number?: number];

export interface Params {
  f: Formation;
  /** The team. */
  t: string;
  /** The season ("2025-26"; optional). */
  s?: string;
  /** One per position, the goalkeeper (or the point guard) first. */
  x: Player[];
  /** The player this print is for (their position's index), marked. */
  me?: number;
  cap?: Cap;
}

export const NAME = "Your Line-up";
export const FORMATIONS: readonly Formation[] = ["442", "433", "352", "5", "bb"];
export const FORMATION_NAMES: Record<Formation, string> = { "442": "4-4-2", "433": "4-3-3", "352": "3-5-2", "5": "Five-a-side", bb: "Basketball" };
export const TEAM_MAX = 20;
export const SEASON_MAX = 12;
export const PLAYER_MAX = 12;

/**
 * Each formation's positions: across (0 left, 1 right) and up the pitch (0
 * your own goal line, 1 theirs), the goalkeeper first.
 */
export const POSITIONS: Record<Formation, readonly (readonly [number, number])[]> = {
  "442": [[0.5, 0.07], [0.14, 0.25], [0.38, 0.22], [0.62, 0.22], [0.86, 0.25], [0.14, 0.52], [0.38, 0.49], [0.62, 0.49], [0.86, 0.52], [0.36, 0.78], [0.64, 0.78]],
  "433": [[0.5, 0.07], [0.14, 0.25], [0.38, 0.22], [0.62, 0.22], [0.86, 0.25], [0.25, 0.5], [0.5, 0.46], [0.75, 0.5], [0.18, 0.78], [0.5, 0.82], [0.82, 0.78]],
  "352": [[0.5, 0.07], [0.25, 0.22], [0.5, 0.2], [0.75, 0.22], [0.1, 0.52], [0.3, 0.47], [0.5, 0.44], [0.7, 0.47], [0.9, 0.52], [0.36, 0.78], [0.64, 0.78]],
  "5": [[0.5, 0.08], [0.27, 0.34], [0.73, 0.34], [0.3, 0.7], [0.7, 0.7]],
  bb: [[0.5, 0.62], [0.2, 0.52], [0.8, 0.52], [0.3, 0.22], [0.66, 0.16]],
};

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!FORMATIONS.includes(p.f as Formation) || !label(p.t, TEAM_MAX)) return null;
  if (p.s !== undefined && !label(p.s, SEASON_MAX)) return null;
  const n = POSITIONS[p.f as Formation].length;
  if (!Array.isArray(p.x) || p.x.length !== n) return null;
  const x: Player[] = [];
  for (const e of p.x as unknown[]) {
    if (!Array.isArray(e) || e.length < 1 || e.length > 2 || !(e[0] === "" || label(e[0], PLAYER_MAX))) return null;
    if (e.length === 2 && !int(e[1], 0, 99)) return null;
    x.push(e.length === 2 ? [e[0], e[1] as number] : [e[0]]);
  }
  if (p.me !== undefined && !int(p.me, 0, n - 1)) return null;
  return { f: p.f as Formation, t: p.t as string, ...(p.s !== undefined ? { s: p.s as string } : {}), x, ...(p.me !== undefined ? { me: p.me as number } : {}) };
}

export const detail = (p: Params) => (p.me !== undefined && p.x[p.me][0] ? `${p.t} · ${p.x[p.me][0]}` : p.t);

export const PRODUCT: ProductMeta<Params> = {
  line: "Your team, in formation, with everyone's name and number.",
  from: "A team and its players",
  group: "people",
  base: "schematic",
  bases: ["schematic", "type-data"],
  wordsHint: "Sunday FC",
  hints: { dense: "Try shorter names.", faint: "Try adding the players' names." },
  example: {
    f: "442",
    t: "Sunday FC",
    s: "2025-26",
    x: [["Dad", 1], ["Ari", 2], ["Tom", 5], ["Ben", 6], ["Omer", 3], ["Noa", 7], ["Maya", 8], ["Lior", 4], ["Dan", 11], ["Yoni", 9], ["Eli", 10]],
  },
};
