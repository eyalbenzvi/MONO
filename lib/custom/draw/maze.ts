/**
 * A perfect maze (every cell reachable, exactly one way between any two)
 * whose way through spells a word. The letters come from the pixel font
 * (lib/custom/draw/pixelFont), a diagonal step bridged so each glyph is one
 * piece; each font pixel becomes m × m blocks of 2 × 2 cells. Around a
 * seeded spanning tree of a letter's blocks runs a cycle through every one
 * of its cells (the doubled-grid trick: each block's four cells make a ring,
 * and each tree edge splices two rings into one), opened where a corridor
 * comes in and goes out. Corridors thread from the entrance through the
 * letters in order to the exit (Dijkstra over randomly weighted free cells),
 * and the rest of the maze grows off that path as a tree (the growing-tree
 * algorithm: newest cell first makes long corridors, a random cell many
 * short turnings), so the path stays the only way through.
 */
import { FONT } from "./pixelFont";
import { fnv1aChars } from "@/lib/hash";
import { mulberry32 } from "../rng";

export const N = 1, E = 2, S = 4, Wd = 8;
export interface Maze {
  cols: number;
  rows: number;
  /** Cell size in print units. */
  cell: number;
  /** Open sides of each cell (N, E, S, Wd bits), row by row. */
  open: Uint8Array;
  /** The way through, entrance to exit, as cell indices. */
  path: number[];
  /** Which letter (1-based) a cell belongs to, 0 for none. */
  letter: Uint8Array;
}

/** The area the maze fills (print units). */
export const AREA = { w: 256, h: 276 };
/**
 * Per number of letters and level: blocks per font pixel (m) and the largest cell (print units). The letters span
 * most of the width, so a harder maze is the same letters in finer cells; three letters can't go finer than m = 2
 * (cells of 3.6, walls of 0.5 with 3 between: the finest that prints cleanly).
 */
const LEVELS: Record<number, Record<1 | 2 | 3, [number, number]>> = {
  1: { 1: [2, 9], 2: [3, 6], 3: [4, 4.6] },
  2: { 1: [1, 10], 2: [2, 6], 3: [3, 4] },
  3: { 1: [1, 7], 2: [1, 5.4], 3: [2, 3.6] },
};
/** How often the tree grows from its newest cell (long corridors) rather than a random one (many short turnings). */
const NEWEST: Record<1 | 2 | 3, number> = { 1: 0.85, 2: 0.5, 3: 0.15 };

/** A glyph as a 7 × 5 grid of pixels, diagonal-only steps bridged (the lower cell of the two filled in) so it is one 4-connected piece. */
export function glyph(ch: string): boolean[][] {
  const g = FONT[ch].map((r) => [...r].map((c) => c === "X"));
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 5; c++) {
      if (g[r][c] && c < 4 && g[r + 1][c + 1] && !g[r][c + 1] && !g[r + 1][c]) g[r + 1][c] = true;
      if (g[r][c] && c > 0 && g[r + 1][c - 1] && !g[r][c - 1] && !g[r + 1][c]) g[r + 1][c] = true;
    }
  return g;
}

/** The grid for a word and level: cell size, columns, rows, and blocks per font pixel (m). */
export function mazeLayout(k: number, d: 1 | 2 | 3) {
  const P = 6 * k - 1;
  const [m, most] = LEVELS[k][d];
  const cell = Math.min(most, AREA.w / (2 * m * P + 4), AREA.h / (14 * m + 6));
  return { cell, cols: Math.floor(AREA.w / cell), rows: Math.floor(AREA.h / cell), m, P };
}

const fnv = fnv1aChars;

export function buildMaze(x: string, d: 1 | 2 | 3): Maze {
  for (let attempt = 0; ; attempt++) {
    const m = tryMaze(x, d, fnv(`${x}:${d}:${attempt}`));
    if (m) return m;
    if (attempt > 40) throw new Error(`maze: no layout for ${x}`);
  }
}

function tryMaze(x: string, d: 1 | 2 | 3, seed: number): Maze | null {
  const rnd = mulberry32(seed);
  const { cell, cols, rows, m, P } = mazeLayout(x.length, d);
  const n = cols * rows;
  const at = (r: number, c: number) => r * cols + c;
  const col0 = Math.floor((cols - 2 * m * P) / 2), row0 = Math.floor((rows - 14 * m) / 2);
  const letter = new Uint8Array(n);

  // Each letter's blocks (coarse cells, in its own coordinates) and the cycle through its cells.
  const cycles: Map<number, number[]>[] = [];
  [...x].forEach((ch, i) => {
    const g = glyph(ch);
    const R = 7 * m, C = 5 * m;
    const on = (r: number, c: number) => r >= 0 && c >= 0 && r < R && c < C && g[Math.floor(r / m)][Math.floor(c / m)];
    const cellOf = (r: number, c: number, sy: number, sx: number) => at(row0 + 2 * r + sy, col0 + 2 * (i * 6 * m + c) + sx);
    // A seeded spanning tree of the blocks (randomised depth-first).
    const blocks: [number, number][] = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (on(r, c)) blocks.push([r, c]);
    const seen = new Set<number>();
    const tree: [number, number, number, number][] = [];
    const [sr, sc] = blocks[Math.floor(rnd() * blocks.length)];
    const stack: [number, number][] = [[sr, sc]];
    seen.add(sr * C + sc);
    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const next = ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as [number, number][]).filter(([a, b]) => on(a, b) && !seen.has(a * C + b));
      if (!next.length) {
        stack.pop();
        continue;
      }
      // Mostly straight on (the cycle then runs in long lanes along the strokes, and the letters read).
      const prior = tree.length && stack.length > 1 ? stack[stack.length - 2] : null;
      const ahead = prior ? next.find(([a, b]) => a - r === r - prior[0] && b - c === c - prior[1]) : undefined;
      const [a, b] = ahead && rnd() < 0.55 ? ahead : next[Math.floor(rnd() * next.length)];
      seen.add(a * C + b);
      tree.push([r, c, a, b]);
      stack.push([a, b]);
    }
    if (seen.size !== blocks.length) throw new Error(`maze: glyph ${ch} is not one piece`);
    // Rings, spliced along the tree's edges.
    const adj = new Map<number, number[]>();
    const link = (p: number, q: number) => (adj.get(p)!.push(q), adj.get(q)!.push(p));
    const unlink = (p: number, q: number) => (adj.set(p, adj.get(p)!.filter((v) => v !== q)), adj.set(q, adj.get(q)!.filter((v) => v !== p)));
    for (const [r, c] of blocks) {
      const [tl, tr, br, bl] = [cellOf(r, c, 0, 0), cellOf(r, c, 0, 1), cellOf(r, c, 1, 1), cellOf(r, c, 1, 0)];
      for (const q of [tl, tr, br, bl]) adj.set(q, []), (letter[q] = i + 1);
      link(tl, tr), link(tr, br), link(br, bl), link(bl, tl);
    }
    for (const [r, c, a, b] of tree) {
      const [r0, c0, r1, c1] = a > r || b > c ? [r, c, a, b] : [a, b, r, c];
      if (r1 === r0) {
        unlink(cellOf(r0, c0, 0, 1), cellOf(r0, c0, 1, 1)), unlink(cellOf(r1, c1, 0, 0), cellOf(r1, c1, 1, 0));
        link(cellOf(r0, c0, 0, 1), cellOf(r1, c1, 0, 0)), link(cellOf(r0, c0, 1, 1), cellOf(r1, c1, 1, 0));
      } else {
        unlink(cellOf(r0, c0, 1, 0), cellOf(r0, c0, 1, 1)), unlink(cellOf(r1, c1, 0, 0), cellOf(r1, c1, 0, 1));
        link(cellOf(r0, c0, 1, 0), cellOf(r1, c1, 0, 0)), link(cellOf(r0, c0, 1, 1), cellOf(r1, c1, 0, 1));
      }
    }
    cycles.push(adj);
  });

  const used = new Uint8Array(n);
  const nbrs = (p: number) => {
    const r = Math.floor(p / cols), c = p % cols;
    const out: number[] = [];
    if (r > 0) out.push(p - cols);
    if (c < cols - 1) out.push(p + 1);
    if (r < rows - 1) out.push(p + cols);
    if (c > 0) out.push(p - 1);
    return out;
  };
  const free = (p: number) => !letter[p] && !used[p];
  // Shortest paths from a cell over free cells, each cell's cost random: corridors that wander a little.
  // The frame's own row and column cost more, so a corridor doesn't run along the edge in plain view.
  const weight = Float32Array.from({ length: n }, (_, p) => 1 + 3 * rnd() + (p < cols || p >= n - cols || p % cols === 0 || p % cols === cols - 1 ? 8 : 0));
  const reach = (from: number) => {
    const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
    // A binary heap of [distance, cell].
    const hd: number[] = [], hc: number[] = [];
    const push = (dd: number, p: number) => {
      let i = hd.length;
      hd.push(dd), hc.push(p);
      while (i > 0) {
        const up = (i - 1) >> 1;
        if (hd[up] <= hd[i]) break;
        [hd[up], hd[i], hc[up], hc[i]] = [hd[i], hd[up], hc[i], hc[up]];
        i = up;
      }
    };
    const pop = (): [number, number] => {
      const top: [number, number] = [hd[0], hc[0]];
      const [ld, lc] = [hd.pop()!, hc.pop()!];
      if (hd.length) {
        hd[0] = ld, hc[0] = lc;
        for (let i = 0; ; ) {
          const [l, r] = [2 * i + 1, 2 * i + 2];
          let s = i;
          if (l < hd.length && hd[l] < hd[s]) s = l;
          if (r < hd.length && hd[r] < hd[s]) s = r;
          if (s === i) break;
          [hd[s], hd[i], hc[s], hc[i]] = [hd[i], hd[s], hc[i], hc[s]];
          i = s;
        }
      }
      return top;
    };
    dist[from] = 0;
    push(0, from);
    while (hd.length) {
      const [dd, p] = pop();
      if (dd > dist[p]) continue;
      for (const q of nbrs(p))
        if (free(q) && dd + weight[q] < dist[q]) (dist[q] = dd + weight[q]), (prev[q] = p), push(dist[q], q);
    }
    return { dist, prev };
  };
  const trace = (prev: Int32Array, to: number) => {
    const out = [to];
    while (prev[out[0]] >= 0) out.unshift(prev[out[0]]);
    return out;
  };

  const entry = at(0, Math.floor(rnd() * Math.max(1, col0)) + 1);
  const path: number[] = [entry];
  used[entry] = 1;
  let cur = entry;
  for (let i = 0; i < x.length; i++) {
    const adj = cycles[i];
    const { dist, prev } = reach(cur);
    // Where the corridor meets the letter: a cycle edge (u, v) with a free cell beside each; nearer the next letter is likelier.
    const cands: { u: number; v: number; fu: number; fv: number; score: number }[] = [];
    const towards = i + 1 < x.length ? col0 + 2 * m * (i + 1) * 6 : cols;
    for (const [u, vs] of adj)
      for (const v of vs) {
        const fus = nbrs(u).filter((q) => free(q) && dist[q] < Infinity);
        const fvs = nbrs(v).filter(free);
        for (const fu of fus)
          for (const fv of fvs)
            if (fu !== fv) cands.push({ u, v, fu, fv, score: dist[fu] * 0.2 + Math.abs((fv % cols) - towards) * 0.5 + rnd() * 12 });
      }
    cands.sort((a, b) => a.score - b.score);
    let done = false;
    for (const cd of cands) {
      const corridor = trace(prev, cd.fu);
      if (corridor.includes(cd.fv)) continue;
      corridor.slice(1).forEach((q) => (used[q] = 1));
      path.push(...corridor.slice(1));
      // Round the letter from u, the long way, to v.
      let [a, b] = [cd.u, cd.u];
      path.push(a);
      let next = adj.get(a)!.find((q) => q !== cd.v)!;
      while (next !== cd.v) {
        path.push(next);
        [b, a] = [a, next];
        next = adj.get(a)!.find((q) => q !== b)!;
      }
      path.push(cd.v, cd.fv);
      used[cd.fv] = 1;
      cur = cd.fv;
      done = true;
      break;
    }
    if (!done) return null;
  }
  // Out through the bottom edge, on the right.
  const { dist, prev } = reach(cur);
  const exits = Array.from({ length: cols - 2 }, (_, c) => at(rows - 1, c + 1)).filter((p) => dist[p] < Infinity);
  if (!exits.length) return null;
  exits.sort((p, q) => Math.abs((p % cols) - cols * 0.8) - Math.abs((q % cols) - cols * 0.8) || p - q);
  const exit = exits[Math.floor(rnd() * Math.min(4, exits.length))];
  const tail = trace(prev, exit);
  tail.slice(1).forEach((q) => (used[q] = 1));
  path.push(...tail.slice(1));

  // Carve the way through, then grow the rest of the maze off it.
  const open = new Uint8Array(n);
  const carve = (p: number, q: number) => {
    const bit = q === p - cols ? N : q === p + 1 ? E : q === p + cols ? S : Wd;
    const back = bit === N ? S : bit === S ? N : bit === E ? Wd : E;
    open[p] |= bit;
    open[q] |= back;
  };
  for (let i = 1; i < path.length; i++) carve(path[i - 1], path[i]);
  open[entry] |= N;
  open[exit] |= S;
  const inTree = new Uint8Array(n);
  path.forEach((p) => (inTree[p] = 1));
  const active = [...path];
  for (let i = active.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [active[i], active[j]] = [active[j], active[i]];
  }
  while (active.length) {
    const k = rnd() < NEWEST[d] ? active.length - 1 : Math.floor(rnd() * active.length);
    const p = active[k];
    const out = nbrs(p).filter((q) => !inTree[q]);
    if (!out.length) {
      active[k] = active[active.length - 1];
      active.pop();
      continue;
    }
    const q = out[Math.floor(rnd() * out.length)];
    carve(p, q);
    inTree[q] = 1;
    active.push(q);
  }
  return { cols, rows, cell, open, path, letter };
}
