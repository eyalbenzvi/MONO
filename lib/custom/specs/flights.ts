/**
 * Your Flights, two ways: a boarding pass (your name, from and to as large
 * airport codes, the day, a seat, a gate, a barcode) or a departures board
 * (the places you've flown to, a row each on split flaps, the year and a
 * status). Airports of data/airports (OurAirports), by IATA code. Drawn by
 * lib/custom/templates/flights.
 */
import { FIRST_YEAR, LAST_YEAR, int, label, parseDate, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

/** A row on the board: the airport, and the year (optional). */
export type Departure = [iata: string, year?: number];

export interface Params {
  k: "pass" | "board";
  /** The passenger (the pass) or whose board (optional there). */
  n?: string;
  /** From and to (the pass). */
  f?: string;
  t?: string;
  d?: string;
  /** Seat ("14A") and gate ("B22"), both optional. */
  s?: string;
  g?: string;
  /** The board's rows. */
  x?: Departure[];
  cap?: Cap;
}

export const NAME = "Your Flights";
export const PASSENGER_MAX = 18;
export const BOARD_MAX = 8;
export const IATA = /^[A-Z]{3}$/;
export const SEAT = /^([1-9]|[1-9]\d)[A-K]$/;
export const GATE = /^[A-Z]?([1-9]|[1-9]\d)[A-Z]?$/;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (p.n !== undefined && !label(p.n, PASSENGER_MAX)) return null;
  const n = p.n !== undefined ? { n: p.n as string } : {};
  if (p.k === "pass") {
    if (p.n === undefined || typeof p.f !== "string" || !IATA.test(p.f) || typeof p.t !== "string" || !IATA.test(p.t) || p.f === p.t) return null;
    if (p.d !== undefined && !parseDate(p.d)) return null;
    if (p.s !== undefined && (typeof p.s !== "string" || !SEAT.test(p.s))) return null;
    if (p.g !== undefined && (typeof p.g !== "string" || !GATE.test(p.g))) return null;
    if (p.x !== undefined) return null;
    return { k: "pass", ...n, f: p.f, t: p.t, ...(p.d !== undefined ? { d: p.d as string } : {}), ...(p.s !== undefined ? { s: p.s as string } : {}), ...(p.g !== undefined ? { g: p.g as string } : {}) };
  }
  if (p.k === "board") {
    if (!Array.isArray(p.x) || p.x.length < 1 || p.x.length > BOARD_MAX) return null;
    const x: Departure[] = [];
    for (const e of p.x as unknown[]) {
      if (!Array.isArray(e) || e.length < 1 || e.length > 2 || typeof e[0] !== "string" || !IATA.test(e[0])) return null;
      if (e.length === 2 && !int(e[1], FIRST_YEAR, LAST_YEAR)) return null;
      x.push(e.length === 2 ? [e[0], e[1] as number] : [e[0]]);
    }
    if (p.f !== undefined || p.t !== undefined || p.d !== undefined || p.s !== undefined || p.g !== undefined) return null;
    return { k: "board", ...n, x };
  }
  return null;
}

export const detail = (p: Params) => (p.k === "pass" ? `${p.f} to ${p.t}` : `${p.x!.length} departures`);

export const PRODUCT: ProductMeta<Params> = {
  line: "A boarding pass for the flight that mattered, or a board of every one.",
  from: "Your flights",
  group: "travels",
  base: "terminal-data",
  bases: ["terminal-data", "matrix"],
  wordsHint: "Noa Cohen",
  hints: { dense: "Try fewer rows.", faint: "Try another row or two." },
  example: { k: "board", n: "Noa", x: [["NRT", 2019], ["JFK", 2016], ["CDG", 2014], ["LHR", 2011], ["FCO", 2009], ["TLV", 2023]] },
};
