/**
 * The astronomy of the computed sky prints, pure (generator and browser):
 * Julian dates, sidereal time, a star's altitude and azimuth, the moon's phase.
 * Low precision on purpose: precession is ignored, which within 1900–2100
 * keeps a star within about 1.4° of its true place on a 300 px chart.
 */
const DEG = Math.PI / 180;
const norm360 = (a: number) => ((a % 360) + 360) % 360;

/** Julian date of a UTC moment. */
export const julian = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi) / 86400000 + 2440587.5;

/** Local sidereal time (degrees) at a Julian date (UT) and an east longitude. */
export const siderealTime = (jd: number, lon: number) => norm360(280.46061837 + 360.98564736629 * (jd - 2451545) + lon);

/** A star's altitude and azimuth (radians) for a latitude and a local sidereal time (degrees). */
export function altAzOf(lat: number, lst: number) {
  const phi = lat * DEG;
  return (ra: number, dec: number): [number, number] => {
    const H = (lst - norm360(ra)) * DEG;
    const d = dec * DEG;
    const alt = Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H));
    const az = Math.atan2(-Math.sin(H) * Math.cos(d), Math.cos(phi) * Math.sin(d) - Math.sin(phi) * Math.cos(d) * Math.cos(H));
    return [alt, az];
  };
}

/** The moon's phase at a Julian date: illuminated fraction and whether it is waxing (Meeus, ch. 48–49, low precision). */
export function moonPhase(jd: number): { k: number; waxing: boolean } {
  const T = (jd - 2451545) / 36525;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const s = (a: number) => Math.sin(a * DEG);
  const i = 180 - D - 6.289 * s(Mp) + 2.1 * s(M) - 1.274 * s(2 * D - Mp) - 0.658 * s(2 * D) - 0.214 * s(2 * Mp) - 0.11 * s(D);
  return { k: (1 + Math.cos(i * DEG)) / 2, waxing: norm360(D) < 180 };
}
