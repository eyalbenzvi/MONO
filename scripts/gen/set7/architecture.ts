/**
 * Architecture (Part 3, the Minimalist): measured drawings of real building
 * rules — arch constructions struck with the compass, brick bonds in true
 * brick proportions (215 × 102.5 × 65 mm, 10 mm joints), the standard truss
 * types, Vignola's five orders in their module proportions, Le Corbusier's
 * Modulor series (183 cm and 226 cm, stepped by the golden ratio).
 */
import { DEG, INK, caption, circle, dot, f1, line, path, polyline, rect, text, type Set7Design } from "./kit";

const FEAT = { architectural: 0.9, geometric: 0.65, line_art: 0.75, clean_minimal: 0.6, classic: 0.5, abstract: 0.2, density: 0.25, contrast: 0.7, typography: 0.15 };

/* ------------------------------------------------------------------ */
/* Arches                                                               */
/* ------------------------------------------------------------------ */

interface Arc {
  cx: number;
  cy: number;
  r: number;
  a0: number;
  a1: number;
}

/** An arch drawn as a mason's elevation: intrados, extrados, radial joints, the compass centres. */
function archDrawing(arcs: Arc[], spring: number, x0: number, x1: number, depth: number): string {
  let s = "";
  const at = (a: Arc, r: number, t: number): [number, number] => [a.cx + r * Math.cos(t), a.cy - r * Math.sin(t)];
  const trace = (r: (a: Arc) => number) => {
    const pts: [number, number][] = [];
    for (const a of arcs) for (let k = 0; k <= 40; k++) pts.push(at(a, r(a), a.a0 + ((a.a1 - a.a0) * k) / 40));
    return pts;
  };
  s += path(polyline(trace((a) => a.r)), 2);
  s += path(polyline(trace((a) => a.r + depth)), 1.2);
  // Radial joints, about every 8° of each arc.
  for (const a of arcs) {
    const n = Math.max(2, Math.round(Math.abs(a.a1 - a.a0) / (8 * DEG)));
    for (let k = 0; k <= n; k++) {
      const t = a.a0 + ((a.a1 - a.a0) * k) / n;
      const [xa, ya] = at(a, a.r, t), [xb, yb] = at(a, a.r + depth, t);
      s += line(xa, ya, xb, yb, 0.8);
    }
  }
  // Jambs, springing line, compass centres and their construction lines.
  s += line(x0, spring, x0, spring + 70, 2) + line(x1, spring, x1, spring + 70, 2);
  s += line(x0 - depth, spring, x0 - depth, spring + 70, 1.2) + line(x1 + depth, spring, x1 + depth, spring + 70, 1.2);
  s += `<line x1="${f1(x0 - 30)}" y1="${f1(spring)}" x2="${f1(x1 + 30)}" y2="${f1(spring)}" stroke="${INK}" stroke-width=".6" stroke-dasharray="3 3"/>`;
  for (const a of arcs) {
    s += dot(a.cx, a.cy, 1.8);
    const [xe, ye] = at(a, a.r, (a.a0 + a.a1) / 2);
    s += `<line x1="${f1(a.cx)}" y1="${f1(a.cy)}" x2="${f1(xe)}" y2="${f1(ye)}" stroke="${INK}" stroke-width=".5" stroke-dasharray="2 2.5"/>`;
  }
  return s;
}

function archDesigns(): Set7Design[] {
  const x0 = 75, x1 = 225, w = x1 - x0, mid = 150, spring = 220, depth = 16;
  const list: [string, string, string, Arc[]][] = [
    ["Semicircular Arch", "One arc struck from the middle of the span", "semicircular", [{ cx: mid, cy: spring, r: w / 2, a0: Math.PI, a1: 0 }]],
    [
      "Equilateral Arch",
      "Two arcs struck from the springing points, radius equal to the span",
      "equilateral",
      [
        { cx: x1, cy: spring, r: w, a0: Math.PI, a1: (2 * Math.PI) / 3 },
        { cx: x0, cy: spring, r: w, a0: Math.PI / 3, a1: 0 },
      ],
    ],
    (() => {
      const r = w * 1.4, c = r - w / 2, top = Math.acos(c / r);
      return ["Lancet Arch", "Two arcs, radius longer than the span, centres outside it", "lancet", [
        { cx: mid + c, cy: spring, r, a0: Math.PI, a1: Math.PI - top },
        { cx: mid - c, cy: spring, r, a0: top, a1: 0 },
      ]] as [string, string, string, Arc[]];
    })(),
    (() => {
      const r = w * 0.7, c = r - w / 2, top = Math.acos(c / r);
      return ["Drop Arch", "Two arcs, radius shorter than the span, centres inside it", "drop", [
        { cx: mid + c, cy: spring, r, a0: Math.PI, a1: Math.PI - top },
        { cx: mid - c, cy: spring, r, a0: top, a1: 0 },
      ]] as [string, string, string, Arc[]];
    })(),
    (() => {
      const r = w / 2 / Math.cos(25 * DEG), cy = spring - r * Math.sin(25 * DEG);
      return ["Horseshoe Arch", "One arc carried past the half circle, centre above the springing", "horseshoe", [{ cx: mid, cy, r, a0: Math.PI + 25 * DEG, a1: -25 * DEG }]] as [string, string, string, Arc[]];
    })(),
    (() => {
      const r = w * 0.8, cy = spring + Math.sqrt(r * r - (w / 2) ** 2), t = Math.asin((cy - spring) / r);
      return ["Segmental Arch", "Less than a half circle, centre below the springing", "segmental", [{ cx: mid, cy, r, a0: Math.PI - t, a1: t }]] as [string, string, string, Arc[]];
    })(),
  ];
  return list.map(([title, how, key, arcs]) => {
    const jx0 = key === "horseshoe" ? arcs[0].cx - arcs[0].r * Math.cos(25 * DEG) : x0;
    const jx1 = key === "horseshoe" ? arcs[0].cx + arcs[0].r * Math.cos(25 * DEG) : x1;
    const body = archDrawing(arcs, spring, jx0, jx1, depth) + caption(330, title, how);
    return {
      body,
      variant: "arch",
      category: "architecture" as const,
      title,
      subject: `${title} Construction`,
      description: `The ${title.toLowerCase()} set out as a mason draws it: ${how.charAt(0).toLowerCase() + how.slice(1)}, the voussoir joints radiating from the compass centres, marked with the construction lines.`,
      features: FEAT,
      sigKey: `arch-${key}`,
    };
  });
}

/** A convex polygon cut to an axis-aligned box (Sutherland–Hodgman). */
function clipToBox(poly: [number, number][], x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const edges: [(p: [number, number]) => boolean, (a: [number, number], b: [number, number]) => [number, number]][] = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ];
  let out = poly;
  for (const [inside, cross] of edges) {
    const input = out;
    out = [];
    input.forEach((p, i) => {
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(p)) {
        if (!inside(prev)) out.push(cross(prev, p));
        out.push(p);
      } else if (inside(prev)) out.push(cross(prev, p));
    });
    if (!out.length) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Brick bonds                                                          */
/* ------------------------------------------------------------------ */

function bondDesigns(): Set7Design[] {
  // Units: 1 = 1 mm at 0.3 scale. Stretcher 225 (with joint), header 112.5, course 75.
  const S = 0.3, L = 225 * S, Hd = 112.5 * S, C = 75 * S, J = 10 * S;
  const X0 = 30, Y0 = 36, WW = 240, HH = 240;
  const clip = (id: string) => `<clipPath id="${id}"><rect x="${X0}" y="${Y0}" width="${WW}" height="${HH}"/></clipPath>`;
  const brick = (x: number, y: number, w: number) => rect(x, y, w - J, C - J, 0.9);
  const course = (y: number, units: number[], offset: number) => {
    let s = "", x = X0 - offset;
    let i = 0;
    while (x < X0 + WW) {
      const w = units[i++ % units.length];
      s += brick(x, y, w);
      x += w;
    }
    return s;
  };
  const courses = (fn: (row: number, y: number) => string) => {
    let s = "";
    for (let row = 0, y = Y0; y < Y0 + HH; row++, y += C) s += fn(row, y);
    return s;
  };
  const bonds: [string, string, string, string][] = [
    ["Stretcher Bond", "Every course stretchers, each over the joint below", "stretcher", courses((r, y) => course(y, [L], r % 2 ? L / 2 : 0))],
    ["English Bond", "A course of stretchers, a course of headers", "english", courses((r, y) => (r % 2 ? course(y, [Hd], Hd / 2) : course(y, [L], 0)))],
    ["Flemish Bond", "Header and stretcher in every course, headers centred over stretchers", "flemish", courses((r, y) => course(y, [Hd, L], r % 2 ? Hd / 2 + L / 2 : 0))],
    ["Header Bond", "Every course headers, each over the joint below", "header", courses((r, y) => course(y, [Hd], r % 2 ? Hd / 2 : 0))],
    (() => {
      // Herringbone (2:1 bricks): along each diagonal a flat brick, then an upright one beside it; the strips repeat
      // every four units. Turned 45° and cut to the panel exactly (each brick's outline clipped), so no line leaves it.
      const u = Hd;
      const turn = ([x, y]: [number, number]): [number, number] => {
        const [dx, dy] = [x - 150, y - 156];
        return [150 + (dx - dy) * Math.SQRT1_2, 156 + (dx + dy) * Math.SQRT1_2];
      };
      const brickAt = (x: number, y: number, w: number, h: number) => {
        const poly = clipToBox([turn([x, y]), turn([x + w, y]), turn([x + w, y + h]), turn([x, y + h])], X0, Y0, X0 + WW, Y0 + HH);
        return poly.length >= 3 ? path(polyline(poly, true), 0.9) : "";
      };
      let s = "";
      for (let m = -8; m <= 8; m++)
        for (let k = -14; k <= 14; k++) {
          const ox = 150 + (k + 4 * m) * u, oy = 156 + k * u;
          // Only bricks that can reach the panel (turning keeps the distance to the centre).
          if (Math.hypot(ox + u - 150, oy + u / 2 - 156) > 190) continue;
          s += brickAt(ox, oy, 2 * u - J, u - J) + brickAt(ox + 2 * u, oy - u, u - J, 2 * u - J);
        }
      return ["Herringbone Bond", "Stretchers laid at right angles, zigzagging", "herringbone", s] as [string, string, string, string];
    })(),
  ];
  return bonds.map(([title, how, key, bricks]) => {
    const id = `c${key}`;
    const body = `<defs>${clip(id)}</defs><g clip-path="url(#${id})">${bricks}</g>` + rect(X0, Y0, WW, HH, 1.4) + caption(310, title, how, "Brick 215 × 102.5 × 65 mm · 10 mm joints");
    return {
      body,
      variant: "brick-bond",
      category: "architecture" as const,
      title,
      subject: `${title} Brickwork`,
      description: `A panel of ${title.toLowerCase()} in true brick proportions: ${how.charAt(0).toLowerCase() + how.slice(1)}.`,
      features: { ...FEAT, geometric: 0.8, density: 0.5 },
      sigKey: `bond-${key}`,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Trusses                                                              */
/* ------------------------------------------------------------------ */

function trussDesigns(): Set7Design[] {
  const X0 = 30, X1 = 270, N = 8, dx = (X1 - X0) / N;
  const joints = (pts: [number, number][]) => pts.map(([x, y]) => circle(x, y, 2.2, 1)).join("");
  const member = (a: [number, number], b: [number, number]) => line(a[0], a[1], b[0], b[1], 2);
  const flat = (diag: (i: number) => [[number, number], [number, number]][], verticals: boolean) => {
    const top = 130, bot = 200;
    let s = member([X0, bot], [X1, bot]) + member([X0, top], [X1, top]) + member([X0, top], [X0, bot]) + member([X1, top], [X1, bot]);
    const pts: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const x = X0 + i * dx;
      pts.push([x, top], [x, bot]);
      if (verticals && i > 0 && i < N) s += member([x, top], [x, bot]);
    }
    for (let i = 0; i < N; i++) for (const [a, b] of diag(i)) s += member(a, b);
    s += `<path d="M${X0 - 6} ${bot + 4}L${X0} ${bot}L${X0 + 6} ${bot + 4}Z" fill="none" stroke="${INK}" stroke-width="1.2"/><circle cx="${X1}" cy="${bot + 5}" r="3" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
    return s + joints(pts);
  };
  const T = 130, B = 200;
  const xs = (i: number) => X0 + i * dx;
  const roof = (members: [[number, number], [number, number]][]) => {
    const apex: [number, number] = [150, 90], l: [number, number] = [X0, 210], r: [number, number] = [X1, 210];
    let s = member(l, apex) + member(apex, r) + member(l, r);
    const pts = new Set<string>([l, apex, r].map((p) => p.join()));
    for (const [a, b] of members) {
      s += member(a, b);
      pts.add(a.join());
      pts.add(b.join());
    }
    return s + joints([...pts].map((p) => p.split(",").map(Number) as [number, number]));
  };
  const onRafter = (t: number, right = false): [number, number] => (right ? [150 + (X1 - 150) * t, 90 + 120 * t] : [150 - (150 - X0) * t, 90 + 120 * t]);
  const list: [string, string, string, string][] = [
    ["Pratt Truss", "Diagonals slope to the middle: in tension, the verticals in compression", "pratt", flat((i) => (i < N / 2 ? [[[xs(i), T], [xs(i + 1), B]]] : [[[xs(i + 1), T], [xs(i), B]]]), true)],
    ["Howe Truss", "Diagonals slope away from the middle: in compression, the verticals in tension", "howe", flat((i) => (i < N / 2 ? [[[xs(i), B], [xs(i + 1), T]]] : [[[xs(i + 1), B], [xs(i), T]]]), true)],
    ["Warren Truss", "Equal triangles, diagonals alternately in tension and compression", "warren", flat((i) => [[[xs(i), i % 2 ? T : B], [xs(i + 1), i % 2 ? B : T]]], false)],
    ["King Post Truss", "One post from the apex to the tie beam, two struts", "kingpost", roof([[[150, 90], [150, 210]], [[150, 210], onRafter(0.5)], [[150, 210], onRafter(0.5, true)]])],
    ["Queen Post Truss", "Two posts and a straining beam between them", "queenpost", roof([[onRafter(0.4), [150 - (150 - X0) * 0.4, 210]], [onRafter(0.4, true), [150 + (X1 - 150) * 0.4, 210]], [onRafter(0.4), onRafter(0.4, true)], [[150 - (150 - X0) * 0.4, 210], onRafter(0.72)], [[150 + (X1 - 150) * 0.4, 210], onRafter(0.72, true)]])],
    ["Fink Truss", "Struts in a W, the common roof truss", "fink", roof([[[150, 90], [150 - (150 - X0) * 0.33, 210]], [[150, 90], [150 + (X1 - 150) * 0.33, 210]], [[150 - (150 - X0) * 0.33, 210], onRafter(0.5)], [[150 + (X1 - 150) * 0.33, 210], onRafter(0.5, true)]])],
  ];
  return list.map(([title, how, key, body]) => ({
    body: body + caption(300, title, how),
    variant: "truss",
    category: "architecture" as const,
    title,
    subject: `${title} Diagram`,
    description: `The ${title.toLowerCase()} as an engineer's line diagram, joints ringed: ${how.charAt(0).toLowerCase() + how.slice(1)}.`,
    features: { ...FEAT, dark_industrial: 0.35, retro: 0.2 },
    sigKey: `truss-${key}`,
  }));
}

/* ------------------------------------------------------------------ */
/* The five orders; the Modulor                                          */
/* ------------------------------------------------------------------ */

function ordersDesign(): Set7Design {
  // Vignola: column height in lower diameters (D), entablature a quarter of the column.
  const orders: [string, number][] = [["Tuscan", 7], ["Doric", 8], ["Ionic", 9], ["Corinthian", 10], ["Composite", 10]];
  const base = 262;
  const D = 19; // one lower diameter, px
  let s = line(18, base, 282, base, 1.2);
  orders.forEach(([name, h], i) => {
    const cx = 42 + i * 54;
    const colH = h * D, top = base - colH;
    const leafy = name === "Corinthian" || name === "Composite";
    const capH = leafy ? D * (7 / 6) : name === "Ionic" ? D / 3 : D / 2;
    const topW = D * (5 / 6);
    // Base: plinth and torus, half a diameter.
    s += rect(cx - D * 0.66, base - D / 4, D * 1.32, D / 4, 1) + rect(cx - D * 0.58, base - D / 2, D * 1.16, D / 4, 1);
    // Shaft: straight for its lower third, tapering to 5/6 D.
    const shaftBot = base - D / 2, shaftTop = top + capH, third = shaftBot - (shaftBot - shaftTop) / 3;
    s += path(polyline([[cx - D / 2, shaftBot], [cx - D / 2, third], [cx - topW / 2, shaftTop]]), 1.2) + path(polyline([[cx + D / 2, shaftBot], [cx + D / 2, third], [cx + topW / 2, shaftTop]]), 1.2);
    // Capital: bell or echinus up to the abacus.
    const abH = Math.min(D / 4, capH * 0.35);
    s += path(polyline([[cx - topW / 2, shaftTop], [cx - D * 0.62, top + abH], [cx + D * 0.62, top + abH], [cx + topW / 2, shaftTop]], true), 1) + rect(cx - D * 0.68, top, D * 1.36, abH, 1);
    if (name === "Ionic" || name === "Composite") s += circle(cx - D * 0.62, top + abH + D * 0.17, D * 0.17, 0.9) + circle(cx + D * 0.62, top + abH + D * 0.17, D * 0.17, 0.9);
    if (leafy) for (let k = 0; k < 3; k++) s += path(`M${f1(cx - topW / 2 + (k * topW) / 3)} ${f1(shaftTop)}q${f1(topW / 6)} ${f1(-capH * 0.55)} ${f1(topW / 3)} 0`, 0.8);
    // Entablature, a quarter of the column: architrave, frieze, cornice.
    const e = colH / 4;
    s += rect(cx - D * 0.62, top - e * 0.3, D * 1.24, e * 0.3, 1) + rect(cx - D * 0.62, top - e * 0.65, D * 1.24, e * 0.35, 0.8) + rect(cx - D * 0.85, top - e, D * 1.7, e * 0.35, 1);
    s += text(cx, base + 12, name.toUpperCase(), 5.5, { bold: true }) + text(cx, base + 21, `${h} D`, 5.5);
  });
  return {
    body: s + caption(318, "The Five Orders", "After Vignola: column heights in lower diameters", "Entablature a quarter of the column"),
    variant: "orders",
    category: "architecture",
    title: "The Five Orders after Vignola",
    subject: "Classical Orders of Architecture",
    description: "Tuscan, Doric, Ionic, Corinthian and Composite side by side in Vignola's proportions: columns of 7, 8, 9 and 10 lower diameters, each carrying an entablature a quarter of its height.",
    features: { ...FEAT, classic: 0.85 },
    sigKey: "orders",
  };
}

function modulorDesign(): Set7Design {
  const phi = (1 + Math.sqrt(5)) / 2;
  const red = [-5, -4, -3, -2, -1, 0, 1].map((k) => 183 * phi ** k);
  const blue = [-5, -4, -3, -2, -1, 0].map((k) => 226 * phi ** k);
  const base = 280, scale = 232 / 296;
  let s = line(40, base, 260, base, 1.2);
  const ladder = (vals: number[], x: number, label: string) => {
    let t = "";
    let y = base;
    for (const v of vals.filter((v) => v > 9)) {
      const h = v * scale;
      t += line(x - 26, base - h, x + 26, base - h, 1) + text(x + (label === "RED" ? -31 : 31), base - h + 2, String(Math.round(v)), 6, { anchor: label === "RED" ? "end" : "start" });
      void y;
    }
    t += line(x, base, x, base - Math.max(...vals) * scale, 1.6);
    t += text(x, base + 12, label, 6.5, { bold: true, spacing: 1.5 });
    return t;
  };
  s += ladder(red, 115, "RED") + ladder(blue, 185, "BLUE");
  // Adjacent values sum to the next (the golden-ratio ladder): shown as stacked squares on the red side.
  return {
    body: s + caption(318, "Modulor", "Le Corbusier's two series, in centimetres", "183 and 226 cm, each step the golden ratio"),
    variant: "modulor",
    category: "architecture",
    title: "Modulor Scales, Red and Blue",
    subject: "Le Corbusier Modulor Series",
    description: "Le Corbusier's Modulor: the red series from a 183 cm figure and the blue from 226 cm, the height of the raised hand, each step the one before times the golden ratio, marked in centimetres.",
    features: { ...FEAT, typography: 0.35, abstract: 0.35 },
    sigKey: "modulor",
  };
}

export function architectureSet(): Set7Design[] {
  return [...archDesigns(), ...bondDesigns(), ...trussDesigns(), ordersDesign(), modulorDesign()];
}
