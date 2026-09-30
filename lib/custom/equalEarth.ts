/**
 * The Equal Earth projection (Šavrič, Patterson and Jenny, 2018): equal-area,
 * a pleasing oval, public and simple. x runs about ±2.7063 and y about
 * ±1.3173 for the whole world (radius 1). Used at build time for the
 * countries' outlines (scripts/tools/buildCountries.ts) and in the browser
 * for points (a microstate, a city).
 */
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796;
const M = Math.sqrt(3) / 2;
export const EE_X = 2.7063, EE_Y = 1.3173;

/** Longitude and latitude (degrees) to Equal Earth (x east, y north). */
export function equalEarth(lon: number, lat: number): [number, number] {
  const l = (lon * Math.PI) / 180, p = (lat * Math.PI) / 180;
  const t = Math.asin(M * Math.sin(p));
  const t2 = t * t, t6 = t2 * t2 * t2;
  const x = (2 * Math.sqrt(3) * l * Math.cos(t)) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1));
  const y = t * (A4 * t6 * t2 + A3 * t6 + A2 * t2 + A1);
  return [x, y];
}
