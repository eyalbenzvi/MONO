/**
 * Safe SVG minification for generated prints (visual output unchanged):
 * - whitespace between tags removed, whitespace runs inside tags collapsed;
 * - inside attribute values only (never text content, where "0.00" is a
 *   price): trailing ".0" dropped, leading zeros dropped ("0.5" → ".5"),
 *   and in path data the space before a command letter removed.
 */
const NUMERIC_ATTRS = new Set(["d", "points", "transform", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "stroke-width", "font-size", "letter-spacing", "textLength", "stroke-dasharray", "opacity", "startOffset", "dx", "dy", "offset", "fill-opacity", "stroke-opacity", "stdDeviation"]);

function shortenNumbers(v: string) {
  return v
    .replace(/(\d+)\.0(?![\d])/g, "$1")
    .replace(/(^|[\s,(-])0\.(\d)/g, "$1.$2")
    .replace(/\s+/g, " ")
    .trim();
}

export function minifySvg(svg: string) {
  return svg
    .replace(/>\s+</g, "><")
    .replace(/<[^>]+>/g, (tag) =>
      tag
        .replace(/\s+/g, " ")
        .replace(/\s+(\/?>)$/, "$1")
        .replace(/ ([\w:-]+)="([^"]*)"/g, (_m, name: string, value: string) => {
          if (!NUMERIC_ATTRS.has(name)) return ` ${name}="${value}"`;
          let v = shortenNumbers(value);
          if (name === "d") v = optimizePath(v).replace(/\s+([MLHVCSQTAZmlhvcsqtaz])/g, "$1").replace(/([MLHVCSQTAZmlhvcsqtaz])\s+/g, "$1");
          return ` ${name}="${v}"`;
        }),
    );
}

/* ------------------------------------------------------------------ */
/* Path data optimiser                                                 */
/* ------------------------------------------------------------------ */

const fmt = (n: number) => {
  let s = (Math.round(n * 10) / 10).toString();
  if (s === "-0") s = "0";
  return s.replace(/^(-?)0\./, "$1.");
};

/** Concatenate numbers with the fewest separators ("-" and a second "." need none). */
function joinNums(nums: number[]) {
  let out = "";
  let prev = "";
  for (const n of nums) {
    const s = fmt(n);
    if (out && !(s.startsWith("-") || (s.startsWith(".") && prev.includes(".")))) out += " ";
    out += s;
    prev = s;
  }
  return out;
}

/**
 * Rewrites path data made of absolute M/L/H/V/Q/C/Z commands: each segment
 * uses relative or absolute coordinates, whichever is shorter, and repeated
 * command letters are dropped. Numbers keep their one-decimal precision, so
 * the drawn geometry is unchanged. Any other path is returned as is.
 */
export function optimizePath(d: string): string {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g);
  if (!tokens || tokens.some((t) => (/[a-zA-Z]/.test(t) && !"MLHVQCZ".includes(t)) || /e|\.\d\d/.test(t))) return d;
  const cmds: { c: string; n: number[] }[] = [];
  for (const t of tokens) {
    if (/[A-Z]/.test(t)) cmds.push({ c: t, n: [] });
    else if (cmds.length) cmds[cmds.length - 1].n.push(Number(t));
    else return d;
  }
  const arity: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, Z: 0 };
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let out = "";
  let last = "";
  const emit = (letter: string, nums: number[]) => {
    const body = joinNums(nums);
    // A repeated letter may be omitted (not after M: implicit M pairs mean L).
    const needLetter = letter !== last || letter === "M" || letter === "m" || letter === "Z";
    const piece = (needLetter ? letter : body.startsWith("-") ? "" : " ") + body;
    out += piece;
    last = letter;
  };
  for (const { c, n } of cmds) {
    const k = arity[c];
    if (k === 0) {
      out += "Z";
      last = "Z";
      x = sx;
      y = sy;
      continue;
    }
    if (n.length % k !== 0) return d;
    for (let i = 0; i < n.length; i += k) {
      const seg = n.slice(i, i + k);
      // An M followed by more pairs continues as L.
      const cc = c === "M" && i > 0 ? "L" : c;
      let abs: number[];
      let rel: number[];
      if (cc === "H") {
        abs = [seg[0]];
        rel = [seg[0] - x];
      } else if (cc === "V") {
        abs = [seg[0]];
        rel = [seg[0] - y];
      } else {
        abs = seg;
        rel = seg.map((v, j) => v - (j % 2 === 0 ? x : y));
      }
      const absStr = joinNums(abs);
      const relStr = joinNums(rel);
      if (relStr.length < absStr.length) emit(cc.toLowerCase(), rel);
      else emit(cc, abs);
      if (cc === "H") x = seg[0];
      else if (cc === "V") y = seg[0];
      else {
        x = seg[k - 2];
        y = seg[k - 1];
      }
      if (cc === "M") {
        sx = x;
        sy = y;
      }
    }
  }
  return out;
}
