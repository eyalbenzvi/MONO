/**
 * The moon on one night, large: its lit part as a field of halftone dots (so
 * even a full moon prints as a mesh of ink, never a solid disc), the dark part
 * as the same screen in fine dots (the seas in smaller dots, so the full
 * moon shows its face), the month's scale under it with the night's age
 * marked, and the phase named in the caption. Seen
 * from the north the waxing moon is lit on the right; from the south the
 * lit side is the other one.
 */
import { moonPhase } from "../astro";
import { DEG, STROKE, caption, circle, dot, line, text } from "../kit";

export interface NightInput {
  /** The moment, as a Julian date (UT). */
  jd: number;
  south?: boolean;
  caption: { title?: string; sub?: string; sub2?: string };
}

/** The phase's everyday name ("Waxing gibbous"), from its illuminated fraction and direction. */
export function phaseName(k: number, waxing: boolean): string {
  if (k < 0.03) return "New moon";
  if (k > 0.97) return "Full moon";
  if (Math.abs(k - 0.5) < 0.04) return waxing ? "First quarter" : "Last quarter";
  return `${waxing ? "Waxing" : "Waning"} ${k < 0.5 ? "crescent" : "gibbous"}`;
}

const CX = 150, CY = 150, R = 104;
const RADIUS = R;

/** The phase, and whether a point (relative to the centre, y down) is on the lit part. */
export function litTest(k: number, waxing: boolean, south: boolean, R = RADIUS) {
  const rx = Math.abs(1 - 2 * k) * R;
  // Lit on the right when waxing seen from the north; mirrored otherwise.
  const right = waxing !== south;
  return (x: number, y: number) => {
    if (x * x + y * y > R * R) return false;
    const sx = right ? x : -x;
    const t = rx * Math.sqrt(Math.max(0, 1 - (y * y) / (R * R)));
    // A crescent is lit beyond the terminator; a gibbous moon from the terminator on the far side.
    return k < 0.5 ? sx > t : sx > -t;
  };
}

/**
 * A small moon in the same screen (Your Birth's "the moon that night"): full dots on the lit part and fine ones
 * on the dark, inside its outline, so it reads the same on either tee and is never a disc of solid ink.
 */
export function screenedMoon(cx: number, cy: number, r: number, k: number, waxing: boolean, south = false): string {
  const lit = litTest(k, waxing, south, r);
  const step = r / 5.2;
  let s = circle(cx, cy, r, 0.8);
  for (let row = 0, y = -r; y <= r; row++, y += step * 0.866)
    for (let x = -r + (row % 2 ? step / 2 : 0); x <= r; x += step) {
      if (x * x + y * y > (r - step * 0.6) ** 2) continue;
      s += dot(cx + x, cy + y, lit(x, y) ? step * 0.3 : step * 0.13);
    }
  return s;
}

/**
 * The near side's dark seas (selenographic longitude, latitude, in degrees; a
 * radius as a share of the disc): the maria that give the full moon its face,
 * printed as smaller dots. Seen from the north, east (Crisium) is on the right.
 */
const MARIA: [number, number, number][] = [
  [59, 17, 0.1], [31, 8, 0.17], [17, 28, 0.15], [51, -8, 0.13], [35, -15, 0.09], [4, 13, 0.07],
  [-15, 33, 0.24], [-2, 40, 0.1], [-30, 56, 0.08], [0, 57, 0.08], [25, 56, 0.07], [-45, 55, 0.07],
  [-57, 20, 0.2], [-60, 0, 0.18], [-45, 35, 0.14], [-35, 5, 0.14], [-40, -12, 0.14], [-23, -10, 0.12],
  [-17, -21, 0.15], [-39, -24, 0.09], [-10, 2, 0.06],
];
/** The seas' tone at a point of the disc (x right, y up, radius 1): 0 highland, 1 the heart of a sea. */
function sea(x: number, y: number): number {
  // Soft blobs summed, so neighbouring seas run together as they do (Imbrium into Procellarum, Serenitatis into Tranquillitatis).
  let sum = 0;
  for (const [lon, lat, r] of MARIA) {
    const mx = Math.sin(lon * DEG) * Math.cos(lat * DEG), my = Math.sin(lat * DEG);
    const d2 = ((x - mx) ** 2 + (y - my) ** 2) / (r * r);
    if (d2 < 4) sum += Math.exp(-2 * d2);
  }
  return Math.min(1, 1.25 * (1 - Math.exp(-2 * sum)));
}
/** The synodic month, days. */
const MONTH = 29.53;

export function nightBody({ jd, south = false, caption: c }: NightInput): string {
  const { k, waxing } = moonPhase(jd);
  const lit = litTest(k, waxing, south);
  let body = circle(CX, CY, R, STROKE.fine);
  // One hexagonal screen over the disc: full dots on the lit part (smaller over the seas, so the full moon shows its face),
  // fine ones on the dark part, the seas finer still (a new moon still reads as the moon). From the south the face is turned half round.
  const step = 4.6;
  for (let row = 0, y = -R; y <= R; row++, y += step * 0.866) {
    for (let x = -R + (row % 2 ? step / 2 : 0); x <= R; x += step) {
      if (x * x + y * y > (R - 1.8) * (R - 1.8)) continue;
      const m = south ? sea(-x / R, y / R) : sea(x / R, -y / R);
      if (lit(x, y)) body += dot(CX + x, CY + y, 1.5 - 0.85 * m);
      // The dark part in earthshine: the seas faintly there too, so a new moon still has a face, not a flat screen.
      else body += dot(CX + x, CY + y, 0.9 - 0.4 * m);
    }
  }
  // The month under it: new, the quarters and full on a hairline, the night's place on it (its age from the phase).
  const e = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * k))) / DEG;
  const age = ((waxing ? e : 360 - e) / 360) * MONTH;
  const [x0, x1, y] = [48, 252, 283];
  const xAt = (d: number) => x0 + ((x1 - x0) * d) / MONTH;
  body += line(x0, y, x1, y, STROKE.hairline);
  for (let d = 0; d <= 29; d++) body += line(xAt(d), y, xAt(d), y - 2, STROKE.hairline);
  const marks: [number, string][] = [[0, "NEW"], [MONTH / 4, "FIRST Q"], [MONTH / 2, "FULL"], [(3 * MONTH) / 4, "LAST Q"], [MONTH, "NEW"]];
  for (const [d, label] of marks) {
    body += line(xAt(d), y - 4, xAt(d), y + 2, STROKE.hairline);
    body += text(xAt(d), y + 10, label, 4.5, { spacing: 0.55, anchor: d === 0 ? "start" : d === MONTH ? "end" : "middle" });
  }
  const xa = xAt(age);
  body += dot(xa, y, 2) + text(Math.min(x1 - 20, Math.max(x0 + 20, xa)), y - 7, `DAY ${age.toFixed(1)}`, 4.5, { bold: true, spacing: 0.55 });
  return body + caption(318, c.title, c.sub, c.sub2);
}
