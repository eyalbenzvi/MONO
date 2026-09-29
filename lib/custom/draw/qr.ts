/**
 * A QR code encoder (ISO/IEC 18004), our own, for Your Link: byte mode,
 * error correction level Q (a quarter of the code can be lost and it still
 * reads: a print on a chest is curved, creased and drawn in dots), versions
 * 1–10, Reed–Solomon over GF(256), block interleaving, all eight masks
 * scored by the standard's four penalty rules, format and version
 * information. Pure and deterministic; nothing is fetched or looked up: the
 * address is encoded on the device exactly as typed.
 */

/** Level Q, per version 1–10: EC codewords per block, then [blocks, data codewords] for the short and long groups. */
const Q_BLOCKS: [number, number, number, number, number][] = [
  [13, 1, 13, 0, 0],
  [22, 1, 22, 0, 0],
  [18, 2, 17, 0, 0],
  [26, 2, 24, 0, 0],
  [18, 2, 15, 2, 16],
  [24, 4, 19, 0, 0],
  [18, 2, 14, 4, 15],
  [22, 4, 18, 2, 19],
  [20, 4, 16, 4, 17],
  [24, 6, 19, 2, 20],
];
/** Alignment pattern centres per version (1 has none). */
const ALIGN: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
export const QR_MAX_VERSION = 10;
/** Format bits of level Q. */
const LEVEL_Q = 3;

const dataCodewords = (v: number) => {
  const [, b1, d1, b2, d2] = Q_BLOCKS[v - 1];
  return b1 * d1 + b2 * d2;
};
/** How many bytes a version holds at level Q, byte mode. */
export const qrCapacity = (v: number) => Math.floor((dataCodewords(v) * 8 - 4 - (v < 10 ? 8 : 16)) / 8);

/* GF(256), polynomial 0x11d. */
function mul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
function rsDivisor(degree: number): number[] {
  const out = new Array<number>(degree).fill(0);
  out[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      out[j] = mul(out[j], root);
      if (j + 1 < degree) out[j] ^= out[j + 1];
    }
    root = mul(root, 2);
  }
  return out;
}
/** The Reed–Solomon remainder (the EC codewords) of a block. */
export function rsRemainder(data: readonly number[], degree: number): number[] {
  const div = rsDivisor(degree);
  const out = new Array<number>(degree).fill(0);
  for (const b of data) {
    const f = b ^ (out.shift() as number);
    out.push(0);
    div.forEach((c, i) => (out[i] ^= mul(c, f)));
  }
  return out;
}

export interface QrCode {
  version: number;
  size: number;
  mask: number;
  /** dark[y][x]. */
  dark: boolean[][];
  /** Alignment pattern centres, as [x, y]. */
  align: [number, number][];
}

/** The data codewords: mode, count, bytes, terminator, padding. */
function dataBits(bytes: Uint8Array, v: number): number[] {
  const bits: number[] = [];
  const put = (val: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, v < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  const cap = dataCodewords(v) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; out.length < dataCodewords(v); pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

/** The data split into blocks, each with its EC codewords, interleaved. */
function interleave(data: number[], v: number): number[] {
  const [ec, b1, d1, b2, d2] = Q_BLOCKS[v - 1];
  const blocks: number[][] = [];
  let k = 0;
  for (let i = 0; i < b1 + b2; i++) {
    const n = i < b1 ? d1 : d2;
    const dat = data.slice(k, k + n);
    k += n;
    blocks.push(dat);
  }
  const eccs = blocks.map((b) => rsRemainder(b, ec));
  const out: number[] = [];
  for (let i = 0; i < Math.max(d1, d2); i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ec; i++) for (const e of eccs) out.push(e[i]);
  return out;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** The standard's penalty for a finished matrix (lower is better). */
function penalty(m: boolean[][]): number {
  const n = m.length;
  let score = 0;
  const line = (get: (i: number) => boolean) => {
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && get(i) === get(i - 1)) run++;
      else {
        if (run >= 5) score += 3 + run - 5;
        run = 1;
      }
    }
    // 1:1:3:1:1 with four light modules on either side.
    const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    for (let i = 0; i + 11 <= n; i++) {
      let fwd = true, back = true;
      for (let j = 0; j < 11; j++) {
        const d = get(i + j) ? 1 : 0;
        if (d !== pat[j]) fwd = false;
        if (d !== pat[10 - j]) back = false;
      }
      score += (fwd ? 40 : 0) + (back ? 40 : 0);
    }
  };
  for (let y = 0; y < n; y++) line((i) => m[y][i]);
  for (let x = 0; x < n; x++) line((i) => m[i][x]);
  let dark = 0;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (m[y][x]) dark++;
      if (x < n - 1 && y < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
    }
  const total = n * n;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

/** The 15 format bits (level Q and the mask), BCH-protected and masked. */
export function formatBits(mask: number): number {
  const data = (LEVEL_Q << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}
/** The 18 version bits (7 and up). */
export function versionBits(v: number): number {
  let rem = v;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (v << 12) | rem;
}

/** The smallest version from `minVersion` that holds the text, or null when it's too long for version 10. */
export function qrVersionFor(byteLength: number, minVersion = 1): number | null {
  for (let v = Math.max(1, minVersion); v <= QR_MAX_VERSION; v++) if (qrCapacity(v) >= byteLength) return v;
  return null;
}

/** Encodes a text (UTF-8, byte mode, level Q) in the smallest version from `minVersion`; null when it doesn't fit version 10. */
export function encodeQr(text: string, minVersion = 1): QrCode | null {
  const bytes = new TextEncoder().encode(text);
  const v = qrVersionFor(bytes.length, minVersion);
  if (!v) return null;
  const size = 17 + 4 * v;
  const m: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, d: boolean) => ((m[y][x] = d), (fn[y][x] = true));
  // Timing, finders (with their separators), alignment.
  for (let i = 0; i < size; i++) set(6, i, i % 2 === 0), set(i, 6, i % 2 === 0);
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const [x, y] = [cx + dx, cy + dy];
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
  const pos = ALIGN[v - 1];
  const align: [number, number][] = [];
  for (let i = 0; i < pos.length; i++)
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue;
      align.push([pos[i], pos[j]]);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  const drawFormat = (mask: number) => {
    const bits = formatBits(mask);
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (v >= 7) {
    const bits = versionBits(v);
    for (let i = 0; i < 18; i++) {
      const d = ((bits >>> i) & 1) === 1;
      const [a, b] = [size - 11 + (i % 3), Math.floor(i / 3)];
      set(a, b, d);
      set(b, a, d);
    }
  }
  // The codewords, in the zigzag.
  const words = interleave(dataBits(bytes, v), v);
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (fn[y][x]) continue;
        if (k < words.length * 8) m[y][x] = ((words[k >>> 3] >>> (7 - (k & 7))) & 1) === 1;
        k++;
      }
  }
  // Every mask tried; the lowest penalty kept (the first on a tie).
  let best: boolean[][] = m;
  let bestMask = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const f = MASKS[mask];
    const t = m.map((row, y) => row.map((d, x) => (fn[y][x] ? d : d !== f(x, y))));
    const bits = formatBits(mask);
    const put = (x: number, y: number, i: number) => (t[y][x] = ((bits >>> i) & 1) === 1);
    for (let i = 0; i <= 5; i++) put(8, i, i);
    put(8, 7, 6);
    put(8, 8, 7);
    put(7, 8, 8);
    for (let i = 9; i < 15; i++) put(14 - i, 8, i);
    for (let i = 0; i < 8; i++) put(size - 1 - i, 8, i);
    for (let i = 8; i < 15; i++) put(8, size - 15 + i, i);
    const s = penalty(t);
    if (s < bestScore) (bestScore = s), (best = t), (bestMask = mask);
  }
  return { version: v, size, mask: bestMask, dark: best, align };
}

/** Whether module (x, y) of a code of this size belongs to a finder pattern or its separator. */
export const inFinder = (x: number, y: number, size: number) => (x < 8 && y < 8) || (x >= size - 8 && y < 8) || (x < 8 && y >= size - 8);
