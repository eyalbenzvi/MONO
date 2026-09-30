/**
 * Your Front Page: The Daily (your name) in blackletter across the top, the
 * day, the edition and the price between rules, your headline in the
 * condensed as large as it will go, the standfirst in the serif, and three
 * columns of our copy (specs/frontpage FRONTPAGE_COPY) with rules between
 * them, seeded by the page so the same page always reads the same.
 */
import { caption, captionLines, line, longDate, text, textWidth, wrapWords, type Lines } from "../kit";
import { mulberry32 } from "../rng";
import { parseDate } from "../specKit";
import { FRONTPAGE_COPY, headlineFit, standfirstFit, type Params } from "../specs/frontpage";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const X0 = 22, X1 = 278, BOTTOM = 322;
const SERIF = "serif" as const, COND = "condensed" as const;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** The columns' type: size, line pitch, the gutter. */
const BODY = 6.2, PITCH = 7.6, GUTTER = 10;

const dayLine = (d?: string) => {
  const p = d ? parseDate(d) : null;
  if (!p) return "Late edition";
  const wd = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return `${WEEKDAYS[wd]}, ${longDate(...p)}`;
};

/** The caption's lines (ours): the paper, the headline (when it fits a line), the day. */
export function frontpageCaption(p: Params): Lines {
  return [`The Daily ${p.n}`, p.h.length <= 40 ? p.h : "Front page news", p.d ? dayLine(p.d) : "Late edition"];
}

/** A string's hash (FNV-1a): the copy's seed. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** The copy in the page's order: a seeded shuffle, the name set in, "Continued on page two" kept for the end. */
function copyFor(p: Params): string[] {
  const rnd = mulberry32(hash(`${p.n}|${p.h}|${p.d ?? ""}`));
  const pool = FRONTPAGE_COPY.slice(0, -1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.map((s) => s.replaceAll("{n}", p.n));
}

/**
 * The three columns from `top` to the foot: whole paragraphs, a half line
 * between, each column filled before the next, the last column ending on
 * "Continued on page two".
 */
function columns(p: Params, top: number): string {
  const w = (X1 - X0 - 2 * GUTTER) / 3;
  const rows = Math.floor((BOTTOM - 12 - top) / PITCH);
  const set = (para: string) => wrapWords(para, w, BODY, { family: SERIF }) ?? [];
  const end = set(FRONTPAGE_COPY[FRONTPAGE_COPY.length - 1]);
  const cols: string[][] = [[], [], []];
  // Each column in turn takes the paragraphs, in the page's order, that still fit it whole; the last keeps the ending's room.
  let pool = copyFor(p).map(set).filter((l) => l.length);
  cols.forEach((col, i) => {
    const room = rows - (i === 2 ? end.length + 1 : 0);
    pool = pool.filter((lines) => {
      const needs = lines.length + (col.length ? 1 : 0);
      if (col.length + needs > room) return true;
      if (col.length) col.push("");
      col.push(...lines);
      return false;
    });
  });
  if (cols[2].length) cols[2].push("");
  cols[2].push(...end);
  let s = "";
  cols.forEach((c, i) => c.forEach((l, j) => l && (s += text(X0 + i * (w + GUTTER), top + BODY + j * PITCH, l, BODY, { family: SERIF, anchor: "start" }))));
  // The rules between the columns.
  for (const i of [1, 2]) {
    const x = X0 + i * (w + GUTTER) - GUTTER / 2;
    s += line(x, top, x, top + rows * PITCH - 2, 0.5);
  }
  return s;
}

export function frontpageBody(p: Params): string {
  // The masthead: the paper's name as large as fits.
  const mast = `The Daily ${p.n}`;
  const mSize = Math.min(40, (X1 - X0) / textWidth(mast, 1, { family: "blackletter" }));
  let s = text(X0, 28, "No. 1  ·  Est. the day you arrived", 5.5, { anchor: "start", family: SERIF }) + text(X1, 28, "All the news that concerns you", 5.5, { anchor: "end", family: SERIF });
  s += text(150, 36 + mSize * 0.78, mast, Math.round(mSize * 10) / 10, { family: "blackletter" });
  let y = 36 + mSize + 4;
  // The day, the edition and the price between rules.
  s += line(X0, y, X1, y, 1.4) + line(X0, y + 2.5, X1, y + 2.5, 0.5);
  s += text(X0, y + 11, dayLine(p.d), 6.5, { family: SERIF, anchor: "start" }) + text(150, y + 11, "FINAL", 6.5, { family: COND, bold: true, spacing: 1.5 }) + text(X1, y + 11, "Price: one biscuit", 6.5, { family: SERIF, anchor: "end" });
  y += 15;
  s += line(X0, y, X1, y, 0.5);
  // The headline.
  const h = headlineFit(p.h)!;
  y += 4;
  for (const l of h.lines) {
    y += h.size * 0.9;
    s += text(150, y, l, h.size, { family: COND, bold: true });
    y += h.size * 0.14;
  }
  y += 6;
  // The standfirst.
  if (p.s) {
    const f = standfirstFit(p.s)!;
    for (const l of f.lines) {
      y += f.size * 1.15;
      s += text(150, y, l, f.size, { family: SERIF });
    }
    y += 6;
  }
  s += line(X0, y, X1, y, 0.8);
  s += columns(p, y + 6);
  s += line(X0, BOTTOM - 6, X1, BOTTOM - 6, 0.8);
  return s + caption(346, ...captionLines(frontpageCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => frontpageCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(frontpageBody((spec as { p: Params }).p), color);
