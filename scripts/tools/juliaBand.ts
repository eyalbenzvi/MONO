/**
 * Makes Your Fractal's band of c values (lib/custom/templates/julia BAND),
 * from the edge of the Mandelbrot set, where the Julia sets are intricate:
 * on a 0.004 grid of the upper half plane, every c whose critical orbit
 * settles on an attracting cycle of period 2 to 8 (the bulbs: rabbits,
 * basilicas, their necks), and every c just outside the set, whose critical
 * orbit takes 25 to 300 steps to escape (the seahorse valley's spirals, the
 * dendrites' neighbours: dust, drawn as threads). Spread out (no two closer
 * than 0.025), drawn at the print's own grid, and kept when the set is
 * intricate (its outline's length squared over its area at least 120; a disc
 * is 12.6), fills enough of the box, stays clear of its sides, draws in time
 * for a live preview (140 ms in node), and passes the print gate on both
 * tees with the sparsest captions and the fullest; none within 0.06 of the
 * cusp at 1/4, where the contours bunch and break. Ordered round the set.
 *
 *   npx tsx scripts/tools/juliaBand.ts            prints the table
 */
import { attractingCycle, juliaDrawing } from "../../lib/custom/draw/julia";
import { juliaFor } from "../../lib/custom/templates/julia";
import { wrap } from "../../lib/custom/svg";
import { gate } from "../../tests/make/fuzz";

/** Steps the critical orbit takes to escape (Infinity if it doesn't within 400). */
function escapeSteps(cx: number, cy: number): number {
  let [x, y] = [0, 0];
  for (let n = 0; n < 400; n++) {
    [x, y] = [x * x - y * y + cx, 2 * x * y + cy];
    if (x * x + y * y > 4) return n;
  }
  return Infinity;
}

const BOX = { x: 30, y: 24, w: 240, h: 282 };
const cands: { re: number; im: number }[] = [];
for (let i = 0; i <= 287; i++)
  for (let j = 0; j <= 600; j++) {
    const [re, im] = [-1.9 + j * 0.004, i * 0.004];
    const c = attractingCycle(re, im);
    const inBulb = c && c.points.length >= 2 && c.points.length <= 8;
    const steps = c ? Infinity : escapeSteps(re, im);
    if (inBulb || (steps >= 25 && steps <= 300)) cands.push({ re: Math.round(re * 1e4), im: Math.round(im * 1e4) });
  }
console.error(`${cands.length} candidates with an attracting cycle`);

// A spread first (cheap), then the expensive checks on the spread only; a failure makes room for its neighbours.
const angle = (c: { re: number; im: number }) => Math.atan2(c.im, c.re + 2500);
cands.sort((a, b) => angle(a) - angle(b) || a.re - b.re);
const kept: { re: number; im: number }[] = [];
const near = (c: { re: number; im: number }) => kept.some((k) => Math.hypot(k.re - c.re, k.im - c.im) < 250);
let tried = 0;
for (const c of cands) {
  // Near the cusp at c = 1/4 (the cauliflower) the escape time is degenerate: its contours bunch and break at the poles.
  if (near(c) || Math.hypot(c.re - 2500, c.im) < 600) continue;
  tried++;
  const t0 = performance.now();
  const d = juliaDrawing(c.re / 1e4, c.im / 1e4, BOX);
  const ms = performance.now() - t0;
  if (d.complexity < 120 || d.inShare < 0.04 || d.pieces > 150 || ms > 140) continue;
  // The set's outline clear of the box's sides (else its contours are cut off there).
  const xy = [...d.edge.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const [x0, x1, y0, y1] = [Math.min(...xy.map((p) => p[0])), Math.max(...xy.map((p) => p[0])), Math.min(...xy.map((p) => p[1])), Math.max(...xy.map((p) => p[1]))];
  if (x0 < BOX.x + 12 || x1 > BOX.x + BOX.w - 12 || y0 < BOX.y + 12 || y1 > BOX.y + BOX.h - 12) continue;
  // The sparsest captions and the fullest, on both tees.
  const bodies = [juliaFor(c.re, c.im, "Us", "30 September 2026"), juliaFor(c.re, c.im, "1 May 2000"), juliaFor(c.re, c.im, "The day we met, and after, x", "30 September 2026")];
  if (bodies.some((body) => gate(wrap(body, "black"), "black") || gate(wrap(body, "white"), "white"))) continue;
  kept.push(c);
}
console.error(`${tried} drawn, ${kept.length} kept`);
kept.sort((a, b) => angle(a) - angle(b));
console.log(`[${kept.map((c) => `[${c.re}, ${c.im}]`).join(", ")}]`);
