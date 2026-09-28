/**
 * The stars above a place at a moment: every star to magnitude 4.8 in its
 * place (Yale Bright Star Catalogue positions, data/sky), the constellation
 * figures, the horizon as the circle. The catalogue's Night Sky prints and
 * the personalised ones are this function with different inputs.
 */
import { altAzOf, siderealTime } from "../astro";
import { DEG, caption, circle, dot, line, path, polyline, text } from "../kit";

export interface SkyData {
  /** [ra°, dec°, magnitude]. */
  stars: [number, number, number][];
  /** Constellation figures: strokes of [ra°, dec°] points. */
  lines: [number, number][][];
}

export interface SkyInput {
  place: { lat: number; lon: number };
  /** The moment as a Julian date (UT). */
  jd: number;
  caption: { title: string; sub?: string; sub2?: string };
}

/** A place's coordinates as the caption writes them ("31.78°N 35.24°E"). */
export const latLon = (lat: number, lon: number) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;

/** The chart alone (no caption). */
export function skyChart({ stars, lines }: SkyData, place: { lat: number; lon: number }, jd: number): string {
  const altAz = altAzOf(place.lat, siderealTime(jd, place.lon));
  // Stereographic, zenith at the centre, horizon the circle; north up, east on the left (a chart held overhead).
  const CX = 150, CY = 160, R = 118;
  const xy = (alt: number, az: number): [number, number] => {
    const r = R * Math.tan((Math.PI / 2 - alt) / 2);
    return [CX - r * Math.sin(az), CY - r * Math.cos(az)];
  };
  let body = circle(CX, CY, R, 1.3) + circle(CX, CY, R + 5, 0.5);
  for (let k = 0; k < 360; k += 10) {
    const a = k * DEG;
    const r1 = k % 30 === 0 ? R + 5 : R + 2.5;
    body += line(CX - R * Math.sin(a), CY - R * Math.cos(a), CX - r1 * Math.sin(a), CY - r1 * Math.cos(a), 0.5);
  }
  for (const [label, a] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]] as const) {
    const r = R + 13;
    body += text(CX - r * Math.sin(a * DEG), CY - r * Math.cos(a * DEG) + 3, label, 8, { bold: true });
  }
  // The figures, where both ends of a stroke are above the horizon.
  let d = "";
  for (const l of lines)
    for (let i = 1; i < l.length; i++) {
      const [a1, z1] = altAz(l[i - 1][0], l[i - 1][1]);
      const [a2, z2] = altAz(l[i][0], l[i][1]);
      if (a1 > 0.02 && a2 > 0.02) d += polyline([xy(a1, z1), xy(a2, z2)]);
    }
  body += path(d, 0.6);
  for (const [ra, dec, mag] of stars) {
    if (mag > 4.8) continue;
    const [alt, az] = altAz(ra, dec);
    if (alt <= 0) continue;
    const [x, y] = xy(alt, az);
    body += dot(x, y, Math.max(0.75, 3.3 - 0.58 * mag));
  }
  return body;
}

/** The chart and its caption: the print's body (white ink, unwrapped). */
export const skyBody = (input: SkyInput, data: SkyData) => skyChart(data, input.place, input.jd) + caption(318, input.caption.title, input.caption.sub, input.caption.sub2);
