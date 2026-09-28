/**
 * A city's local time on a given date, to UTC: the offset for that date from
 * the IANA zone (historic offsets and summer time included), through
 * Intl.DateTimeFormat, so Node and every browser agree. Before a zone kept
 * standard time, ICU gives local mean time, which is what a sky of that
 * night really was.
 */

const formats = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = formats.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    formats.set(tz, f);
  }
  return f;
}

/** The wall-clock time in a zone at a UTC moment, as if it were UTC (ms). */
export function wallOf(utcMs: number, tz: string): number {
  const p: Record<string, number> = {};
  for (const { type, value } of formatter(tz).formatToParts(new Date(utcMs))) if (type !== "literal") p[type] = Number(value);
  // Proleptic years stay as given (Date.UTC would read 0–99 as 1900–1999).
  const d = new Date(0);
  d.setUTCFullYear(p.year, p.month - 1, p.day);
  d.setUTCHours(p.hour === 24 ? 0 : p.hour, p.minute, p.second, 0);
  return d.getTime();
}

/**
 * The UTC moment of a local wall time in a zone, and the local time actually
 * used. A time that doesn't exist that day (the hour clocks skip in spring)
 * moves to the next minute that does.
 */
export function localToUtc(tz: string, y: number, mo: number, d: number, h: number, mi: number): { utc: number; h: number; mi: number } {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let t = wall;
  for (let i = 0; i < 3; i++) t = wall - (wallOf(t, tz) - t);
  if (wallOf(t, tz) === wall) return { utc: t, h, mi };
  // In the gap: the offsets on either side put the moment between two bounds; the first minute whose wall time is past the requested one is the transition.
  const before = wall - (wallOf(wall - 86400000, tz) - (wall - 86400000));
  const after = wall - (wallOf(wall + 86400000, tz) - (wall + 86400000));
  let lo = Math.min(before, after), hi = Math.max(before, after);
  while (hi - lo > 60000) {
    const m = lo + Math.floor((hi - lo) / 120000) * 60000;
    if (wallOf(m, tz) >= wall) hi = m;
    else lo = m;
  }
  const w = new Date(wallOf(hi, tz));
  return { utc: hi, h: w.getUTCHours(), mi: w.getUTCMinutes() };
}
