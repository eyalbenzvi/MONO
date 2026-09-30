/**
 * Reiter's snow crystal model (C. A. Reiter, "A local cellular model for
 * snow crystal growth", Chaos, Solitons & Fractals 23, 2005): a hexagonal
 * grid of cells, each holding some water s. A cell is frozen at s ≥ 1;
 * frozen cells and their neighbours are receptive: they keep what they hold
 * and gain γ each step (vapour settling), while the water of every other
 * cell diffuses (its share α/2 evened with its six neighbours). The far
 * field is held at β. Everything starts at β, one frozen cell in the middle.
 *
 * The model is symmetric under the hexagon's twelve symmetries, so only one
 * cell of each orbit is computed (a twelfth of the grid, each neighbour read
 * through its orbit's representative): exactly six-fold, twelve times
 * faster. The far field follows the crystal (held at β a few cells beyond
 * its tip), so early steps cost little.
 */

export interface Crystal {
  /** Grid radius (cells from the centre to the edge). */
  n: number;
  /** Water per cell, axial (q, r) at index (r + n) * (2n + 1) + (q + n); cells off the hexagon unused. */
  s: Float64Array;
  /** Frozen cells' farthest distance from the centre (in cells), and the steps taken. */
  radius: number;
  steps: number;
}

const hexDist = (q: number, r: number) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;

interface Grid {
  n: number;
  side: number;
  /** Each orbit's representative, per cell (−1 off the hexagon). */
  canon: Int32Array;
  reps: Int32Array;
  /** Representatives' six neighbours' representatives (−1 beyond the edge). */
  nb: Int32Array;
  dist: Uint16Array;
}
const grids = new Map<number, Grid>();

function grid(n: number): Grid {
  const hit = grids.get(n);
  if (hit) return hit;
  const side = 2 * n + 1;
  const idx = (q: number, r: number) => (r + n) * side + (q + n);
  const canon = new Int32Array(side * side).fill(-1);
  const dist = new Uint16Array(side * side);
  for (let r = -n; r <= n; r++)
    for (let q = -n; q <= n; q++) {
      if (hexDist(q, r) > n) continue;
      dist[idx(q, r)] = hexDist(q, r);
      // The twelve images in cube coordinates (x, y, z) = (q, −q−r, r): six rotations, each mirrored.
      let [x, y, z] = [q, -q - r, r];
      let best = Infinity;
      for (let k = 0; k < 6; k++) {
        [x, y, z] = [-z, -x, -y];
        for (const [a, c] of [[x, z], [y, z]]) {
          // (q, r) = (a, c) and its mirror (x↔y swaps q with −q−r).
          const i = idx(a, c);
          if (i < best) best = i;
        }
      }
      canon[idx(q, r)] = best;
    }
  const reps: number[] = [];
  for (let i = 0; i < canon.length; i++) if (canon[i] === i) reps.push(i);
  const nb = new Int32Array(reps.length * 6);
  const D: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  reps.forEach((i, k) => {
    const q = (i % side) - n, r = Math.floor(i / side) - n;
    D.forEach(([dq, dr], j) => {
      const [a, b] = [q + dq, r + dr];
      nb[k * 6 + j] = Math.abs(a) <= n && Math.abs(b) <= n && hexDist(a, b) <= n ? canon[idx(a, b)] : -1;
    });
  });
  const g = { n, side, canon, reps: Int32Array.from(reps), nb, dist };
  grids.set(n, g);
  return g;
}

/**
 * Grows a crystal until its tip is `margin` cells from the grid's edge (or
 * `maxSteps`). Deterministic: the same numbers give the same crystal.
 */
export function growCrystal(alpha: number, beta: number, gamma: number, n: number, maxSteps = 20000, margin = 3, plate = 0): Crystal {
  const g = grid(n);
  const { reps, nb, dist, canon } = g;
  const cells = canon.length;
  let s = new Float64Array(cells).fill(beta);
  let next = new Float64Array(cells).fill(beta);
  const centre = n * g.side + n;
  const u = new Float64Array(cells).fill(beta);
  const frozen = new Uint8Array(cells);
  // The seed: one frozen cell, or a hexagonal plate of that radius (its corners where the arms will grow).
  for (let i = 0; i < cells; i++)
    if (canon[i] >= 0 && (i === centre || dist[i] <= plate)) {
      s[i] = 1;
      frozen[i] = 1;
    }
  let radius = plate;
  let steps = 0;
  const FAR = 8;
  for (; steps < maxSteps && radius < n - margin; steps++) {
    const reach = Math.min(n, radius + FAR);
    // Receptive cells keep their water (and gain γ); the rest diffuse.
    for (let k = 0; k < reps.length; k++) {
      const i = reps[k];
      if (dist[i] > reach) continue;
      let rec = frozen[i] === 1;
      for (let j = 0; j < 6 && !rec; j++) {
        const m = nb[k * 6 + j];
        if (m >= 0 && frozen[m]) rec = true;
      }
      u[i] = rec ? 0 : s[i];
      next[i] = rec ? s[i] + gamma : 0;
    }
    for (let k = 0; k < reps.length; k++) {
      const i = reps[k];
      if (dist[i] > reach) continue;
      if (dist[i] === reach) {
        // The far field.
        next[i] = beta;
        continue;
      }
      let sum = 0;
      for (let j = 0; j < 6; j++) {
        const m = nb[k * 6 + j];
        sum += m >= 0 ? u[m] : beta;
      }
      next[i] += u[i] + (alpha / 2) * (sum / 6 - u[i]);
    }
    [s, next] = [next, s];
    for (let k = 0; k < reps.length; k++) {
      const i = reps[k];
      if (dist[i] > reach) continue;
      if (!frozen[i] && s[i] >= 1) {
        frozen[i] = 1;
        if (dist[i] > radius) radius = dist[i];
      }
    }
    // Cells just beyond the reach keep β (their u) for the next step's reach.
  }
  // Every cell takes its orbit's value.
  const out = new Float64Array(cells);
  for (let i = 0; i < cells; i++) out[i] = canon[i] >= 0 ? s[canon[i]] : 0;
  return { n, s: out, radius, steps };
}

/**
 * How broad an arm stays toward its tip: the envelope's half-width (the
 * farthest ice from the arm's axis, along the ring of cells) at 70% and 80%
 * of the crystal's radius, as a share of that distance. A leaf-shaped arm
 * (narrow, tapering to a point long before the tip) scores low; a sectored
 * plate, a branched fern or a hexagon high.
 */
export function armWidths(c: Crystal): [number, number] {
  const { n, s } = c;
  const side = 2 * n + 1;
  const ice = (q: number, r: number) => s[(r + n) * side + (q + n)] >= 1;
  const half = (d: number) => {
    let m = -1;
    for (let t = 0; t <= d / 2; t++) if (ice(d, -t) || ice(d - t, t)) m = t;
    return m / d;
  };
  return [half(Math.round(0.7 * c.radius)), half(Math.round(0.8 * c.radius))];
}
/** Broad enough to read as a snowflake, never as a leaf. */
export const ARM_MIN: [number, number] = [0.22, 0.18];
export const broadArms = (c: Crystal) => {
  const [a, b] = armWidths(c);
  return a >= ARM_MIN[0] && b >= ARM_MIN[1];
};
