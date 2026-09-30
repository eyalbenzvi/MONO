/**
 * Your Landmarks' drawings, the second set: the 26 added to the first 24
 * (lib/custom/draw/landmarks, which draws them all). Drawn to the same rules:
 * each in its own box (its larger side 100 units, the ground along its
 * bottom), absolute path commands only, an outline, a detail and a fine
 * weight (lib/custom/draw/landmarkPen).
 */
import { type Pt, P, Pz, line, R, ring, arch, garch, mir, sym, qPts, qxAt, smooth, yOn, type Pen, type Drawing, D, moved, tree, fir, bird, wave, cloud, tuft, xOn, gapped } from "./landmarkPen";
import type { Landmark } from "../specs/landmarks";
/* ------------------------------------------------------------------ */
/* The drawings                                                         */
/* ------------------------------------------------------------------ */

const arc: Drawing = {
  w: 100,
  h: 90,
  draw(g) {
    // The steps and the square.
    g.o(P(0, 90, 100, 90), P(15, 90, 15, 86.5, 85, 86.5, 85, 90));
    // The block, the cornice under the attic and the attic's own; the great arch.
    g.o(P(18, 86.5, 18, 14.5, 82, 14.5, 82, 86.5), P(16.4, 14.5, 16.4, 11.4, 83.6, 11.4, 83.6, 14.5), P(16.4, 30, 83.6, 30, 83.6, 32.6, 16.4, 32.6));
    g.o(arch(37, 86.5, 26, 53));
    g.d("M34.4 53A15.6 15.6 0 0 1 65.6 53", P(18, 53, 37, 53), P(63, 53, 82, 53), P(18, 36, 82, 36), P(16.4, 27.6, 83.6, 27.6));
    // The sculpture groups on the piers, their pedestals; the panels above them.
    g.d(R(21.5, 58, 12.5, 19), R(66, 58, 12.5, 19), P(20.4, 80, 35.6, 80), P(64.4, 80, 79.6, 80), R(21.5, 39.5, 12.5, 10), R(66, 39.5, 12.5, 10));
    // Each group two figures: robed, one with an arm raised.
    const group = (x: number) =>
      ring(x + 4.2, 62.4, 1.3) + ring(x + 8.6, 64.4, 1.2) +
      D`M${x + 4.2} ${63.7}Q${x + 2.4} ${70} ${x + 2.8} ${76.6}H${x + 6}Q${x + 6.2} ${70} ${x + 4.2} ${63.7}M${x + 5} ${65.4}L${x + 7} ${60.4}M${x + 8.6} ${65.6}Q${x + 7.2} ${71} ${x + 7.6} ${76.6}H${x + 10.2}Q${x + 10.2} ${71} ${x + 8.6} ${65.6}`;
    g.f(group(21.5), group(66), P(24, 44.5, 31.5, 44.5), P(68.5, 44.5, 76, 44.5));
    // The spandrels' winged figures, the frieze and the attic's shields.
    g.f("M38.4 40.4Q41 38.6 44.6 38.4M61.6 40.4Q59 38.6 55.4 38.4");
    let shields = "";
    for (let x = 22.6; x < 80; x += 5.4) shields += ring(x, 21.2, 1.5);
    g.f(shields, P(18, 25.4, 82, 25.4));
    // Lamps and trees in the square.
    g.d(tree(7, 90, 8.4), tree(93, 90, 8.4), P(12.6, 90, 12.6, 82), P(87.4, 90, 87.4, 82));
    g.d(ring(12.6, 81, 1), ring(87.4, 81, 1));
  },
};

/** An onion dome on a drum top at (cx, yb): its half-width, its height; the spike above it. */
const onion = (cx: number, yb: number, hw: number, h: number) =>
  sym(D`M${cx - hw * 0.72} ${yb}C${cx - hw * 1.3} ${yb - h * 0.3} ${cx - hw * 1.08} ${yb - h * 0.62} ${cx - hw * 0.3} ${yb - h * 0.84}Q${cx - hw * 0.06} ${yb - h * 0.93} ${cx} ${yb - h}`, cx);
/** An onion's twisting stripes. */
function stripes(cx: number, yb: number, hw: number, h: number): string {
  let s = "";
  for (const k of [-0.95, -0.35, 0.25]) s += D`M${cx + k * hw * 0.72} ${yb}Q${cx + k * hw * 0.72 + hw * 0.62} ${yb - h * 0.5} ${cx} ${yb - h * 0.97}`;
  return s;
}
/** A row of ogee gables (kokoshniks) along y from x0 to x1. */
function kokoshniks(x0: number, x1: number, y: number, n: number, h: number): string {
  const w = (x1 - x0) / n;
  let s = "";
  for (let i = 0; i < n; i++) {
    const x = x0 + i * w;
    s += D`M${x} ${y}Q${x + w * 0.1} ${y - h * 0.7} ${x + w * 0.5} ${y - h * 0.62}Q${x + w * 0.44} ${y - h * 0.95} ${x + w * 0.5} ${y - h}Q${x + w * 0.56} ${y - h * 0.95} ${x + w * 0.5} ${y - h * 0.62}Q${x + w * 0.9} ${y - h * 0.7} ${x + w} ${y}`;
  }
  return s;
}
/** A cross on top of a spike at (x, y), s tall. */
const cross = (x: number, y: number, s: number) => P(x, y, x, y - s) + P(x - s * 0.36, y - s * 0.68, x + s * 0.36, y - s * 0.68);

const stbasils: Drawing = {
  w: 100,
  h: 100,
  draw(g) {
    const cx = 50;
    // The gallery the churches stand on: its arcade, the door, the ground.
    g.o(P(0, 100, 100, 100), P(3, 100, 3, 80, 97, 80, 97, 100));
    g.d(P(3, 84, 97, 84), garch(46, 100, 8, 91, 5));
    let arc8 = "";
    for (let x = 6.4; x < 92; x += 6.2) if (x < 42 || x > 56) arc8 += arch(x, 97, 3.2, 90);
    g.f(arc8);
    // The two great side towers: drum, kokoshniks, the upper drum, the onion, its cross.
    const big = (c: number) => {
      g.o(P(c - 8, 80, c - 8, 52) + P(c + 8, 80, c + 8, 52), P(c - 6, 52, c - 6, 44) + P(c + 6, 52, c + 6, 44), onion(c, 44, 8, 20), P(c, 24, c, 21.6));
      g.d(kokoshniks(c - 8, c + 8, 52, 3, 6), P(c - 6.6, 44, c + 6.6, 44), cross(c, 21.6, 5.4), P(c - 8, 66, c + 8, 66));
      g.f(stripes(c, 44, 8, 20), garch(c - 1.4, 76, 2.8, 71, 2.2), garch(c - 4.8, 62, 2.4, 58, 1.8) + garch(c + 2.4, 62, 2.4, 58, 1.8), garch(c - 1, 50, 2, 46.4, 1.4));
    };
    big(21);
    big(79);
    // The smaller onions behind, between them.
    for (const c of [35.2, 64.8]) {
      g.o(P(c - 4.8, 80, c - 4.8, 58) + P(c + 4.8, 80, c + 4.8, 58), onion(c, 58, 5.2, 14), P(c, 44, c, 42));
      g.d(cross(c, 42, 4), P(c - 5.4, 58, c + 5.4, 58));
      g.f(stripes(c, 58, 5.2, 14), garch(c - 1.2, 72, 2.4, 67, 1.8));
    }
    // The tall tent over the middle: its drum, two tiers of kokoshniks, the tent and its little onion.
    g.o(P(42.6, 80, 42.6, 52) + P(57.4, 80, 57.4, 52), P(44, 44, 48.4, 16, 51.6, 16, 56, 44), P(47.6, 16, 47.6, 12.4) + P(52.4, 16, 52.4, 12.4), onion(cx, 12.4, 3.2, 7.4), P(cx, 5, cx, 4));
    g.d(kokoshniks(42.6, 57.4, 52, 3, 5), kokoshniks(44, 56, 47, 3, 3.4), P(44, 44, 56, 44), cross(cx, 4, 3.4), P(47.2, 16, 52.8, 16));
    g.f(P(46.4, 43, 49.4, 17) + P(53.6, 43, 50.6, 17), P(45.4, 36, 54.6, 36) + P(46.6, 28, 53.4, 28), garch(48.6, 76, 2.8, 70, 2.2), garch(48.8, 62, 2.4, 57.6, 1.8));
  },
};

/** A standing stone, roughly squared: its corners a little off true. */
const stone = (x0: number, y0: number, x1: number, y1: number) => Pz(x0 + 0.5, y1, x0, y0 + 2.4, x0 + 1.3, y0, x1 - 1.1, y0 + 0.5, x1, y0 + 2.2, x1 - 0.4, y1);

const stonehenge: Drawing = {
  w: 100,
  h: 54,
  draw(g) {
    const yb = 50;
    // The sarsens behind, then the three trilithons in front of them; each upright's side in shade.
    const back: [number, number, number, number][] = [[0, 30, 4.4, yb], [29.6, 25, 35, yb], [65, 27, 70.4, yb], [95.4, 31, 100, yb]];
    const up: [number, number, number, number][] = [[6, 20.4, 14.2, yb], [19.2, 21.2, 27.2, yb], [38, 10, 47, yb], [53, 10.8, 62, yb], [72.6, 19.4, 80.6, yb], [85.6, 20.4, 93.6, yb]];
    const lintels: [number, number, number, number][] = [[5, 14.4, 28.4, 20.6], [36.8, 3.6, 63.2, 10], [71.6, 13.2, 94.6, 19.4]];
    g.o(...back.map((b) => stone(...b)), ...up.map((b) => stone(...b)), ...lintels.map((b) => stone(...b)));
    let sides = "", cracks = "";
    for (const [x0, y0, x1] of [...up, ...back]) {
      sides += P(x1 - 2.2, y0 + 2.6, x1 - 1.8, yb - 0.4);
      cracks += P(x0 + (x1 - x0) * 0.4, y0 + 5, x0 + (x1 - x0) * 0.46, y0 + 11) + P(x0 + (x1 - x0) * 0.3, yb - 9, x0 + (x1 - x0) * 0.26, yb - 3.4);
    }
    g.d(sides);
    g.f(cracks, ...lintels.map(([x0, y0, x1, y1]) => P(x0 + 2, y1 - 1.6, x1 - 2, y1 - 1.4)));
    // A fallen stone lying in front; the grass, and birds.
    g.o("M40 54V51.6Q41 50.6 44 50.8H57Q59.6 51 60 54");
    g.d(tuft(3, 53), tuft(18, 53.4), tuft(33, 53), tuft(68, 53.4), tuft(84, 53), tuft(97, 53.4), bird(52, 30, 2), bird(58, 26, 1.6), bird(81, 7, 1.8));
    g.o(P(0, 54, 100, 54));
    g.d(P(0, yb, 100, yb));
  },
};

const atomium: Drawing = {
  w: 84,
  h: 100,
  draw(g) {
    const cx = 42, r = 6.6, tw = 1.1;
    // The cube stood on its corner: nine spheres, the body diagonal upright.
    const top = 10, bot = 74, dz = bot - top;
    const rr = (dz / Math.sqrt(3)) * Math.sqrt(2 / 3);
    const at = (deg: number, y: number): Pt => [cx + rr * Math.sin((deg * Math.PI) / 180), y];
    const T: Pt = [cx, top], B: Pt = [cx, bot], C: Pt = [cx, (top + bot) / 2];
    const up = [30, 150, 270].map((d) => at(d, top + dz / 3));
    const lo = [90, 210, 330].map((d) => at(d, top + (2 * dz) / 3));
    // The tubes: the cube's edges and the diagonals to the middle, each two lines, stopped at the spheres.
    const edges: [Pt, Pt][] = [...up.map((u): [Pt, Pt] => [T, u]), ...lo.map((l): [Pt, Pt] => [l, B]), [up[0], lo[0]], [up[0], lo[2]], [up[1], lo[0]], [up[1], lo[1]], [up[2], lo[1]], [up[2], lo[2]], ...[T, B, ...up, ...lo].map((p): [Pt, Pt] => [p, C])];
    const seen = new Set<string>();
    let tubes = "";
    for (const [a, b] of edges) {
      const key = [a, b].map((p) => p.map((v) => v.toFixed(2)).join(",")).sort().join("|");
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (seen.has(key) || len < 2 * r + 1) continue;
      seen.add(key);
      const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      const s0 = Math.sqrt(r * r - tw * tw);
      for (const side of [-1, 1]) {
        const [nx, ny] = [-uy * tw * side, ux * tw * side];
        tubes += P(a[0] + ux * s0 + nx, a[1] + uy * s0 + ny, b[0] - ux * s0 + nx, b[1] - uy * s0 + ny);
      }
    }
    g.d(tubes);
    // The spheres, each with its panels' lines.
    const spheres = [T, B, C, ...up, ...lo].filter((p, i, all) => all.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5) === i);
    let panels = "";
    for (const [x, y] of spheres) {
      g.o(ring(x, y, r));
      panels += D`M${x} ${y - r}A${r * 0.42} ${r} 0 0 0 ${x} ${y + r}M${x - r} ${y}A${r} ${r * 0.36} 0 0 0 ${x + r} ${y}`;
    }
    g.f(panels);
    // The top sphere's windows.
    g.d(D`M${cx - r * 0.8} ${top - 1.6}Q${cx} ${top - 0.6} ${cx + r * 0.8} ${top - 1.6}`);
    // The bipods from the lower spheres, the column under the bottom one, the pavilions.
    const legs = (p: Pt, spread: number) => P(p[0] - 1.2, p[1] + r - 0.3, p[0] - spread, 100) + P(p[0] + 1.2, p[1] + r - 0.3, p[0] + spread, 100);
    g.o(legs(lo[0], 5.4), legs(lo[1], 5.4));
    g.o(P(cx - 1.8, bot + r - 0.3, cx - 1.8, 93) + P(cx + 1.8, bot + r - 0.3, cx + 1.8, 93));
    g.o(P(0, 100, 84, 100), P(cx - 4.4, 100, cx - 4.4, 93, cx + 4.4, 93, cx + 4.4, 100));
  },
};

const stpeters: Drawing = {
  w: 100,
  h: 86,
  draw(g) {
    const cx = 50;
    // The steps.
    g.o(P(0, 86, 100, 86), P(3, 86, 3, 83, 97, 83, 97, 86));
    g.d(P(5, 83, 5, 80.5, 95, 80.5, 95, 83));
    // The facade: the giant order, the entablature, the pediment, the attic with its statues.
    g.o(P(8, 80.5, 8, 46, 92, 46, 92, 80.5), P(7, 46, 93, 46, 93, 43.4, 7, 43.4, 7, 46), P(8, 43.4, 8, 36.6, 92, 36.6, 92, 43.4));
    g.o(P(36, 43.4, cx, 38, 64, 43.4));
    let cols = "";
    for (const x of [11.6, 21.4, 31.2, 39.4, 60.6, 68.8, 78.6, 88.4]) cols += P(x - 1.5, 80.5, x - 1.5, 48) + P(x + 1.5, 80.5, x + 1.5, 48) + P(x - 2.1, 48, x + 2.1, 48, x + 2.1, 46);
    g.d(cols, P(7.6, 36.6, 92.4, 36.6, 92.4, 35.2, 7.6, 35.2, 7.6, 36.6));
    let statues = "";
    for (let x = 10; x < 91; x += 5.4) statues += P(x, 35.2, x, 32.4) + ring(x, 31.6, 0.8);
    g.f(statues, P(8, 44.8, 92, 44.8), P(39, 42.6, cx, 39.6, 61, 42.6));
    // Doors below, the loggia over the middle one, the windows.
    g.d(arch(46.8, 80.5, 6.4, 72) + arch(24.2, 80.5, 4.2, 74.6) + arch(71.6, 80.5, 4.2, 74.6), arch(46.8, 64, 6.4, 57.4));
    let win = "";
    for (const x of [16.5, 26.3, 34.9, 65.1, 73.7, 83.5]) win += R(x - 1.8, 55, 3.6, 5.6) + R(x - 1.3, 39, 2.6, 2.6);
    g.f(win);
    // The dome behind: its drum with paired columns, the ribs, the lantern and the cross.
    g.o(P(28.6, 35.2, 28.6, 27, 71.4, 27, 71.4, 35.2), sym("M29.2 27C29.6 15.6 40 10.6 46.2 10", cx), P(46.4, 10, 46.4, 6, 53.6, 6, 53.6, 10), "M45.8 6Q50 2.8 54.2 6");
    g.d(P(28, 27, 72, 27), P(cx, 3.8, cx, 0.4), P(48.6, 1.8, 51.4, 1.8));
    let ribs = "", drum = "";
    for (const k of [-0.62, -0.25, 0.25, 0.62]) ribs += D`M${cx + k * 21} ${27}Q${cx + k * 19} ${14} ${cx + k * 5.4} ${10.2}`;
    for (let x = 31; x < 70; x += 4.8) drum += P(x, 34.8, x, 28) + P(x + 1, 34.8, x + 1, 28);
    g.f(ribs, drum, P(47.9, 9.6, 47.9, 6.4) + P(cx, 9.6, cx, 6.4) + P(52.1, 9.6, 52.1, 6.4));
    // The two small domes at the corners.
    for (const c of [17, 83]) {
      g.o(P(c - 4.4, 35.2, c - 4.4, 31.4, c + 4.4, 31.4, c + 4.4, 35.2), D`M${c - 4} ${31.4}A4 4.4 0 0 1 ${c + 4} ${31.4}`);
      g.d(P(c, 27, c, 24.2));
    }
  },
};

/** A minaret: its shaft, balconies, the cone and its finial. */
function minaret(g: Pen, x: number, yb: number, top: number, w: number) {
  const bal = [top + (yb - top) * 0.34, top + (yb - top) * 0.62];
  g.o(P(x - w / 2, yb, x - w / 2, top + 6) + P(x + w / 2, yb, x + w / 2, top + 6), P(x - w / 2 - 0.3, top + 6, x, top, x + w / 2 + 0.3, top + 6));
  g.d(...bal.map((y) => P(x - w / 2 - 0.9, y, x + w / 2 + 0.9, y)), P(x, top, x, top - 2.6), P(x - w / 2 - 0.4, top + 6, x + w / 2 + 0.4, top + 6));
  g.f(...bal.map((y) => P(x - w / 2 - 0.9, y + 1, x + w / 2 + 0.9, y + 1)));
}

const hagiasophia: Drawing = {
  w: 100,
  h: 78,
  draw(g) {
    const cx = 50;
    g.o(P(0, 78, 100, 78));
    // The four minarets.
    minaret(g, 4, 78, 9, 3.2);
    minaret(g, 96, 78, 9, 3.2);
    minaret(g, 14.6, 78, 16, 3);
    minaret(g, 85.4, 78, 16, 3);
    // The body: the buttressed walls, the half-domes stepping up, the drum and the shallow great dome.
    g.o(P(19, 78, 19, 55, 81, 55, 81, 78), sym("M24 55V50Q27 46.4 32 45.6Q34 42.4 38 41.6", cx), P(34, 41.6, 34, 36, 66, 36, 66, 41.6), "M33.4 36Q35.6 23.4 50 21.8Q64.4 23.4 66.6 36");
    g.d(P(18.4, 55, 81.6, 55), P(33.4, 36, 66.6, 36), P(cx, 21.8, cx, 17.6), sym(P(28, 55, 28, 48.2) + P(32, 55, 32, 45.8) + P(24, 50, 31.6, 50), cx));
    g.dot(cx, 17, 0.7);
    // Buttress towers against the drum.
    g.d(sym(P(30.4, 45.8, 30.4, 38.6, 34, 38.6), cx));
    // Windows: round-headed, in rows; the drum's ring of forty.
    let w = "";
    for (let x = 22.6; x < 78; x += 4.6) w += arch(x, 66, 2, 62.4) + arch(x, 75, 2, 71.4);
    for (let x = 35.6; x < 64.4; x += 2.4) w += arch(x, 40.6, 1.2, 38.4);
    w += arch(38.4, 53, 2, 50.6) + arch(59.6, 53, 2, 50.6);
    g.f(w, "M40 30Q50 27.4 60 30");
    g.d(arch(46.4, 78, 7.2, 72.4));
    g.d(tree(9.4, 78, 4.4), tree(90.6, 78, 4.4));
  },
};

const matterhorn: Drawing = {
  w: 100,
  h: 74,
  draw(g) {
    // The peak: the long ridges, the summit's hook; the Hörnli ridge between the faces.
    const left = smooth([[0, 60], [10, 55], [18, 48], [26, 40], [32, 32.4], [36, 26], [42, 16], [47, 9], [50.4, 5.4], [54.6, 3]], 5);
    const right = smooth([[54.6, 3], [57.4, 4.4], [59.2, 10.4], [61.6, 17.4], [65, 23.6], [70, 30], [76, 37], [86, 44.6], [100, 50]], 5);
    const ridge = smooth([[54.6, 3], [55.8, 12], [57, 21], [59, 30.6], [61.6, 38.4], [65.4, 46], [70, 53]], 5);
    g.o(line(left), line(right));
    g.d(line(ridge));
    // The shaded north face hatched, the lit east face's snow gullies.
    let hatch = "";
    for (let y = 9; y < 50; y += 3.1) {
      const [xr, xo] = [xOn(ridge, y), xOn(right, y)];
      if (xo - xr > 2.4) hatch += P(xr + 0.9, y, xr + (xo - xr) * 0.62, y + (xo - xr) * 0.2);
    }
    g.f(hatch);
    g.d("M47.2 14L44.4 21.4M51.2 12L49.6 20M44.4 26L40.6 32.6M50.8 26L48.4 34M40 38L36.4 43M47 40L44.8 46.6");
    g.f("M53.6 9L52.8 15M42 32L39 36.6M55 30L54 38M35 44L31.4 48");
    // The lower slopes, a chalet, firs; a cloud by the summit.
    g.d("M0 64Q16 58 30 60.6Q44 62.6 56 58.4Q66 55 78 56Q90 57 100 55");
    g.o(P(0, 74, 100, 74));
    g.o(P(12, 74, 12, 67.6, 20, 67.6, 20, 74), P(10.6, 68.6, 16, 63.6, 21.4, 68.6));
    g.d(R(14.8, 70.4, 2.4, 3.6), P(12, 69.6, 20, 69.6));
    let firs = "";
    for (const [x, s] of [[4, 5], [26, 4], [31, 5.4], [70, 5], [76, 6], [82, 4.6], [94, 5.6]] as const) firs += fir(x, 74, s);
    g.d(firs);
    g.d(cloud(62, 12, 12), bird(26, 14, 1.8), bird(31, 11, 1.4));
  },
};

/** A windmill standing at (cx, yb), s its scale, its sails turned by rot degrees. */
function windmill(g: Pen, cx: number, yb: number, s: number, rot: number) {
  const hub: Pt = [cx, yb - 37 * s];
  g.o(P(cx - 9 * s, yb, cx - 5.4 * s, yb - 34 * s) + P(cx + 9 * s, yb, cx + 5.4 * s, yb - 34 * s), D`M${cx - 6.2 * s} ${yb - 34 * s}Q${cx - 6 * s} ${yb - 41 * s} ${cx} ${yb - 42 * s}Q${cx + 6 * s} ${yb - 41 * s} ${cx + 6.2 * s} ${yb - 34 * s}`);
  g.d(P(cx - 6.4 * s, yb - 34 * s, cx + 6.4 * s, yb - 34 * s), P(cx - 3.6 * s, yb, cx - 2.2 * s, yb - 34 * s) + P(cx + 3.6 * s, yb, cx + 2.2 * s, yb - 34 * s), arch(cx - 1.8 * s, yb, 3.6 * s, yb - 4.4 * s));
  g.f(P(cx - 7.6 * s, yb - 12 * s, cx + 7.6 * s, yb - 12 * s), R(cx - 1 * s, yb - 24 * s, 2 * s, 3 * s));
  // Four sails: the stock, and the lattice frame on one side of it.
  const L = 30 * s, wd = 5 * s;
  let stocks = "", frames = "", bars = "";
  for (let k = 0; k < 4; k++) {
    const a = ((rot + k * 90) * Math.PI) / 180;
    const [ux, uy] = [Math.cos(a), Math.sin(a)];
    const [nx, ny] = [-uy * wd, ux * wd];
    const at = (t: number, off = 0): Pt => [hub[0] + ux * L * t + nx * off, hub[1] + uy * L * t + ny * off];
    stocks += line([at(0.05), at(1)]);
    frames += line([at(0.22), at(0.22, 1), at(1, 1), at(1)]);
    bars += line([at(0.22, 0.5), at(1, 0.5)]);
    for (let t = 0.3; t < 0.99; t += 0.085) bars += line([at(t), at(t, 1)]);
  }
  g.o(stocks);
  g.d(frames, ring(hub[0], hub[1], 1.2 * s));
  g.f(bars);
}

const kinderdijk: Drawing = {
  w: 100,
  h: 78,
  draw(g) {
    // The far bank, two mills along it; the near mill on this side of the canal.
    g.d(P(56, 60, 100, 60));
    windmill(g, 90, 60, 0.36, 45);
    windmill(g, 72, 60, 0.56, 28);
    windmill(g, 32, 68, 1, 45);
    // The canal, the reeds, the mill in the water.
    g.o(P(0, 68, 100, 68));
    g.d(wave(46, 64, 10), wave(4, 73, 12), wave(30, 72, 12), wave(62, 73, 12), wave(84, 72, 12));
    g.f(P(26, 70.4, 38, 70.4), P(28, 72.6, 36, 72.6), P(50, 76, 60, 76), P(8, 76, 16, 76));
    g.d(tuft(4, 68, 1.4), tuft(8, 68, 1.2), tuft(58, 68, 1.3), tuft(96, 68, 1.4), P(0, 78, 100, 78));
  },
};

const chichenitza: Drawing = {
  w: 100,
  h: 62,
  draw(g) {
    const cx = 50, yb = 60, n = 9, top = 22;
    const th = (yb - top) / n, dx = (33 - 8) / n;
    // The nine terraces, each a sloping face; the stair up the middle, its balustrades.
    const prof: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = [8 + i * dx, yb - i * th];
      prof.push([x, y], [x + 1.2, y - th * 0.8], [x + 1.2, y - th]);
    }
    prof.push([33, top]);
    const stairAt = (y: number) => 42 + ((yb - y) / (yb - top)) * 3;
    g.o(line(prof) + mir(line(prof), cx), P(33, top, 67, top));
    g.o(P(42, yb, 45, top) + P(58, yb, 55, top));
    let terr = "", fine = "";
    for (let i = 1; i < n; i++) {
      const [x, y] = [8 + i * dx, yb - i * th];
      terr += P(x, y, stairAt(y), y) + P(2 * cx - stairAt(y), y, 2 * cx - x, y);
      fine += P(x - dx + 1.2, y + th * 0.2, stairAt(y + th * 0.2), y + th * 0.2) + P(2 * cx - stairAt(y + th * 0.2), y + th * 0.2, 2 * cx - x + dx - 1.2, y + th * 0.2);
    }
    g.d(terr, P(43.6, yb, 46.2, top) + P(56.4, yb, 53.8, top));
    let steps = "";
    for (let y = yb - 1.6; y > top + 0.8; y -= 1.6) steps += P(stairAt(y) + 1.4, y, 2 * cx - stairAt(y) - 1.4, y);
    g.f(fine, steps);
    // The temple on top: its doorway, three bays, the roof.
    g.o(P(38, top, 38, 10.4, 62, 10.4, 62, top), P(37, 10.4, 63, 10.4, 63, 7.8, 37, 7.8, 37, 10.4));
    g.d(R(43.6, 14.4, 12.8, 7.6), P(37.6, 13, 62.4, 13), P(39, 7.8, 39, 5.6, 61, 5.6, 61, 7.8));
    g.f(P(47.8, 14.4, 47.8, top) + P(52.2, 14.4, 52.2, top), R(39.6, 15.4, 2.6, 4) + R(57.8, 15.4, 2.6, 4));
    // The serpents' heads at the stair's foot.
    g.d(sym("M42 60Q39.2 60.2 39 58.2Q38.8 56.2 41.6 56.4", cx));
    // The plinth, the grass, a pair of birds.
    g.o(P(0, 62, 100, 62), P(5.4, 62, 5.4, yb, 94.6, yb, 94.6, 62));
    g.d(tuft(2.4, 62), tuft(97.4, 62), bird(80, 12, 1.8), bird(86, 9, 1.4), tree(96, 60, 4.4), tree(4, 60, 4.4));
  },
};

const spaceneedle: Drawing = {
  w: 50,
  h: 100,
  draw(g) {
    const cx = 25;
    // The three legs: pinched at the waist, flaring out to the top house; the middle one in front.
    const outer = smooth([[5, 100], [12.4, 84], [19.6, 67], [18.2, 48], [15, 26.6]], 6);
    const inner = smooth([[8.6, 100], [14.8, 84], [21.2, 67.6], [20.2, 48], [17.8, 26.6]], 6);
    g.o(sym(line(outer), cx), sym(line(inner), cx), P(23.2, 100, 23.6, 26.6) + P(26.8, 100, 26.4, 26.6));
    // The halo at the waist, the braces.
    g.d(P(18.6, 67, 31.4, 67), P(19, 69, 31, 69));
    let br = "";
    for (const y of [88, 78, 58, 44, 34]) br += P(xOn(inner, y), y, 23.3, y) + P(26.7, y, 2 * cx - xOn(inner, y), y);
    g.f(br);
    // The top house: the underside, the halo ring, the windows, the roof and the spire.
    g.o(sym("M15 26.6Q9 25 3 20.4", cx), P(2, 20.4, 48, 20.4), P(4, 17, 46, 17), sym("M4 17Q10 13.4 18 11.8L22 11", cx), P(22, 11, 22, 8.2, 28, 8.2, 28, 11));
    g.d(P(2, 20.4, 4, 17) + P(48, 20.4, 46, 17), P(cx, 8.2, cx, 0.4), P(15, 26.6, 35, 26.6));
    let w = "";
    for (let x = 6.4; x < 44; x += 2.6) w += P(x, 17.8, x, 19.6);
    g.f(w, P(8, 23.4, 42, 23.4));
    g.o(P(0, 100, 50, 100));
    g.d(P(1, 100, 1, 96.4, 7.4, 96.4) + P(49, 100, 49, 96.4, 42.6, 96.4));
  },
};

const cntower: Drawing = {
  w: 46,
  h: 100,
  draw(pen) {
    // Drawn with the tower's axis at 18, then set 5 to the right for the city round its foot.
    const g = moved(pen, 5, 0);
    const cx = 18;
    // The shaft: three flared wings at its foot, tapering up to the pod; its ribs.
    g.o(sym("M8.6 100Q12.4 96.6 13 89L15.8 34.6", cx));
    g.d(P(cx, 98, cx, 35));
    g.f(sym(P(15.2, 94, 16.9, 35), cx));
    // The main pod: the underside, its windowed band, the top.
    g.o(sym("M18 34.6H15.6L8.2 30.2L6.6 28L7.6 25.6L12.4 23.6H18", cx));
    g.d(P(8.2, 30.2, 27.8, 30.2), P(7.6, 25.6, 28.4, 25.6));
    let w = "";
    for (let x = 8.8; x < 27.5; x += 1.9) w += P(x, 26.4, x, 29.4);
    g.f(w);
    // The upper shaft, the SkyPod, the mast.
    g.o(sym(P(16.6, 23.6, 16.9, 14.2), cx), P(15.2, 14.2, 15.2, 11.4, 20.8, 11.4, 20.8, 14.2, 15.2, 14.2), P(16.9, 11.4, 17.5, 3, cx, 0.4, 18.5, 3, 19.1, 11.4));
    g.f(P(17.1, 8, 18.9, 8), P(17.3, 5.4, 18.7, 5.4), P(15.2, 12.8, 20.8, 12.8));
    // The city at its foot; the ground.
    const blocks: [number, number, number][] = [[-4.6, 4.2, 17], [0.4, 5.4, 10.6], [6.6, 2.8, 5.6], [27.6, 3.2, 6.4], [31.6, 4.6, 19.4], [37, 3.6, 12.4]];
    let win = "";
    for (const [x, w, h] of blocks) {
      g.d(P(x, 100, x, 100 - h, x + w, 100 - h, x + w, 100));
      for (let y = 100 - h + 2.4; y < 99; y += 2.8) win += P(x + 0.9, y, x + w - 0.9, y);
    }
    g.f(win);
    g.o(P(-5, 100, 41, 100));
  },
};

const chrysler: Drawing = {
  w: 40,
  h: 100,
  draw(g) {
    const cx = 20;
    // The base, the shaft and the tower stepping in.
    g.o(sym(P(cx, 100, 2, 100, 2, 86, 6, 86, 6, 50, 9.6, 50, 9.6, 38), cx));
    g.d(P(2, 86, 38, 86), P(6, 50, 34, 50), sym(P(8.6, 86, 8.6, 50), cx));
    // The eagles at the setback's corners.
    g.d(sym("M9.6 49.6L6.8 48.4L9.6 47.6", cx));
    // The crown: arches stacked and narrowing, sunburst windows between them, the needle.
    const tiers = Array.from({ length: 6 }, (_, i) => ({ hw: 10.4 - 1.6 * i, ys: 38 - 5.4 * i }));
    const ry = (hw: number) => hw * 0.86;
    let arches = "", sides = "";
    tiers.forEach(({ hw, ys }, i) => {
      arches += D`M${cx - hw} ${ys}A${hw} ${ry(hw)} 0 0 1 ${cx + hw} ${ys}`;
      if (i > 0) {
        const p = tiers[i - 1];
        const yp = p.ys - ry(p.hw) * Math.sqrt(Math.max(0, 1 - (hw / p.hw) ** 2));
        sides += P(cx - hw, yp, cx - hw, ys) + P(cx + hw, yp, cx + hw, ys);
      }
    });
    g.o(arches, sides);
    let sun = "";
    tiers.slice(0, -1).forEach(({ hw, ys }, i) => {
      const nx = tiers[i + 1];
      for (const ph of [-0.62, -0.31, 0, 0.31, 0.62]) {
        const a = Math.PI / 2 + ph * 1.5;
        const [x0, y0] = [cx - Math.cos(a) * hw * 0.93, ys - Math.sin(a) * ry(hw) * 0.93];
        const [x1, y1] = [cx - Math.cos(a) * nx.hw * 1.02, nx.ys - Math.sin(a) * ry(nx.hw) * 1.02];
        if (y1 > y0 - 0.8) continue;
        sun += Pz(x0 - 0.45, y0, x0 + 0.45, y0, x0 + (x1 - x0) * 0.62, y0 + (y1 - y0) * 0.62);
      }
    });
    g.f(sun);
    const last = tiers[tiers.length - 1];
    g.o(P(cx - 0.9, last.ys - ry(last.hw) + 0.2, cx, 0.4, cx + 0.9, last.ys - ry(last.hw) + 0.2));
    // The piers up the shaft, the windows in the base.
    let piers = "";
    for (let x = 11.2; x < 29; x += 2.6) piers += P(x, 84, x, 52) + P(x + 1.3, 48.6, x + 1.3, 39.4);
    g.f(piers);
    g.d(garch(17, 100, 6, 94.4, 3.2), P(2, 90, 14, 90) + P(26, 90, 38, 90));
    g.f(P(4, 94, 14, 94) + P(26, 94, 36, 94));
  },
};

const gatewayarch: Drawing = {
  w: 100,
  h: 96,
  draw(g) {
    const cx = 50, yb = 86, C = 2.2;
    // The arch: a weighted catenary, wide at its feet and slender at the top, its edge down the middle.
    const f = (u: number) => (Math.cosh(C) - Math.cosh(C * u)) / (Math.cosh(C) - 1);
    const curve = (half: number, rise: number) => line(Array.from({ length: 61 }, (_, i) => -1 + i / 30).map((u): Pt => [cx + half * u, yb - rise * f(u)]));
    g.o(curve(38, 80), curve(31, 76.4));
    g.d(curve(34.6, 78.2));
    // The Old Courthouse seen through it, trees along the levee.
    g.o(P(40, yb, 40, 80, 60, 80, 60, yb), P(45.6, 80, 45.6, 75.6, 54.4, 75.6, 54.4, 80), "M46 75.6Q46 69.6 50 69Q54 69.6 54 75.6");
    g.d(P(cx, 69, cx, 66), P(39.4, 80, 60.6, 80), arch(48.4, yb, 3.2, 83));
    g.f(P(42, 82.4, 46, 82.4) + P(54, 82.4, 58, 82.4), P(47.4, 78, 52.6, 78));
    g.d(tree(5, yb, 6), tree(95, yb, 6), tree(26, yb, 4.6), tree(74, yb, 4.6), tree(33, yb, 3.6), tree(67, yb, 3.6));
    // The river.
    g.o(P(0, yb, 100, yb));
    g.d(wave(8, 90), wave(40, 91), wave(76, 90), wave(22, 94.4), wave(60, 94.6));
    g.f(P(28, 89.6, 34, 89.6), P(58, 89.6, 66, 89.6));
  },
};

const petronas: Drawing = {
  w: 64,
  h: 100,
  draw(g) {
    // Each tower: tiers stepping in, round in plan, tapering into the pinnacle.
    const tower = (cx: number) => {
      const steps: [number, number][] = [[10, 44], [8.4, 34], [6.8, 27], [5.2, 21], [3.6, 16]];
      const half: Pt[] = [[cx - 10, 94]];
      steps.forEach(([hw, y], i) => {
        half.push([cx - hw, y]);
        const nx = steps[i + 1];
        if (nx) half.push([cx - nx[0], y]);
      });
      half.push([cx - 2.2, 16], [cx - 1.4, 12], [cx - 0.5, 6], [cx, 0.6]);
      g.o(line(half) + mir(line(half), cx));
      g.d(...steps.slice(1).map(([hw, y]) => D`M${cx - hw} ${y + 0.2}Q${cx} ${y + 1.4} ${cx + hw} ${y + 0.2}`), P(cx - 2.2, 16, cx + 2.2, 16), ring(cx, 9.2, 1));
      g.d(P(cx - 5, 94, cx - 5, 44.4) + P(cx, 94, cx, 44.4) + P(cx + 5, 94, cx + 5, 44.4));
      let floors = "";
      for (let y = 90; y > 46; y -= 4.4) floors += P(cx - 10, y, cx + 10, y);
      for (const [hw, y] of steps.slice(1, 4)) floors += P(cx, y - 1, cx, y - (y > 30 ? 8.4 : 5)) + P(cx - hw * 0.5, y - 1, cx - hw * 0.5, y - 4.4) + P(cx + hw * 0.5, y - 1, cx + hw * 0.5, y - 4.4);
      g.f(floors);
    };
    tower(15);
    tower(49);
    // The skybridge and its legs.
    g.o(P(25, 56, 39, 56), P(25, 59.4, 39, 59.4));
    g.d(P(30.6, 59.4, 25, 70) + P(33.4, 59.4, 39, 70));
    let w = "";
    for (let x = 27; x < 38; x += 2) w += P(x, 56.8, x, 58.6);
    g.f(w);
    // The podium, the ground.
    g.o(P(0, 100, 64, 100), P(1, 100, 1, 94, 63, 94, 63, 100));
    g.f(P(1, 97, 63, 97));
  },
};

const heaven: Drawing = {
  w: 100,
  h: 90,
  draw(pen) {
    // Drawn with its foot at 94, then set 4 higher.
    const g = moved(pen, 0, -4);
    const cx = 50;
    // The three marble terraces, their balustrades, the stair.
    g.o(P(0, 94, 100, 94), P(4, 94, 4, 88, 96, 88, 96, 94), P(12, 88, 12, 82, 88, 82, 88, 88), P(20, 82, 20, 76, 80, 76, 80, 82));
    let posts = "";
    for (const [x0, x1, y] of [[4, 96, 88], [12, 88, 82], [20, 80, 76]] as const) {
      posts += P(x0, y - 2.2, x1, y - 2.2);
      for (let x = x0 + 1.6; x < x1; x += 3.2) if (x < 44 || x > 56) posts += P(x, y, x, y - 2.2);
    }
    g.f(posts);
    g.d(P(44, 94, 46, 76) + P(56, 94, 54, 76));
    // The hall: its lattice doors; three roofs sweeping out, the drums between them, the gilded finial.
    g.o(P(31, 76, 31, 64.4) + P(69, 76, 69, 64.4));
    let doors = "";
    for (let x = 33.4; x < 68; x += 2.8) doors += P(x, 75.4, x, 66);
    g.f(doors);
    g.o(sym("M18 64.4L17 63Q26 63.2 31 59.4Q34 56.8 35.6 54.6", cx), P(18, 64.4, 82, 64.4));
    g.o(P(35.6, 54.6, 35.6, 49.4) + P(64.4, 54.6, 64.4, 49.4));
    g.o(sym("M22.8 49.4L22 48.2Q30 48.2 34.4 45Q37.4 42.6 39 40.4", cx), P(22.8, 49.4, 77.2, 49.4));
    g.o(P(39, 40.4, 39, 35.6) + P(61, 40.4, 61, 35.6));
    g.o(sym("M27 35.6L26.4 34.4Q35 34 40 30Q45.4 25.6 47.6 20.4", cx), P(27, 35.6, 73, 35.6));
    g.o(P(47.6, 20.4, 48.4, 18.4, 51.6, 18.4, 52.4, 20.4), ring(cx, 15.8, 2.6));
    g.d(P(cx, 13.2, cx, 9.4), P(35.6, 52.8, 64.4, 52.8), P(39, 38.6, 61, 38.6), P(31, 66.2, 69, 66.2));
    // Tiles down each roof, brackets round each drum.
    let tiles = "";
    const roof = (yb: number, xb0: number, xb1: number, yt: number, xt0: number, xt1: number, n: number) => {
      for (let i = 1; i < n; i++) {
        const u = i / n;
        tiles += P(xb0 + (xb1 - xb0) * u, yb - 0.8, xt0 + (xt1 - xt0) * u, yt + 0.6);
      }
    };
    roof(64.4, 20, 80, 54.6, 35.6, 64.4, 14);
    roof(49.4, 25, 75, 40.4, 39, 61, 12);
    roof(35.6, 29, 71, 20.4, 47.6, 52.4, 10);
    let br = "";
    for (let x = 37.6; x < 63; x += 2.4) br += P(x, 54.4, x, 53.2);
    for (let x = 41; x < 60; x += 2.4) br += P(x, 40.2, x, 39);
    g.f(tiles, br);
    // Clouds either side.
    g.d(cloud(3, 40, 13), cloud(84, 30, 12), cloud(76, 52, 9));
  },
};

/** A pine in the Japanese way: a leaning trunk, flat pads of needles. */
function pine(x: number, y: number, s: number, dir: number): string {
  const t = D`M${x} ${y}Q${x - dir * s * 0.3} ${y - s * 0.6} ${x + dir * s * 0.5} ${y - s * 1.3}`;
  const pad = (px: number, py: number, w: number) => {
    const a = px - w / 2, h = w * 0.3;
    return D`M${a} ${py}Q${a - w * 0.04} ${py - h * 0.8} ${a + w * 0.22} ${py - h * 0.8}Q${a + w * 0.36} ${py - h * 1.4} ${a + w * 0.56} ${py - h * 1.05}Q${a + w * 0.8} ${py - h * 1.2} ${a + w * 0.86} ${py - h * 0.6}Q${a + w * 1.04} ${py - h * 0.4} ${a + w} ${py}Z`;
  };
  return t + D`M${x + dir * 0.9} ${y}Q${x - dir * s * 0.2} ${y - s * 0.6} ${x + dir * s * 0.56} ${y - s * 1.24}` + pad(x + dir * s * 0.5, y - s * 1.3, s * 1.1) + pad(x - dir * s * 0.1, y - s * 0.72, s * 0.8) + pad(x + dir * s * 0.7, y - s * 0.62, s * 0.7);
}

const kinkakuji: Drawing = {
  w: 100,
  h: 76,
  draw(pen) {
    // Drawn with the bird's tail at 3, then set 3 higher.
    const g = moved(pen, 0, -3);
    const cx = 50;
    // The ground floor: posts on the water, its railing.
    g.o(P(24, 62, 76, 62), P(26, 62, 26, 50.2) + P(74, 62, 74, 50.2));
    let posts = "";
    for (let x = 32; x < 70; x += 6) posts += P(x, 61.6, x, 50.6);
    g.d(posts);
    g.f(P(26, 58, 74, 58));
    // The roofs: wide, thin, their corners turned up; the storeys between.
    g.o(sym("M20.4 50.2L19 48.8Q27 48.6 30 45.4", cx), P(20.4, 50.2, 79.6, 50.2), P(30, 45.4, 70, 45.4));
    g.o(P(30, 45.4, 30, 36) + P(70, 45.4, 70, 36));
    g.d(P(28, 43.4, 72, 43.4), P(28, 43.4, 28, 45.4) + P(72, 43.4, 72, 45.4));
    let pan = "";
    for (let x = 33; x < 68; x += 5) pan += R(x, 37.4, 3.4, 4.4);
    g.f(pan);
    g.o(sym("M24.4 36L23 34.6Q30 34.4 33 31.2", cx), P(24.4, 36, 75.6, 36), P(33, 31.2, 67, 31.2));
    g.o(P(36, 31.2, 36, 22.8) + P(64, 31.2, 64, 22.8));
    g.d(P(34.4, 29.6, 65.6, 29.6));
    g.f(garch(39.6, 28.4, 4, 25.4, 2.4) + garch(48, 28.4, 4, 25.4, 2.4) + garch(56.4, 28.4, 4, 25.4, 2.4));
    g.o(sym("M29.4 22.8L28 21.4Q36 21 40.6 16.4Q45.4 12 48.6 10.2", cx), P(29.4, 22.8, 70.6, 22.8), P(48.6, 10.2, 51.4, 10.2));
    // The phoenix on the ridge.
    g.d("M50 10.2V8.4Q50.6 6.6 52.4 5.8Q53.4 5.2 53.8 4.2M50.4 7.6Q47.6 6.4 46.4 3.6M50.2 8.6Q48 8.8 46.8 7.6");
    // The pond: its surface, the pavilion's reflection, rocks; pines on the banks.
    g.o(P(0, 62, 24, 62), P(76, 62, 100, 62));
    g.d(wave(4, 67), wave(80, 66), wave(14, 74), wave(62, 75), wave(38, 78, 10));
    g.f(P(28, 65, 72, 65), P(31, 67.6, 69, 67.6), P(34, 70.2, 50, 70.2) + P(54, 70.2, 66, 70.2), P(38, 72.8, 62, 72.8));
    g.d("M84 70Q86 66.8 90 67.2Q92 68 92.6 70Z", "M8 71.4Q9.6 69 12.4 69.6Q13.6 70.4 14 71.4Z");
    g.d(pine(10, 62, 9, 1), pine(90, 62, 10, -1), pine(4, 62, 6, 1));
    g.o(P(0, 79, 100, 79));
  },
};

const itsukushima: Drawing = {
  w: 100,
  h: 70,
  draw(g) {
    // The top beams: the kasagi sweeping up at its ends, the shimaki under it.
    g.o("M8 7Q22 13 36 13.6H64Q78 13 92 7L89.6 10.6Q77 15.8 64 16.6H36Q23 15.8 10.4 10.6Z");
    g.o(P(14.4, 12.6, 14.4, 19.4, 85.6, 19.4, 85.6, 12.6));
    // The plaque on its strut, the tie beam through the pillars.
    g.d(P(48, 19.4, 48, 28) + P(52, 19.4, 52, 28), R(46.2, 20.6, 7.6, 5.6));
    g.o(P(16, 28, 84, 28, 84, 31.4, 16, 31.4, 16, 28));
    // The main pillars, broken by the tie beam; the smaller legs either side, tied to them.
    const pillar = (x0: number, x1: number) => P(x0, 19.4, x0 - 0.2, 28) + P(x1, 19.4, x1 + 0.2, 28) + P(x0 - 0.3, 31.4, x0 - 0.9, 60) + P(x1 + 0.3, 31.4, x1 + 0.9, 60);
    g.o(pillar(29, 34.6), pillar(65.4, 71));
    const leg = (x: number) => P(x - 1.6, 36.4, x - 1.6, 60) + P(x + 1.6, 36.4, x + 1.6, 60) + D`M${x - 2.6} ${36.4}L${x - 1.8} ${35}H${x + 1.8}L${x + 2.6} ${36.4}Z`;
    g.d(leg(22), leg(41.4), leg(58.6), leg(78));
    g.d(P(23.6, 39, 28.6, 39) + P(35, 39, 39.8, 39) + P(60.2, 39, 65, 39) + P(71.4, 39, 76.4, 39), P(23.6, 52, 28.4, 52) + P(35.2, 52, 39.8, 52) + P(60.2, 52, 64.8, 52) + P(71.6, 52, 76.4, 52));
    // The mountains behind, the sea: its line broken at every foot, ripples and the reflection.
    g.d("M0 46Q8 38.4 14 38.6Q17.6 38.8 20.4 41.4", "M79.6 38.6Q86 32 92 32.6Q96 33.2 100 35.4");
    const feet: [number, number][] = [[20, 24], [27.8, 35.8], [39.4, 43.4], [56.6, 60.6], [64.2, 72.2], [76, 80]];
    g.o(gapped(60, 0, 100, feet));
    g.d(...feet.map(([a, b]) => wave(a - 1.6, 61.8, b - a + 3.2)), wave(4, 65), wave(84, 66));
    g.f(P(28.4, 64, 28.4, 66.6) + P(35.4, 64, 35.4, 66.6) + P(64.6, 64, 64.6, 66.6) + P(71.6, 64, 71.6, 66.6), P(14, 69, 86, 69), P(12, 64.4, 20, 64.4) + P(44, 64.4, 56, 64.4) + P(80, 64.4, 88, 64.4));
    g.d(bird(40, 36, 1.6), bird(45, 33.4, 1.3));
  },
};

const marinabay: Drawing = {
  w: 100,
  h: 58,
  draw(g) {
    const yb = 46;
    // Three towers, each two legs, the outer one curving out to its foot; their floors.
    const leg = (c: number): [Pt, Pt, Pt] => [[c + 6, 12.6], [c + 6, 34], [c + 10.4, yb]];
    let floors = "";
    for (const c of [26, 50, 74]) {
      const l = leg(c);
      g.o(P(c - 6, 12.6, c - 6, yb), line(qPts(...l)));
      g.d(line(qPts([c + 1.2, 16], [c + 1.4, 36], [c + 3.4, yb], 12)));
      for (let y = 16; y < yb - 1; y += 3) floors += P(c - 5.4, y, qxAt(...l, y) - 0.6, y);
    }
    g.f(floors);
    // The SkyPark: a hull laid across the three, its garden, its cantilever.
    g.o("M3 9.4H90L98.6 7.4Q99.4 9.4 96.2 11.2Q93 12.6 86 12.6H14Q7 12.4 3 9.4Z");
    let tr = "";
    for (let x = 8; x < 86; x += 3.4) tr += D`M${x} ${9.4}Q${x + 0.9} ${7.4} ${x + 1.8} ${9.4}`;
    g.f(tr, P(10, 11, 88, 11));
    // The ArtScience Museum's lotus in front; the promenade and the bay.
    g.o("M1 46Q0.6 40.6 3 37.4Q4 42 5 46M4.4 46Q4.6 39 8 34.4Q9 40.6 8.4 46M8 46Q9.6 38.6 13.6 36Q13.4 41 11.6 46M11.4 46Q13.8 41.6 17 41.4Q16 44 15 46");
    g.o(P(0, yb, 100, yb));
    g.d(P(18, 43, 90, 43), wave(4, 50), wave(34, 51), wave(64, 50), wave(84, 53), wave(18, 55), wave(50, 56));
    g.f(P(24, 48.6, 36, 48.6) + P(48, 48.6, 60, 48.6) + P(72, 48.6, 86, 48.6));
  },
};

const taipei101: Drawing = {
  w: 40,
  h: 100,
  draw(g) {
    const cx = 20;
    // The pedestal narrowing up; eight flared sections stacked like bamboo; the top and the spire.
    const half: Pt[] = [[6.8, 100], [10.6, 68], [11.4, 68]];
    for (let i = 0; i < 8; i++) {
      const yb = 68 - 6.2 * i, yt = yb - 6.2;
      half.push([cx - 8.6, yb], [cx - 11.6, yt]);
      if (i < 7) half.push([cx - 8.6, yt]);
    }
    const yTop = 68 - 6.2 * 8;
    half.push([cx - 5, yTop], [cx - 5, yTop - 4.4], [cx - 3.4, yTop - 4.4], [cx - 3.4, yTop - 7.8], [cx - 1.2, yTop - 7.8]);
    g.o(line(half) + mir(line(half), cx), P(cx - 1.2, yTop - 7.8, cx, 0.4, cx + 1.2, yTop - 7.8));
    g.o(P(cx - 11.6, yTop, cx + 11.6, yTop));
    let sec = "", fine = "";
    for (let i = 0; i < 8; i++) {
      const yb = 68 - 6.2 * i;
      sec += P(cx - 8.6, yb, cx + 8.6, yb);
      fine += P(cx - 10.1, yb - 3.1, cx + 10.1, yb - 3.1);
    }
    g.d(sec, P(cx, 98, cx, 69), P(cx - 5, yTop - 4.4, cx + 5, yTop - 4.4));
    g.f(fine, P(15.4, 98, 16.2, 69) + P(24.6, 98, 23.8, 69), P(8, 88, 32, 88) + P(8.8, 80, 31.2, 80));
    // The ruyi on the pedestal's face.
    g.d(ring(cx, 73.4, 2.2));
    // The mall at its foot.
    g.o(P(0, 100, 40, 100));
    g.d(P(0.6, 100, 0.6, 93, 7.6, 93) + P(39.4, 100, 39.4, 93, 32.4, 93));
    g.f(P(0.6, 96.4, 7.2, 96.4) + P(39.4, 96.4, 32.8, 96.4));
  },
};

const table: Drawing = {
  w: 100,
  h: 52,
  draw(pen) {
    // Drawn with the city's shore at 50, then set 4 higher.
    const g = moved(pen, 0, -4);
    // The mountain: Devil's Peak, the long flat table, Lion's Head.
    g.o("M0 38Q6 32 9 26L12.6 18Q14 15.2 15.4 15.6L17 18Q19.6 15.6 22 14L26 12.2Q34 11.2 44 11.6Q56 11 66 11.8L69.4 12.4Q71 18 72 24Q74.4 30 78 30.6Q82 30 84.4 26.4Q86.4 22.4 88.4 22.6Q90.4 23.4 91.6 27Q94 34 100 37");
    // The tablecloth pouring over its edge.
    g.d("M24 11.6Q34 8.2 46 9.2Q58 7.8 70 10.6");
    g.f("M30 11.6Q30.4 14 29.4 16.4M40 11.6Q40.6 14.6 39.6 17M52 11.4Q53 14.2 52 16.8M62 11.8Q62.6 14.4 61.8 16.4");
    // The cliffs' buttresses, the slopes below.
    let cliffs = "";
    for (const x of [28, 34.4, 41, 47.6, 54.4, 61, 66.6]) cliffs += D`M${x} ${12}Q${x - 0.8} ${18} ${x - 1.8} ${23.6}`;
    g.d(cliffs, "M9 26Q20 28 30 26Q46 28 60 26.4Q68 26 72 24", "M2 38Q24 32 42 34.6Q60 32 78 34Q90 35 100 37.6");
    // The city along the shore.
    let city = "";
    const hs = [3, 5, 4, 7, 3.6, 5.4, 9, 4.4, 6, 3.2, 5, 11, 7.4, 4, 6.4, 3.6, 5, 4.4, 3];
    hs.forEach((h, i) => {
      const x = 6 + i * 4.7;
      city += R(x, 46 - h, 3.4, h);
    });
    g.d(city);
    g.o(P(0, 46, 100, 46));
    g.d(wave(6, 50), wave(40, 51), wave(74, 50), wave(24, 54.4));
    g.f(P(56, 53.6, 64, 53.6), P(86, 54, 94, 54));
  },
};

const kilimanjaro: Drawing = {
  w: 100,
  h: 62,
  draw(g) {
    // The mountain: its long flat summit, the snow on it, Mawenzi's shoulder to the right.
    g.o("M0 46Q14 42 24 34Q32 27 38 21.4Q41 19 44 18.4L50 17.8Q56 17.4 60 18.6Q64 20 68 24Q74 30 80 32.4Q82 30.6 84 30.8Q86 31.4 88 34Q94 38 100 40");
    g.d(line([[38.6, 21], [40.4, 24.6], [42, 21.8], [43.8, 26.4], [45.4, 22.4], [47.4, 25.4], [49.6, 22], [51.4, 27], [53.6, 22.4], [55.6, 25.6], [57.6, 21.8], [60, 24.8], [62, 21.6], [65.4, 22.8]]));
    g.f("M44 19V23M48 18.2V22M52 17.9V22.6M56 18V22M60 18.8V22.4");
    g.d("M26 36Q30 38.6 34 38M68 30Q72 34 76 35", "M8 38Q14 35.6 20 37.4Q24 38.4 28 37");
    // The plain, left open where the acacia and the giraffe stand in front of it.
    g.d(gapped(50, 0, 100, [[22.4, 34], [70.6, 74.6]]));
    // An acacia, its flat crown.
    g.o("M73.4 62Q73.2 56 71.8 52Q71 49.4 68 46.8M72.6 55.4Q75.4 51.4 79.6 47.4M72 52.4Q72.8 49.4 74.6 46.8");
    g.o("M60.4 46.8Q60.6 43.6 66 42.4Q72 40.6 80 41.2Q87 41.4 90 44Q91 46.6 88 46.8Z");
    g.f("M64 44.6Q72 43.2 80 43.4Q84 43.6 87 45");
    // A giraffe.
    g.d("M24 51Q24 49 27 48.6Q31 48.4 33 49.8Q33.6 51.4 32.6 52H24.6Q24 52 24 51Z", "M31.6 49Q33.6 44 35.4 40.4M33 50Q35 45.6 36.6 41.4", "M35.2 40.4Q35.4 39 37 38.6L39.4 39.4Q39.6 40.4 38.6 40.6L36.6 41.4");
    g.d(P(25, 52, 24.8, 58) + P(26.6, 52, 26.8, 58) + P(31, 52, 31.2, 58) + P(32.4, 52, 32.8, 58));
    g.f("M36 39L35.8 37.6M36.8 38.8L36.8 37.4", "M24.2 50Q23 52 23.2 54");
    // The grass, a pair of birds, the ground.
    g.d(tuft(6, 62), tuft(16, 61.4), tuft(44, 62), tuft(56, 61.4), tuft(88, 62), tuft(96, 61.6), bird(20, 14, 1.8), bird(25, 11, 1.4));
    g.o(P(0, 62, 100, 62));
  },
};

/** A seated colossus at c: the double crown, the headcloth, the arms along the thighs, the legs; broken off at the waist when it's the fallen one. */
function colossus(g: Pen, c: number, broken = false) {
  const legs = P(c - 7.6, 60, c - 7.6, 44.6) + P(c - 1.1, 60, c - 1.1, 44.6) + P(c + 1.1, 60, c + 1.1, 44.6) + P(c + 7.6, 60, c + 7.6, 44.6);
  g.o(legs, P(c - 8.2, 44.6, c - 8.2, 40.4, c + 8.2, 40.4, c + 8.2, 44.6));
  g.d(P(c - 8.2, 44.6, c + 8.2, 44.6), P(c - 7.6, 57.6, c - 1.1, 57.6) + P(c + 1.1, 57.6, c + 7.6, 57.6));
  g.f(ring(c - 4.4, 42.6, 1.2), ring(c + 4.4, 42.6, 1.2), P(c - 4.4, 48, c - 4.4, 56) + P(c + 4.4, 48, c + 4.4, 56));
  if (broken) {
    g.o(line([[c - 6.6, 40.4], [c - 6.2, 33], [c - 3.6, 34.6], [c - 1, 31.6], [c + 2, 35], [c + 4.4, 33.2], [c + 6.2, 34.4], [c + 6.6, 40.4]]));
    g.f(P(c - 3, 36.6, c - 1.2, 38.6), P(c + 3.4, 36.4, c + 2, 38.4));
    return;
  }
  g.o(sym(D`M${c - 6.6} 40.4L${c - 6} 30Q${c - 6.4} 27.4 ${c - 8} 26L${c - 4.6} 24.4L${c - 5.2} 17.6Q${c - 4.4} 14.6 ${c - 3} 14V11Q${c - 2.2} 10.2 ${c - 2} 8Q${c - 1.6} 6 ${c} 6`, c));
  g.d(D`M${c - 8} 26Q${c - 8.8} 33 ${c - 7.8} 40.4M${c + 8} 26Q${c + 8.8} 33 ${c + 7.8} 40.4`, D`M${c - 3} 14.6Q${c - 3.2} 21 ${c} 22.6Q${c + 3.2} 21 ${c + 3} 14.6`, P(c - 3, 11, c + 3, 11), P(c - 0.7, 22.6, c - 0.7, 25.6, c + 0.7, 25.6, c + 0.7, 22.6));
  g.f(P(c - 1.8, 17.2, c - 0.7, 17.2) + P(c + 0.7, 17.2, c + 1.8, 17.2), P(c - 0.9, 20.4, c + 0.9, 20.4), D`M${c - 4} 29.4Q${c} 32 ${c + 4} 29.4`, P(c - 4.4, 24.6, c - 3.6, 30) + P(c + 4.4, 24.6, c + 3.6, 30));
}

const abusimbel: Drawing = {
  w: 100,
  h: 64,
  draw(g) {
    // The rock-cut front: its battered sides, the frieze of baboons along the top.
    g.o(P(2, 60, 8, 0.6, 92, 0.6, 98, 60));
    g.d(P(7.6, 4.6, 92.4, 4.6));
    let bab = "";
    for (let x = 10.4; x < 88.6; x += 3.2) bab += arch(x, 4.4, 1.8, 2.4);
    g.f(bab);
    // Four colossi, the second broken; the door between them, the falcon-headed god above it.
    colossus(g, 20);
    colossus(g, 38.4, true);
    colossus(g, 61.6);
    colossus(g, 80);
    g.o(P(46.6, 60, 46.6, 43, 53.4, 43, 53.4, 60));
    g.d(R(47, 30, 6, 10), P(46, 43, 54, 43));
    g.f(ring(50, 32.6, 1.2), P(50, 33.8, 50, 38.6), P(48.6, 36, 51.4, 36));
    // The sand in front.
    g.d(P(2, 60, 98, 60));
    g.f("M6 62.2Q14 61.2 22 62.2M60 62.4Q70 61.4 80 62.4");
    g.o(P(0, 64, 100, 64));
  },
};

const djenne: Drawing = {
  w: 100,
  h: 62,
  draw(g) {
    // The platform, the ground.
    g.o(P(0, 62, 100, 62), P(2, 62, 2, 56, 98, 56, 98, 62));
    // Three towers, tapering, each crowned with pinnacles and an egg.
    const towers = [{ c: 26, top: 15 }, { c: 50, top: 8.6 }, { c: 74, top: 15 }];
    let toron = "";
    for (const { c, top } of towers) {
      g.o(P(c - 6, 56, c - 5, top) + P(c + 6, 56, c + 5, top), P(c - 5, top, c + 5, top));
      g.o(sym(D`M${c - 5} ${top}Q${c - 4.6} ${top - 2.6} ${c - 3.7} ${top - 3.2}Q${c - 2.8} ${top - 2.6} ${c - 2.4} ${top}M${c - 2.4} ${top}Q${c - 2} ${top - 4.4} ${c} ${top - 6.4}`, c));
      g.dot(c, top - 7.3, 0.9);
      g.d(garch(c - 2, 56, 4, 50.6, 3), P(c - 5.6, 40, c + 5.6, 40));
      for (let y = top + 4; y < 52; y += 5.2) for (const x of [c - 3.6, c, c + 3.6]) toron += P(x - 0.6, y, x + 0.6, y);
    }
    // The wall between: its buttresses and their pinnacles, the parapet.
    const gaps: [number, number][] = towers.map(({ c }) => [c - 6.4, c + 6.4]);
    g.o(P(8, 56, 8, 28) + P(92, 56, 92, 28), gapped(28, 8, 92, gaps));
    let cones = "", butt = "";
    for (let x = 8; x < 90.5; x += 4.2) {
      if (gaps.some(([a, b]) => x + 3.2 > a && x < b)) continue;
      cones += D`M${x} ${28}Q${x + 0.4} ${24.8} ${x + 1.6} ${23.8}Q${x + 2.8} ${24.8} ${x + 3.2} ${28}`;
      butt += P(x + 0.6, 28, x + 0.3, 55.6) + P(x + 2.6, 28, x + 2.9, 55.6);
      for (let y = 32; y < 52; y += 5.2) toron += P(x + 1, y, x + 2.2, y);
    }
    g.o(cones);
    g.d(butt);
    g.f(toron, P(2, 59, 98, 59));
  },
};

const uluru: Drawing = {
  w: 100,
  h: 48,
  draw(g) {
    // The rock: steep ends, the long rounded back; its gullies and caves.
    g.o("M4 40Q6 33 10 27Q14 21 20 17.6Q28 13.4 40 12.6Q54 11.8 68 12.8Q80 13.8 86 19Q91 24 93 30Q95 35 96 40");
    g.d("M14 24Q30 17 50 16.6Q72 16 86 22", "M22 18Q20.6 26 22.6 34M36 14Q34.6 23 36 31M58 13.4Q57 22 58.6 30M76 15.4Q77.4 23 76 31");
    let streaks = "";
    for (const x of [16, 28, 42, 48, 64, 70, 82, 88]) streaks += D`M${x} ${x < 20 || x > 85 ? 26 : 18}Q${x - 0.8} ${28} ${x + 0.4} ${36}`;
    g.f(streaks);
    g.d("M28 40Q30 36.6 33.4 40M52 40Q53.6 37.4 56 40M72 40Q74 37 77 40");
    // The plain: scrub, desert oaks; the sun.
    g.o(P(0, 40, 100, 40));
    g.d(tree(3.8, 45, 4.4), tree(95, 44.6, 5), tree(88.4, 46, 3.2));
    g.d(tuft(10, 44.4), tuft(20, 46), tuft(34, 45), tuft(48, 46.4), tuft(62, 45), tuft(76, 46.4));
    g.d(ring(90, 7.6, 4.2), bird(14, 8, 1.8), bird(19, 5.6, 1.4));
    g.f(P(8, 43, 16, 43) + P(40, 43.4, 52, 43.4) + P(66, 43, 78, 43));
    g.o(P(0, 48, 100, 48));
  },
};

const harbour: Drawing = {
  w: 100,
  h: 52,
  draw(g) {
    const deck = 30;
    // The granite pylons at either end, the deck through them.
    const pylon = (x: number) => {
      g.o(P(x, 44, x, 12, x + 11, 12, x + 11, 44), P(x + 1, 12, x + 1, 9.4, x + 10, 9.4, x + 10, 12));
      g.d(P(x - 0.6, 12, x + 11.6, 12), garch(x + 3.4, 26.4, 4.2, 20, 2.6));
      g.f(P(x, 16, x + 11, 16) + P(x, 36, x + 11, 36) + P(x, 40, x + 11, 40));
    };
    pylon(6);
    pylon(83);
    g.o(P(0, deck, 6, deck) + P(17, deck, 83, deck) + P(94, deck, 100, deck));
    g.d(P(0, deck + 2.6, 6, deck + 2.6) + P(17, deck + 2.6, 83, deck + 2.6) + P(94, deck + 2.6, 100, deck + 2.6));
    // The arch: its two chords, the truss between them, the hangers down to the deck and the posts up to it.
    const top: [Pt, Pt, Pt] = [[17.2, 33], [50, -10], [82.8, 33]];
    const bot: [Pt, Pt, Pt] = [[17.2, 43], [50, 4], [82.8, 43]];
    g.o(line(qPts(...top)), line(qPts(...bot)));
    const n = 20;
    const tp = qPts(...top, n), bp = qPts(...bot, n);
    let truss = "", zig = "";
    for (let i = 1; i < n; i++) truss += line([tp[i], bp[i]]);
    for (let i = 0; i < n; i++) zig += line(i % 2 ? [tp[i], bp[i + 1]] : [bp[i], tp[i + 1]]);
    g.d(truss);
    g.f(zig);
    let hang = "";
    for (let x = 21; x < 80; x += 3.3) {
      const yb = yOn(qPts(...bot, 48), x);
      if (Math.abs(yb - deck) > 1.4) hang += yb < deck ? P(x, yb, x, deck) : P(x, deck + 2.6, x, yb);
    }
    g.f(hang);
    // The harbour.
    g.o(P(0, 44, 100, 44));
    g.d(wave(6, 47.4), wave(40, 48.4), wave(76, 47.4), wave(24, 50.8), wave(60, 50.8));
  },
};

/** A moai at c, H tall and W wide on the platform's top yb; a red topknot on some. */
function moaiAt(g: Pen, c: number, yb: number, H: number, W: number, topknot: boolean) {
  const hw = W / 2;
  g.o(sym(D`M${c} ${yb}H${c - hw * 0.92}V${yb - H * 0.4}Q${c - hw * 0.92} ${yb - H * 0.48} ${c - hw * 0.78} ${yb - H * 0.52}L${c - hw * 0.84} ${yb - H * 0.9}Q${c - hw * 0.84} ${yb - H} ${c - hw * 0.5} ${yb - H}H${c}`, c));
  g.d(sym(P(c - hw * 0.84, yb - H * 0.82, c - hw * 0.66, yb - H * 0.8, c - hw * 0.66, yb - H * 0.6, c - hw * 0.78, yb - H * 0.56), c));
  g.d(D`M${c - hw * 0.62} ${yb - H * 0.78}Q${c} ${yb - H * 0.84} ${c + hw * 0.62} ${yb - H * 0.78}`);
  g.d(D`M${c - hw * 0.1} ${yb - H * 0.79}L${c - hw * 0.26} ${yb - H * 0.64}Q${c} ${yb - H * 0.61} ${c + hw * 0.26} ${yb - H * 0.64}L${c + hw * 0.1} ${yb - H * 0.79}`);
  g.d(D`M${c - hw * 0.34} ${yb - H * 0.575}Q${c} ${yb - H * 0.555} ${c + hw * 0.34} ${yb - H * 0.575}`);
  g.f(sym(D`M${c - hw * 0.52} ${yb - H * 0.755}Q${c - hw * 0.32} ${yb - H * 0.725} ${c - hw * 0.14} ${yb - H * 0.755}`, c), D`M${c - hw * 0.46} ${yb - H * 0.515}Q${c} ${yb - H * 0.48} ${c + hw * 0.46} ${yb - H * 0.515}`);
  g.f(sym(D`M${c - hw * 0.88} ${yb - H * 0.36}Q${c - hw * 0.76} ${yb - H * 0.12} ${c - hw * 0.14} ${yb - H * 0.1}`, c));
  if (topknot) {
    const k = H * 0.13;
    g.o(D`M${c - hw * 0.5} ${yb - H}Q${c - hw * 0.54} ${yb - H - k} ${c} ${yb - H - k}Q${c + hw * 0.54} ${yb - H - k} ${c + hw * 0.5} ${yb - H}`);
    g.f(D`M${c - hw * 0.5} ${yb - H - k * 0.45}Q${c} ${yb - H - k * 0.3} ${c + hw * 0.5} ${yb - H - k * 0.45}`);
  }
}

const moai: Drawing = {
  w: 100,
  h: 64,
  draw(g) {
    const yb = 48;
    const figs: [number, number, number, boolean][] = [[12, 34, 13, false], [30.4, 40, 14.4, true], [50, 43, 15.4, false], [69.6, 38, 14, false], [88, 33, 12.6, true]];
    // The sea behind, its horizon left open behind each head.
    const hy = 24;
    const gaps = figs.map(([c, H, W, k]): [number, number] => (yb - H - (k ? H * 0.13 : 0) < hy ? [c - W * 0.46, c + W * 0.46] : [c, c]));
    g.d(gapped(hy, 0, 100, gaps));
    g.f(P(2, 29, 6, 29), P(40, 30, 43, 30), P(58, 29.4, 62, 29.4), P(78, 30, 81, 30), P(96, 29, 99.4, 29));
    for (const [c, H, W, k] of figs) moaiAt(g, c, yb, H, W, k);
    // The ahu: its fitted stones; the grass in front.
    g.o(P(1, 56, 1, yb, 99, yb, 99, 56));
    let joints = P(1, 52, 99, 52);
    for (let x = 7; x < 98; x += 8.6) joints += P(x, yb, x, 52) + P(x + 4.3, 52, x + 4.3, 56);
    g.f(joints);
    g.o(P(0, 64, 100, 64), P(0, 56, 100, 56));
    g.d(tuft(4, 64), tuft(16, 63.4), tuft(30, 64), tuft(46, 63.4), tuft(62, 64), tuft(78, 63.4), tuft(94, 64));
    g.d(bird(22, 8, 1.8), bird(27, 5.4, 1.4));
  },
};

/** The second set, by id. */
export const MORE_DRAWINGS = { arc, stbasils, stonehenge, atomium, stpeters, hagiasophia, matterhorn, kinderdijk, chichenitza, spaceneedle, cntower, chrysler, gatewayarch, petronas, heaven, kinkakuji, itsukushima, marinabay, taipei101, table, kilimanjaro, abusimbel, djenne, uluru, harbour, moai } satisfies Partial<Record<Landmark, Drawing>>;
