/**
 * The stars above a place at a moment: every star to magnitude 4.8 in its
 * place (Yale Bright Star Catalogue positions, data/sky), the constellation
 * figures, the horizon as the circle. The catalogue's Night Sky prints and
 * the personalised ones are this function with different inputs.
 */
import { altAzOf, siderealTime } from "../astro";
import { DEG, STROKE, caption, circle, dot, f1, julian, line, path, polyline, text } from "../kit";

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
  caption: { title?: string; sub?: string; sub2?: string };
  /** The Make print's chart (house type, the live area, the stroke scale); absent, the catalogue's, byte for byte. */
  make?: boolean;
}

/** A place's coordinates as the caption writes them ("31.78°N 35.24°E"). */
export const latLon = (lat: number, lon: number) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;

/** The chart alone (no caption). */
export function skyChart({ stars, lines }: SkyData, place: { lat: number; lon: number }, jd: number, make = false): string {
  if (make) return makeChart({ stars, lines }, place, jd);
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

/**
 * The Make print's chart: the same projection and stars, drawn to the house
 * grid. The ring sits inside the live area with its cardinals (bold Plex, the
 * key line) and the azimuth every 30° (Plex at its smallest) outside it; the
 * horizon is the regular line, the scale ring and ticks hairlines, the figures
 * a fine-hairline between them, and a small cross marks the zenith.
 */
function makeChart({ stars, lines }: SkyData, place: { lat: number; lon: number }, jd: number): string {
  const altAz = altAzOf(place.lat, siderealTime(jd, place.lon));
  const CX = 150, CY = 160, R = 110;
  const xy = (alt: number, az: number): [number, number] => {
    const r = R * Math.tan((Math.PI / 2 - alt) / 2);
    return [CX - r * Math.sin(az), CY - r * Math.cos(az)];
  };
  const at = (r: number, deg: number): [number, number] => [CX - r * Math.sin(deg * DEG), CY - r * Math.cos(deg * DEG)];
  let body = circle(CX, CY, R, STROKE.regular) + circle(CX, CY, R + 6, STROKE.hairline);
  for (let k = 0; k < 360; k += 5) {
    const r1 = k % 30 === 0 ? R + 6 : k % 10 === 0 ? R + 3.5 : R + 2;
    body += line(...at(R, k), ...at(r1, k), STROKE.hairline);
  }
  for (let k = 0; k < 360; k += 30) {
    const [x, y] = at(R + 13.5, k);
    if (k % 90 === 0) body += text(x, y + (0.698 * 7.5) / 2, "NESW"[k / 90], 7.5, { bold: true });
    else body += text(x, y + (0.698 * 4.5) / 2, String(k), 4.5, { spacing: 0.3 });
  }
  // The zenith.
  body += line(CX - 3, CY, CX + 3, CY, STROKE.hairline) + line(CX, CY - 3, CX, CY + 3, STROKE.hairline);
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
    body += dot(x, y, Math.max(0.7, 3.1 - 0.55 * mag));
  }
  return body;
}

/**
 * Sputnik 1 over its pad: PS-1 went up into an orbit inclined 65.1°, so from
 * Baikonur it climbed away to the north-east (launch azimuth asin(cos i / cos φ),
 * about 37°). The plane of that first orbit, seen from the pad, is a great circle
 * through the zenith: on the chart's stereographic projection (centre 150,160,
 * horizon radius 118, north up, east on the left) a straight dashed line across
 * the sky, the satellite on it heading north-east. #010101 is the ground colour
 * (the wrapper's), so the track and the satellite cut cleanly through the stars.
 */
function sputnikTrack(lat: number): string {
  const CX = 150, CY = 160, R = 118;
  const az = Math.asin(Math.cos(65.1 * DEG) / Math.cos(lat * DEG));
  const at = (r: number, a: number): [number, number] => [CX - r * Math.sin(a), CY - r * Math.cos(a)];
  const track = polyline([at(R - 3, az + Math.PI), at(R - 3, az)]);
  let s = `<path d="${track}" fill="none" stroke="#010101" stroke-width="3.2" stroke-linecap="round"/>` + path(track, 0.8, ` stroke-dasharray="3.2 2.4"`);
  // The satellite: a ball with its four swept-back antennae, on a ground-coloured disc.
  const [x, y] = at(R * 0.58, az);
  const [ux, uy] = [-Math.sin(az), -Math.cos(az)]; // heading, on the page
  const [vx, vy] = [-uy, ux];
  s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="7.5" fill="#010101"/>`;
  for (const k of [-1, -0.35, 0.35, 1]) s += line(x - ux * 1.5 + vx * k * 1.3, y - uy * 1.5 + vy * k * 1.3, x - ux * 7 + vx * k * 3.4, y - uy * 7 + vy * k * 3.4, 0.5);
  s += dot(x, y, 2.4);
  const [lx, ly] = [x + vx * 9 + 1, y + vy * 9 - 1];
  s += `<rect x="${f1(lx - 3)}" y="${f1(ly - 6.5)}" width="22.5" height="9" fill="#010101"/>` + text(lx, ly, "PS-1", 6, { bold: true, spacing: 0.4, anchor: "start" });
  return s;
}

/** Launches the catalogue's charts mark: the pad and the moment (UT, as a Julian date). */
const LAUNCHES = [{ lat: 45.92, lon: 63.342, jd: julian(1957, 10, 4, 19, 28), track: sputnikTrack, what: "the launch of Sputnik 1" }];

/** The chart and its caption: the print's body (white ink, unwrapped). */
export const skyBody = (input: SkyInput, data: SkyData) => {
  const launch = input.make ? undefined : LAUNCHES.find((l) => Math.abs(l.lat - input.place.lat) < 1e-6 && Math.abs(l.lon - input.place.lon) < 1e-6 && Math.abs(l.jd - input.jd) < 1 / 1440);
  if (!launch) return skyChart(data, input.place, input.jd, input.make) + caption(318, input.caption.title, input.caption.sub, input.caption.sub2);
  // A launch night: the launch drawn on the sky, the place set large with the date and the event close under it.
  const { title, sub, sub2 } = input.caption;
  return (
    skyChart(data, input.place, input.jd) +
    launch.track(input.place.lat) +
    (title ? text(150, 320, title.toUpperCase(), 16, { bold: true, spacing: 3 }) : "") +
    (sub ? text(150, 333, sub, 7.5) : "") +
    text(150, 343, sub2 ? `${sub2} · ${launch.what}` : launch.what, 6.2)
  );
};
