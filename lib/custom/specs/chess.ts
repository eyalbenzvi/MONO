/**
 * Your Game: a game of chess you played, as its moves (read from a PGN on
 * the device) and optionally the players, the day and the result. Drawn by
 * lib/custom/templates/chess, which replays the moves.
 *
 * The moves travel as two characters a ply, from-square and to-square,
 * each one base64url digit (a1 = "A", h8 = "_"): 2 characters a ply against
 * packInts' 2.7, and checked here by shape alone (this module is in every
 * page). A promotion is to a queen unless `u` lists it: packInts of
 * [ply, piece] pairs, piece 1 knight, 2 bishop, 3 rook, plies rising. The
 * template replays the moves and stops at the first that isn't legal.
 */
import { label, parseDate, unpackInts } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export type ChessResult = "1-0" | "0-1" | "1/2";
export interface Params {
  /** The moves: from and to square per ply (base64url digits, a1 = 0 … h8 = 63). */
  m: string;
  /** Promotions other than a queen: packInts of [ply, piece] pairs (1 knight, 2 bishop, 3 rook). */
  u?: string;
  /** White and Black, as printed. */
  a?: string;
  b?: string;
  /** The day ("YYYY-MM-DD"). */
  d?: string;
  r?: ChessResult;
}

export const NAME = "Your Game";
/** Plies kept (sixty moves each). */
export const CHESS_MAX_PLIES = 120;
export const PLAYER_MAX = 18;
export const RESULTS: readonly ChessResult[] = ["1-0", "0-1", "1/2"];
const MOVES = /^(?:[A-Za-z0-9_-]{2}){1,120}$/;

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (typeof p.m !== "string" || !MOVES.test(p.m)) return null;
  const plies = p.m.length / 2;
  // A piece never stays where it is.
  for (let i = 0; i < p.m.length; i += 2) if (p.m[i] === p.m[i + 1]) return null;
  let u: { u?: string } = {};
  if (p.u !== undefined) {
    const v = unpackInts(p.u, 64);
    if (!v || !v.length || v.length % 2) return null;
    for (let i = 0; i < v.length; i += 2) if (!(v[i] >= 0 && v[i] < plies && (i === 0 || v[i] > v[i - 2]) && v[i + 1] >= 1 && v[i + 1] <= 3)) return null;
    u = { u: p.u as string };
  }
  for (const k of ["a", "b"] as const) if (p[k] !== undefined && !label(p[k], PLAYER_MAX)) return null;
  if (p.d !== undefined && !parseDate(p.d)) return null;
  if (p.r !== undefined && !RESULTS.includes(p.r as ChessResult)) return null;
  return {
    m: p.m,
    ...u,
    ...(p.a !== undefined ? { a: p.a as string } : {}),
    ...(p.b !== undefined ? { b: p.b as string } : {}),
    ...(p.d !== undefined ? { d: p.d as string } : {}),
    ...(p.r !== undefined ? { r: p.r as ChessResult } : {}),
  };
}

export const detail = (p: Params) => (p.a && p.b ? `${p.a} v ${p.b}` : `${Math.ceil(p.m.length / 4)} moves`);

export const PRODUCT: ProductMeta<Params> = {
  line: "A game you played: every piece's journey across the board, move by move.",
  from: "A game you played",
  group: "you",
  base: "tiling",
  bases: ["tiling", "khatam"],
  wordsHint: "Dad",
  // The Opera Game, Paris 1858: Paul Morphy against the Duke of Brunswick and Count Isouard, 33 plies to mate.
  example: { m: "Mc0kGVzrLb6ebkeVDVrkFa-tVR70BSyqCmxhShqhah5zEC47Dz7zHD0shztzR5z5D7", a: "Paul Morphy", b: "Duke and Count", r: "1-0" },
  hints: { dense: "Try a shorter game, or leave out the names.", faint: "Try a longer game." },
};
