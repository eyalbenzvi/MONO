/**
 * A crossword built from a list of words, the way a setter fits names: the
 * longest word goes in first, across; each next word goes where it crosses
 * the most letters already down (never running alongside another word,
 * never touching one end to end). The order the rest go in is tried many
 * times over, shuffled by a seed from the words themselves, and the most
 * compact grid with the most words joined up is kept. A word that crosses
 * nothing sits on its own, an island a cell clear of the rest. Pure and
 * deterministic: the same words, the same grid, on every device.
 */
import { fnv1aChars } from "@/lib/hash";
import { mulberry32 } from "../rng";

export interface Placed {
  word: string;
  /** Row and column of the first letter (from the grid's top left once normalised). */
  r: number;
  c: number;
  /** Across (true) or down. */
  across: boolean;
  /** Crosses nothing: an island. */
  island: boolean;
}
export interface Crossword {
  placed: Placed[];
  rows: number;
  cols: number;
  /** Cells where two words cross. */
  crossings: number;
  /** The words that cross nothing, in the order given. */
  islands: string[];
}

/** FNV-1a of the words in order: the builder's seed. */
export function wordsSeed(words: readonly string[]): number {
  return fnv1aChars(words.join(" "));
}

type Cell = { ch: string; a: boolean; d: boolean };

/** A cell's key: row and column packed in one number (both well within ±500). */
const K = (r: number, c: number) => (r + 512) * 1024 + c + 512;

class Grid {
  cells = new Map<number, Cell>();
  /** Where each letter is, for the words still to place. */
  at = new Map<string, number[]>();
  placed: Placed[] = [];
  r0 = 0;
  r1 = -1;
  c0 = 0;
  c1 = -1;
  get(r: number, c: number) {
    return this.cells.get(K(r, c));
  }
  /** How many letters a word would cross there, or -1 when it can't go there. */
  fits(word: string, r: number, c: number, across: boolean): number {
    const [dr, dc] = across ? [0, 1] : [1, 0];
    if (this.get(r - dr, c - dc) || this.get(r + dr * word.length, c + dc * word.length)) return -1;
    let cross = 0;
    for (let i = 0; i < word.length; i++) {
      const [rr, cc] = [r + dr * i, c + dc * i];
      const cell = this.get(rr, cc);
      if (cell) {
        if (cell.ch !== word[i] || (across ? cell.a : cell.d)) return -1;
        cross++;
      } else if (this.get(rr + dc, cc + dr) || this.get(rr - dc, cc - dr)) return -1;
    }
    return cross === word.length ? -1 : cross;
  }
  put(word: string, r: number, c: number, across: boolean, island: boolean) {
    const [dr, dc] = across ? [0, 1] : [1, 0];
    for (let i = 0; i < word.length; i++) {
      const [rr, cc] = [r + dr * i, c + dc * i];
      const key = K(rr, cc);
      const had = this.cells.get(key);
      const cell = had ?? { ch: word[i], a: false, d: false };
      if (!had) this.at.set(word[i], [...(this.at.get(word[i]) ?? []), key]);
      if (across) cell.a = true;
      else cell.d = true;
      this.cells.set(key, cell);
      if (this.r1 < this.r0) [this.r0, this.r1, this.c0, this.c1] = [rr, rr, cc, cc];
      [this.r0, this.r1, this.c0, this.c1] = [Math.min(this.r0, rr), Math.max(this.r1, rr), Math.min(this.c0, cc), Math.max(this.c1, cc)];
    }
    this.placed.push({ word, r, c, across, island });
  }
  /** The bounding box's size if a word went there. */
  extent(word: string, r: number, c: number, across: boolean): [number, number] {
    const [r2, c2] = across ? [r, c + word.length - 1] : [r + word.length - 1, c];
    return [Math.max(this.r1, r2) - Math.min(this.r0, r) + 1, Math.max(this.c1, c2) - Math.min(this.c0, c) + 1];
  }
}

/** A grid's cost: its size squared, the taller side weighted to suit a print a little wider than the grid area is tall. */
const cost = (rows: number, cols: number) => Math.max(cols, rows * 1.15) ** 2 + rows * cols * 0.25;

function attempt(order: string[], rnd: () => number): Grid {
  const g = new Grid();
  g.put(order[0], 0, 0, true, false);
  const rest = order.slice(1);
  const later: string[] = [];
  // Words that cross nothing yet are tried again once the rest are in (a later word may give them a letter).
  for (let pass = 0; pass < 2; pass++) {
    const list = pass ? later.splice(0) : rest;
    for (const word of list) {
      let best: { r: number; c: number; across: boolean; score: number } | null = null;
      for (let i = 0; i < word.length; i++)
        for (const key of g.at.get(word[i]) ?? []) {
          const [cr, cc] = [Math.floor(key / 1024) - 512, (key % 1024) - 512];
          for (const across of [true, false]) {
            const [r, c] = across ? [cr, cc - i] : [cr - i, cc];
            const x = g.fits(word, r, c, across);
            if (x <= 0) continue;
            const [h, w] = g.extent(word, r, c, across);
            const score = x * 40 - cost(h, w) + rnd() * 3;
            if (!best || score > best.score) best = { r, c, across, score };
          }
        }
      if (best) g.put(word, best.r, best.c, best.across, false);
      else if (!pass) later.push(word);
      else {
        // An island: the most compact free place, a cell clear of every word.
        let spot: { r: number; c: number; across: boolean; score: number } | null = null;
        for (const across of [true, false])
          for (let r = g.r0 - (across ? 2 : word.length + 1); r <= g.r1 + 2; r++)
            for (let c = g.c0 - (across ? word.length + 1 : 2); c <= g.c1 + 2; c++) {
              if (!clear(g, word, r, c, across)) continue;
              const [h, w] = g.extent(word, r, c, across);
              const score = -cost(h, w);
              if (!spot || score > spot.score) spot = { r, c, across, score };
            }
        g.put(word, spot!.r, spot!.c, spot!.across, true);
      }
    }
  }
  return g;
}

/** No letter of the word on or next to (sides and corners) any cell in use. */
function clear(g: Grid, word: string, r: number, c: number, across: boolean): boolean {
  for (let i = 0; i < word.length; i++) {
    const [rr, cc] = across ? [r, c + i] : [r + i, c];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (g.get(rr + a, cc + b)) return false;
  }
  return true;
}

/** How many orders are tried (the first is plain longest first). */
const TRIES = 24;

export function buildCrossword(words: readonly string[]): Crossword {
  const rnd = mulberry32(wordsSeed(words));
  // Longest first, ties in the order given.
  const base = words.map((w, i) => [w, i] as const).sort((a, b) => b[0].length - a[0].length || a[1] - b[1]).map(([w]) => w);
  let best: { g: Grid; score: number } | null = null;
  for (let t = 0; t < TRIES; t++) {
    const order = [...base];
    if (t) {
      // Keep the longest first half the time; shuffle the rest.
      const from = t % 2 ? 1 : 0;
      for (let i = order.length - 1; i > from; i--) {
        const j = from + Math.floor(rnd() * (i - from + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    const g = attempt(order, rnd);
    const islands = g.placed.filter((p) => p.island).length;
    const crossings = [...g.cells.values()].filter((c) => c.a && c.d).length;
    const score = -islands * 10_000 - cost(g.r1 - g.r0 + 1, g.c1 - g.c0 + 1) + crossings * 6;
    if (!best || score > best.score) best = { g, score };
  }
  const g = best!.g;
  const placed = g.placed.map((p) => ({ ...p, r: p.r - g.r0, c: p.c - g.c0 }));
  return {
    placed: words.map((w) => placed.find((p) => p.word === w)!),
    rows: g.r1 - g.r0 + 1,
    cols: g.c1 - g.c0 + 1,
    crossings: [...g.cells.values()].filter((c) => c.a && c.d).length,
    islands: words.filter((w) => placed.find((p) => p.word === w)!.island),
  };
}
