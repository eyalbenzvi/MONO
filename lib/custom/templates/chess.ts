/**
 * Your Game: a game of chess as the journeys of its pieces. The stored moves
 * are replayed (lib/custom/draw/chess, stopping at the first that isn't
 * legal) on a board of hatched dark squares; each piece's path runs through
 * the centres of the squares it stood on, in its own lane of the square so
 * the paths lie side by side, White's solid and Black's dashed; a capture is
 * a small cross where it happened, and the pieces still standing at the end
 * are drawn as small glyphs on their squares. The moves themselves are set
 * under the board as a score sheet. Drawn like the catalogue's tiling
 * designs (a square grid, one ink, tone from hatching); the khatam tiles are
 * the next nearest.
 */
import { INK, caption, f1, longDate, text, captionLines, type Lines } from "../kit";
import { PROMOS, decodeMoves, fileOf, inCheck, isLegal, legalMoves, play, rankOf, startPosition, toSan, type Move, type Piece, type Position } from "../draw/chess";
import { parseDate, type CustomSpec } from "../spec";
import { unpackInts } from "../specKit";
import type { Params as ChessParams } from "../specs/chess";
import { GROUND, wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const S = 26;
const X0 = 46, Y0 = 22;
/** A square's centre (a1 bottom left, White's view). */
const centre = (sq: number): [number, number] => [X0 + (fileOf(sq) + 0.5) * S, Y0 + (7.5 - rankOf(sq)) * S];

/** Glyphs, about 15 units tall, centred: body paths (filled), and detail strokes. */
const GLYPHS: Record<string, { body: string[]; detail?: string }> = {
  p: { body: ["M-3 5L-1.3-.3H1.3L3 5Z", "M-4.5 5H4.5V7H-4.5Z"], detail: "" },
  r: { body: ["M-4 7H4V5H3V-2H4V-6H2.4V-4.5H.8V-6H-.8V-4.5H-2.4V-6H-4V-2H-3V5H-4Z"] },
  n: { body: ["M-4 7H4.5C4.8 2 4-3 .5-6L-.5-7.5-1.2-5.5C-3-4.5-4.5-2-4.8 0L-3.8 1-1-.5C-1.5 2-3.5 3.5-4 7Z"] },
  b: { body: ["M-4.5 7H4.5V5.2H-4.5Z", "M0-6.5C3.8-3 3.5 1.5 2.5 4.5H-2.5C-3.5 1.5-3.8-3 0-6.5Z"], detail: "M1.6-3.4L-.6-1" },
  q: { body: ["M-4.5 7H4.5L5.2 0 3.2-5 1.6.5 0-6.5-1.6.5-3.2-5-5.2 0Z"] },
  k: { body: ["M-4.5 7H4.5L5.2-.5C3.4-3.4 1.2-2.6 0-.4-1.2-2.6-3.4-3.4-5.2-.5Z"], detail: "M0-1.2V-7.8M-2-5.6H2" },
};

function glyph(piece: Piece, x: number, y: number): string {
  const g = GLYPHS[piece.toLowerCase()];
  const white = piece === piece.toUpperCase();
  let s = `<circle cx="${f1(x)}" cy="${f1(y)}" r="9.6" fill="${GROUND}"/>`;
  s += `<g transform="translate(${f1(x)} ${f1(y)})">`;
  for (const d of g.body) s += `<path d="${d}" fill="${white ? GROUND : INK}" stroke="${INK}" stroke-width=".9" stroke-linejoin="round"/>`;
  if (piece.toLowerCase() === "p") s += `<circle cx="0" cy="-3" r="2.4" fill="${white ? GROUND : INK}" stroke="${INK}" stroke-width=".9"/>`;
  if (piece.toLowerCase() === "b") s += `<circle cx="0" cy="-7.4" r="1" fill="${INK}"/>`;
  if (piece.toLowerCase() === "n") s += `<circle cx="-.6" cy="-3.2" r=".7" fill="${white ? INK : GROUND}"/>`;
  if (g.detail) s += `<path d="${g.detail}" fill="none" stroke="${piece.toLowerCase() === "k" || white ? INK : GROUND}" stroke-width="${piece.toLowerCase() === "k" ? 1.3 : 0.8}" stroke-linecap="round"/>`;
  return s + "</g>";
}

export interface Replay {
  moves: Move[];
  sans: string[];
  final: Position;
  /** Each piece (by where it began) the squares it stood on, and where it was taken (or −1). */
  paths: { start: number; squares: number[]; taken: number }[];
}

/** The stored moves replayed from the start, up to the first that isn't legal. */
export function replay(p: ChessParams): Replay {
  const promos = new Map<number, number>();
  const u = p.u ? (unpackInts(p.u, 64) ?? []) : [];
  for (let i = 0; i + 1 < u.length; i += 2) promos.set(u[i], u[i + 1]);
  let pos = startPosition();
  const who = pos.board.map((pc, sq) => (pc ? sq : -1));
  const paths = new Map<number, { start: number; squares: number[]; taken: number }>();
  who.forEach((id) => id >= 0 && paths.set(id, { start: id, squares: [id], taken: -1 }));
  const moves: Move[] = [];
  const sans: string[] = [];
  for (const [i, raw] of decodeMoves(p.m).entries()) {
    const pawn = pos.board[raw.from]?.toLowerCase() === "p";
    const m: Move = pawn && (rankOf(raw.to) === 7 || rankOf(raw.to) === 0) ? { ...raw, promo: PROMOS[promos.get(i) ?? 0] } : raw;
    if (!isLegal(pos, m)) break;
    sans.push(toSan(pos, m));
    // Who's taken: on the square, or the pawn passed en passant.
    const victimSq = pos.board[m.to] ? m.to : pawn && m.to === pos.ep ? m.to + (pos.white ? -8 : 8) : -1;
    if (victimSq >= 0) paths.get(who[victimSq])!.taken = m.to;
    if (victimSq >= 0) who[victimSq] = -1;
    const id = who[m.from];
    paths.get(id)!.squares.push(m.to);
    who[m.to] = id;
    who[m.from] = -1;
    if (pos.board[m.from].toLowerCase() === "k" && Math.abs(m.to - m.from) === 2) {
      const [rf, rt] = m.to > m.from ? [m.from + 3, m.from + 1] : [m.from - 4, m.from - 1];
      paths.get(who[rf])!.squares.push(rt);
      who[rt] = who[rf];
      who[rf] = -1;
    }
    pos = play(pos, m);
    moves.push(m);
  }
  return { moves, sans, final: pos, paths: [...paths.values()] };
}

/** The score sheet: "1.e4 e5 2.Nf3 …" in as few lines as fit between top and bottom, the type as large as will, centred in the space. */
function scoreSheet(sans: string[], top: number, bottom: number): string {
  const tokens = sans.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}.${s}` : s));
  for (const size of [5.6, 5.2, 4.8, 4.4]) {
    const per = Math.floor(262 / (0.602 * size));
    const lh = size * 1.6;
    const rows = Math.floor((bottom - top) / lh) + 1;
    const lines: string[] = [];
    for (const t of tokens) {
      const last = lines[lines.length - 1];
      if (last !== undefined && last.length + 1 + t.length <= per) lines[lines.length - 1] = `${last} ${t}`;
      else lines.push(t);
    }
    if (lines.length <= rows || size === 4.4) {
      const shown = lines.slice(0, rows);
      if (lines.length > rows) shown[rows - 1] = `${shown[rows - 1].slice(0, per - 2)} …`;
      // Centred between the board and the caption.
      const y0 = (top + bottom) / 2 - ((shown.length - 1) * lh) / 2;
      return shown.map((l, i) => text(19, y0 + i * lh, l, size, { anchor: "start" })).join("");
    }
  }
  return "";
}

/** The drawing, the caption's lines as ours, and where the caption sits. */
function chessDraw(p: ChessParams): [string, Lines, number] {
  const game = replay(p);
  let s = "";
  // The board: dark squares hatched at 45°, a frame, files and ranks.
  let hatch = "";
  const step = 3.6;
  for (let sq = 0; sq < 64; sq++) {
    if ((fileOf(sq) + rankOf(sq)) % 2) continue;
    const x = X0 + fileOf(sq) * S, y = Y0 + (7 - rankOf(sq)) * S;
    for (let d = step / 2; d < 2 * S; d += step) {
      const a = Math.min(d, S), b = d - a;
      hatch += `M${f1(x + a)} ${f1(y + b)}L${f1(x + b)} ${f1(y + a)}`;
    }
  }
  s += `<path d="${hatch}" fill="none" stroke="${INK}" stroke-width=".4"/>`;
  s += `<rect x="${X0}" y="${Y0}" width="${8 * S}" height="${8 * S}" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
  s += `<rect x="${X0 - 3}" y="${Y0 - 3}" width="${8 * S + 6}" height="${8 * S + 6}" fill="none" stroke="${INK}" stroke-width=".5"/>`;
  for (let i = 0; i < 8; i++) s += text(X0 + (i + 0.5) * S, Y0 + 8 * S + 11, "abcdefgh"[i], 6) + text(X0 - 9, Y0 + (7.5 - i) * S + 2, String(i + 1), 6);

  // The journeys: each piece in its own lane of the square (a 4 × 4 grid of lanes, one per piece of a side).
  const lane = (id: number): [number, number] => {
    const k = id < 16 ? id : 63 - id;
    return [((k % 4) - 1.5) * 3.6, ((Math.floor(k / 4) % 4) - 1.5) * 3.6];
  };
  let solid = "", dashed = "", crosses = "", starts = "";
  for (const path of game.paths) {
    const [dx, dy] = lane(path.start);
    const pts = path.squares.map((sq) => centre(sq)).map(([x, y]) => [x + dx, y + dy] as [number, number]);
    if (pts.length < 2 && path.taken < 0) continue;
    const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${f1(x)} ${f1(y)}`).join("");
    if (pts.length > 1) {
      if (path.start < 16) solid += d;
      else dashed += d;
      starts += `<circle cx="${f1(pts[0][0])}" cy="${f1(pts[0][1])}" r="1.3" fill="${INK}"/>`;
    }
    if (path.taken >= 0) {
      const [x, y] = pts[pts.length - 1];
      crosses += `M${f1(x - 2.2)} ${f1(y - 2.2)}L${f1(x + 2.2)} ${f1(y + 2.2)}M${f1(x - 2.2)} ${f1(y + 2.2)}L${f1(x + 2.2)} ${f1(y - 2.2)}`;
    }
  }
  if (solid) s += `<path d="${solid}" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (dashed) s += `<path d="${dashed}" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="2.4 1.8" stroke-linejoin="round"/>`;
  s += starts;
  if (crosses) s += `<path d="${crosses}" fill="none" stroke="${GROUND}" stroke-width="3" stroke-linecap="round"/><path d="${crosses}" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>`;
  // Where they stand at the end.
  game.final.board.forEach((pc, sq) => {
    if (pc) s += glyph(pc, ...centre(sq));
  });

  s += scoreSheet(game.sans, Y0 + 8 * S + 26, 318);

  const plies = game.moves.length;
  const mate = inCheck(game.final) && legalMoves(game.final).length === 0;
  const result = p.r ? ({ "1-0": "1–0", "0-1": "0–1", "1/2": "1/2–1/2" } as const)[p.r] : null;
  const title = p.a || p.b ? `${p.a ?? "White"} v ${p.b ?? "Black"}` : "Your Game";
  const moves = Math.ceil(plies / 2);
  const sub = [`${moves} ${moves === 1 ? "move" : "moves"}`, mate ? "checkmate" : null, result].filter(Boolean).join(" · ");
  const date = p.d ? parseDate(p.d) : null;
  return [s, [title, sub, date ? longDate(...date) : undefined], 342];
}
/** The caption's lines (ours). */
export const chessCaption = (p: ChessParams): Lines => chessDraw(p)[1];

export function chessBody(p: ChessParams): string {
  const [s, lines, y] = chessDraw(p);
  return s + caption(y, ...captionLines(lines, p.cap));
}

export const captionOf = (spec: CustomSpec) => chessCaption((spec as { p: ChessParams }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(chessBody((spec as { p: ChessParams }).p), color);
