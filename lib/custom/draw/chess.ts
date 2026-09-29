/**
 * Chess, as much as a game's record needs: the board, the legal moves of a
 * position (castling, en passant, promotion, never into check), a move
 * applied, a move written in standard algebraic notation (SAN) and read
 * back, and a PGN file read on the device (its headers, and its moves with
 * the comments, variations and annotation glyphs taken out). No dependency;
 * Your Game's editor reads a pasted game with it and its template replays
 * the stored moves with it.
 */

/** A square: 0 = a1, 7 = h1, 56 = a8, 63 = h8. */
export type Square = number;
/** Pieces as FEN writes them: upper case white, lower case black; "" empty. */
export type Piece = "" | "P" | "N" | "B" | "R" | "Q" | "K" | "p" | "n" | "b" | "r" | "q" | "k";
export type Promo = "n" | "b" | "r" | "q";

export interface Position {
  board: Piece[];
  white: boolean;
  /** Castling still allowed: white king side, white queen side, black king side, black queen side. */
  castle: [boolean, boolean, boolean, boolean];
  /** The square a pawn skipped last move (en passant), or −1. */
  ep: Square;
}

export interface Move {
  from: Square;
  to: Square;
  promo?: Promo;
}

const START = "RNBQKBNRPPPPPPPP" + ".".repeat(32) + "pppppppprnbqkbnr";
export const startPosition = (): Position => ({ board: [...START].map((c) => (c === "." ? "" : c) as Piece), white: true, castle: [true, true, true, true], ep: -1 });

export const fileOf = (s: Square) => s & 7;
export const rankOf = (s: Square) => s >> 3;
export const squareName = (s: Square) => "abcdefgh"[fileOf(s)] + String(rankOf(s) + 1);
const isWhite = (p: Piece) => p !== "" && p === p.toUpperCase();
const own = (p: Piece, white: boolean) => p !== "" && isWhite(p) === white;

const KNIGHT: [number, number][] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const at = (f: number, r: number) => (f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1);

/** Whether a side (white when `byWhite`) attacks a square. */
export function attacked(board: Piece[], sq: Square, byWhite: boolean): boolean {
  const f = fileOf(sq), r = rankOf(sq);
  const is = (s: number, kinds: string) => s >= 0 && board[s] !== "" && isWhite(board[s]) === byWhite && kinds.includes(board[s].toLowerCase());
  // Pawns attack diagonally forward: a white pawn from one rank below.
  const pr = byWhite ? r - 1 : r + 1;
  if (is(at(f - 1, pr), "p") || is(at(f + 1, pr), "p")) return true;
  if (KNIGHT.some(([df, dr]) => is(at(f + df, r + dr), "n"))) return true;
  if (KING.some(([df, dr]) => is(at(f + df, r + dr), "k"))) return true;
  const ray = (dirs: [number, number][], kinds: string) =>
    dirs.some(([df, dr]) => {
      for (let k = 1; k < 8; k++) {
        const s = at(f + df * k, r + dr * k);
        if (s < 0) return false;
        if (board[s] !== "") return is(s, kinds);
      }
      return false;
    });
  return ray(ROOK, "rq") || ray(BISHOP, "bq");
}

export const kingSquare = (board: Piece[], white: boolean) => board.indexOf(white ? "K" : "k");
export const inCheck = (pos: Position) => attacked(pos.board, kingSquare(pos.board, pos.white), !pos.white);

/** Moves by the rules of each piece, before checking the king is safe. */
function pseudo(pos: Position): Move[] {
  const { board, white } = pos;
  const out: Move[] = [];
  for (let s = 0; s < 64; s++) {
    const p = board[s];
    if (!own(p, white)) continue;
    const f = fileOf(s), r = rankOf(s);
    const kind = p.toLowerCase();
    const add = (to: number) => to >= 0 && !own(board[to], white) && out.push({ from: s, to });
    if (kind === "p") {
      const dir = white ? 1 : -1, last = white ? 7 : 0, home = white ? 1 : 6;
      const push = (to: number) => {
        if (rankOf(to) === last) for (const promo of ["q", "r", "b", "n"] as Promo[]) out.push({ from: s, to, promo });
        else out.push({ from: s, to });
      };
      const one = at(f, r + dir);
      if (one >= 0 && board[one] === "") {
        push(one);
        const two = at(f, r + 2 * dir);
        if (r === home && board[two] === "") out.push({ from: s, to: two });
      }
      for (const df of [-1, 1]) {
        const to = at(f + df, r + dir);
        if (to < 0) continue;
        if ((board[to] !== "" && !own(board[to], white)) || to === pos.ep) push(to);
      }
    } else if (kind === "n") KNIGHT.forEach(([df, dr]) => add(at(f + df, r + dr)));
    else if (kind === "k") {
      KING.forEach(([df, dr]) => add(at(f + df, r + dr)));
      // Castling: rights kept, the squares between empty, the king not in, through or into check.
      const [ks, qs] = white ? [pos.castle[0], pos.castle[1]] : [pos.castle[2], pos.castle[3]];
      const base = white ? 0 : 56;
      if (s === base + 4 && !attacked(board, s, !white)) {
        if (ks && board[base + 5] === "" && board[base + 6] === "" && board[base + 7] === (white ? "R" : "r") && !attacked(board, base + 5, !white)) out.push({ from: s, to: base + 6 });
        if (qs && board[base + 3] === "" && board[base + 2] === "" && board[base + 1] === "" && board[base] === (white ? "R" : "r") && !attacked(board, base + 3, !white)) out.push({ from: s, to: base + 2 });
      }
    } else {
      const dirs = kind === "r" ? ROOK : kind === "b" ? BISHOP : [...ROOK, ...BISHOP];
      for (const [df, dr] of dirs)
        for (let k = 1; k < 8; k++) {
          const to = at(f + df * k, r + dr * k);
          if (to < 0 || own(board[to], white)) break;
          out.push({ from: s, to });
          if (board[to] !== "") break;
        }
    }
  }
  return out;
}

/** The position after a move (assumed legal): the rook comes along when castling, the pawn taken en passant goes, a pawn promotes (to a queen unless said). */
export function play(pos: Position, m: Move): Position {
  const board = [...pos.board];
  const p = board[m.from];
  const kind = p.toLowerCase();
  const white = pos.white;
  if (kind === "p" && m.to === pos.ep && board[m.to] === "") board[m.to + (white ? -8 : 8)] = "";
  if (kind === "k" && Math.abs(m.to - m.from) === 2) {
    const [rf, rt] = m.to > m.from ? [m.from + 3, m.from + 1] : [m.from - 4, m.from - 1];
    board[rt] = board[rf];
    board[rf] = "";
  }
  board[m.to] = kind === "p" && (rankOf(m.to) === 7 || rankOf(m.to) === 0) ? ((white ? (m.promo ?? "q").toUpperCase() : (m.promo ?? "q")) as Piece) : p;
  board[m.from] = "";
  const castle = [...pos.castle] as Position["castle"];
  // A king or rook that moves, or a rook taken on its square, ends that castling.
  const touch = (s: number) => {
    if (s === 4) castle[0] = castle[1] = false;
    if (s === 60) castle[2] = castle[3] = false;
    if (s === 7) castle[0] = false;
    if (s === 0) castle[1] = false;
    if (s === 63) castle[2] = false;
    if (s === 56) castle[3] = false;
  };
  touch(m.from);
  touch(m.to);
  const ep = kind === "p" && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1;
  return { board, white: !white, castle, ep };
}

/** The legal moves: the rules of each piece, never leaving one's own king in check. */
export function legalMoves(pos: Position): Move[] {
  return pseudo(pos).filter((m) => {
    const next = play(pos, m);
    return !attacked(next.board, kingSquare(next.board, pos.white), !pos.white);
  });
}

/** Whether a move is legal here (a missing promotion is a queen's). */
export const isLegal = (pos: Position, m: Move) => legalMoves(pos).some((x) => x.from === m.from && x.to === m.to && (x.promo ?? "q") === (m.promo ?? "q"));

/** A move as SAN ("Nbd7", "exd6", "O-O", "e8=Q+"), check and mate marked. */
export function toSan(pos: Position, m: Move): string {
  const p = pos.board[m.from].toLowerCase();
  let san: string;
  if (p === "k" && Math.abs(m.to - m.from) === 2) san = m.to > m.from ? "O-O" : "O-O-O";
  else {
    const capture = pos.board[m.to] !== "" || (p === "p" && m.to === pos.ep);
    if (p === "p") san = (capture ? `${"abcdefgh"[fileOf(m.from)]}x` : "") + squareName(m.to) + (rankOf(m.to) === 7 || rankOf(m.to) === 0 ? `=${(m.promo ?? "q").toUpperCase()}` : "");
    else {
      // Disambiguate by file, else rank, else both, among the same pieces that could go there.
      const rivals = legalMoves(pos).filter((x) => x.to === m.to && x.from !== m.from && pos.board[x.from] === pos.board[m.from]);
      let dis = "";
      if (rivals.length) {
        if (!rivals.some((x) => fileOf(x.from) === fileOf(m.from))) dis = "abcdefgh"[fileOf(m.from)];
        else if (!rivals.some((x) => rankOf(x.from) === rankOf(m.from))) dis = String(rankOf(m.from) + 1);
        else dis = squareName(m.from);
      }
      san = p.toUpperCase() + dis + (capture ? "x" : "") + squareName(m.to);
    }
  }
  const next = play(pos, m);
  if (inCheck(next)) san += legalMoves(next).length ? "+" : "#";
  return san;
}

const SAN = /^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(?:=?([NBRQ]))?$/;
/** A SAN move read in a position: the legal move it names, or null (not legal, or ambiguous). */
export function fromSan(pos: Position, token: string): Move | null {
  const t = token.replace(/[+#!?]+$/g, "").replace(/e\.p\.$/, "");
  const moves = legalMoves(pos);
  const castle = /^[O0]-[O0](-[O0])?$/.exec(t);
  if (castle) {
    const from = pos.white ? 4 : 60;
    const to = castle[1] ? from - 2 : from + 2;
    return moves.find((m) => m.from === from && m.to === to && pos.board[from].toLowerCase() === "k") ?? null;
  }
  const m = SAN.exec(t);
  if (!m) return null;
  const [, piece = "P", file, rank, dest, promo] = m;
  const to = (Number(dest[1]) - 1) * 8 + "abcdefgh".indexOf(dest[0]);
  const hits = moves.filter(
    (x) =>
      x.to === to &&
      pos.board[x.from].toUpperCase() === piece &&
      (!file || fileOf(x.from) === "abcdefgh".indexOf(file)) &&
      (!rank || rankOf(x.from) === Number(rank) - 1) &&
      (x.promo ?? "") === (x.promo ? (promo ?? "Q").toLowerCase() : ""),
  );
  return hits.length === 1 ? hits[0] : null;
}

export interface Game {
  moves: Move[];
  white?: string;
  black?: string;
  /** The date as the PGN has it, when whole ("YYYY-MM-DD"). */
  date?: string;
  result?: "1-0" | "0-1" | "1/2";
  /** Moves beyond the cap were left out. */
  cut: boolean;
}

/**
 * A PGN (or bare moves) read and replayed: the first game only, its moves
 * checked one by one. The game, or why not in one line ("Move 12: Nf3
 * isn't legal there.").
 */
export function readPgn(text: string, maxPlies: number): { game: Game } | { error: string } {
  const tags: Record<string, string> = {};
  const body = text.replace(/^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]\s*$/gm, (_m, k: string, v: string) => {
    if (!(k in tags)) tags[k] = v.replace(/\\(.)/g, "$1");
    return " ";
  });
  if (tags.SetUp === "1" || (tags.FEN && tags.FEN.split(" ")[0] !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")) return { error: "Only games from the usual starting position." };
  // Comments, the rest of a line after ";", variations (nested), annotation glyphs, move numbers.
  let moveText = body.replace(/\{[^}]*\}/g, " ").replace(/;[^\n]*/g, " ");
  for (let prev = ""; prev !== moveText; ) (prev = moveText), (moveText = moveText.replace(/\([^()]*\)/g, " "));
  moveText = moveText.replace(/\$\d+/g, " ").replace(/\d+\s*\.(\s*\.\.)?(\.)*/g, " ");
  const tokens = moveText.split(/\s+/).filter(Boolean);
  let pos = startPosition();
  const moves: Move[] = [];
  let result: Game["result"];
  let cut = false;
  for (const tok of tokens) {
    if (/^(1-0|0-1|1\/2-1\/2|½-½|\*)$/.test(tok)) {
      result = tok === "1-0" ? "1-0" : tok === "0-1" ? "0-1" : tok === "*" ? undefined : "1/2";
      break;
    }
    if (/^[!?]+$/.test(tok)) continue;
    if (moves.length >= maxPlies) {
      cut = true;
      break;
    }
    const m = fromSan(pos, tok);
    if (!m) return { error: `Move ${Math.floor(moves.length / 2) + 1}${pos.white ? "" : "…"}: ${tok.slice(0, 12)} isn't legal there.` };
    moves.push(m);
    pos = play(pos, m);
  }
  if (!moves.length) return { error: "No moves found. Paste the game's moves (PGN)." };
  const tagResult = tags.Result === "1-0" || tags.Result === "0-1" ? tags.Result : tags.Result === "1/2-1/2" ? "1/2" : undefined;
  const d = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(tags.Date ?? "");
  const name = (s: string | undefined) => (s && s !== "?" && s !== "" ? s : undefined);
  return { game: { moves, white: name(tags.White), black: name(tags.Black), date: d ? `${d[1]}-${d[2]}-${d[3]}` : undefined, result: result ?? tagResult, cut } };
}

/* The spec's form: two characters a ply (from, to), each square one base64url digit; promotions other than a queen listed apart. */
const DIGITS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export const encodeMoves = (moves: Move[]) => moves.map((m) => DIGITS[m.from] + DIGITS[m.to]).join("");
export const decodeMoves = (s: string): Move[] => Array.from({ length: s.length / 2 }, (_, i) => ({ from: DIGITS.indexOf(s[2 * i]), to: DIGITS.indexOf(s[2 * i + 1]) }));
export const PROMOS: Promo[] = ["q", "n", "b", "r"];
