/**
 * Offline procedural generator for the MONO catalog (2,000 designs).
 *
 *   npm run generate
 *
 * Writes public/prints/print_N.svg and data/shirts.json. Fully deterministic
 * (seeded PRNG): re-running produces byte-identical output.
 *
 * - ids 1–1000: the original five families (./gen/legacy) — unchanged.
 * - ids 1001–2000: five new categories (./gen/expansion): scenes, slogans,
 *   pixel & retro, badges, illustrated objects.
 *
 * Every print is single-ink: white ink on a black ground for black tees,
 * black ink on a white ground for white tees (tones come from dot / hatch
 * patterns). The app blends the ground into the fabric and can invert a
 * print exactly for the other tee colour.
 *
 * Feature vectors are computed from each design's actual parameters.
 * Near-identical designs are grouped into families from a visual signature.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { BaseColor, FeatureKey, ShirtCategory, ShirtProduct } from "../types/shirt";
import { H, M, W, clamp01, int, mulberry32, shuffle, vector, type Rng, type Signature } from "./gen/core";
import { LEGACY_GENERATORS } from "./gen/legacy";
import { EXPANSION_GENERATORS, legacyExtras } from "./gen/expansion";

const SEED = 0x6d6f6e6f; // "mono"
const PER_SET = 1000;
const BLACK_SHARE = 0.7;

const LEGACY_CATEGORIES: ShirtCategory[] = ["architectural", "geometric", "typography", "halftone", "waves"];
const NEW_CATEGORIES: ShirtCategory[] = ["scenes", "slogans", "pixel", "emblems", "objects"];

const ROOT = path.resolve(__dirname, "..");
const PRINTS_DIR = path.join(ROOT, "public", "prints");
const DATA_FILE = path.join(ROOT, "data", "shirts.json");

/* ------------------------------------------------------------------ */
/* Titles & SKUs                                                       */
/* ------------------------------------------------------------------ */

const TITLE_WORDS: Record<ShirtCategory, [string[], string[]]> = {
  architectural: [
    ["Concrete", "Brutal", "Monolith", "Facade", "Structural", "Civic", "Steel", "Tectonic", "Transit", "Pillar"],
    ["Lattice", "Elevation", "Section", "Frame", "Plan", "Module", "Stack", "Corridor", "Array", "Bay"],
  ],
  geometric: [
    ["Prime", "Solid", "Vector", "Orbit", "Pivot", "Axial", "Nodal", "Inverse", "Kinetic", "Euclid"],
    ["Form", "Polygon", "Sphere", "Vertex", "Cluster", "Arc", "Prism", "Tile", "Unit", "Shape"],
  ],
  typography: [
    ["Coordinate", "Index", "Manifest", "Transmit", "Serial", "Datum", "Header", "Glyph", "Caption", "Bulletin"],
    ["Log", "Sheet", "Stamp", "Code", "Report", "Series", "Notation", "Ledger", "Type", "Archive"],
  ],
  halftone: [
    ["Raster", "Grain", "Dot", "Static", "Pulse", "Dither", "Screen", "Noise", "Matrix", "Pixel"],
    ["Field", "Fade", "Bloom", "Gradient", "Sun", "Moon", "Scan", "Plate", "Haze", "Burst"],
  ],
  waves: [
    ["Drift", "Tide", "Flow", "Contour", "Echo", "Current", "Ripple", "Phase", "Fluid", "Loop"],
    ["Lines", "Study", "Wave", "Map", "Pattern", "Motion", "Stream", "Weave", "Rhythm", "Trace"],
  ],
  scenes: [
    ["Quiet", "Northern", "Lunar", "Desert", "Coastal", "Midnight", "Distant", "Hollow", "Silver", "Wild"],
    ["Horizon", "Ridge", "Tide", "Moon", "Dune", "Pines", "Valley", "Shore", "Orbit", "Dusk"],
  ],
  slogans: [
    ["Loud", "Honest", "Dry", "Plain", "Bold", "Deadpan", "Small", "Big", "Open", "Fine"],
    ["Print", "Statement", "Notice", "Memo", "Remark", "Truth", "Reminder", "Headline", "Take", "Word"],
  ],
  pixel: [
    ["8-Bit", "Arcade", "Pixel", "Retro", "Neon", "Glitch", "Turbo", "Cartridge", "Joystick", "Chip"],
    ["Hero", "Quest", "Level", "Sprite", "Screen", "Boss", "Save", "Combo", "Bonus", "Run"],
  ],
  emblems: [
    ["Official", "Royal", "Loyal", "Grand", "Secret", "Honorary", "Founding", "Local", "Vintage", "Certified"],
    ["Badge", "Crest", "Seal", "Stamp", "Emblem", "Pass", "Ticket", "Order", "Society", "Club"],
  ],
  objects: [
    ["Everyday", "Lucky", "Borrowed", "Pocket", "Studio", "Humble", "Curious", "Spare", "Found", "Tiny"],
    ["Object", "Thing", "Tool", "Relic", "Item", "Artifact", "Gadget", "Keepsake", "Piece", "Kit"],
  ],
};

const SKU_CODE: Record<ShirtCategory, string> = {
  architectural: "ARC",
  geometric: "GEO",
  typography: "TYP",
  halftone: "HLF",
  waves: "WAV",
  scenes: "SCN",
  slogans: "SLG",
  pixel: "PIX",
  emblems: "EMB",
  objects: "OBJ",
};

/** Categories whose designs may be knocked out of a solid ink block. */
const KNOCKOUT_OK: ShirtCategory[] = [...LEGACY_CATEGORIES, "slogans", "pixel", "objects"];

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

function frame(rng: Rng, ink: string): { svg: string; kind: "frame" | "corners" | "none" } {
  const roll = rng();
  if (roll < 0.22) {
    const inset = 10;
    return { svg: `<rect x="${inset}" y="${inset}" width="${W - 2 * inset}" height="${H - 2 * inset}" fill="none" stroke="${ink}" stroke-width="1.5"/>`, kind: "frame" };
  }
  if (roll < 0.36) {
    const L = 14;
    const i = 10;
    const d = `M${i},${i + L}V${i}H${i + L} M${W - i - L},${i}H${W - i}V${i + L} M${W - i},${H - i - L}V${H - i}H${W - i - L} M${i + L},${H - i}H${i}V${H - i - L}`;
    return { svg: `<path d="${d}" fill="none" stroke="${ink}" stroke-width="1.5"/>`, kind: "corners" };
  }
  return { svg: "", kind: "none" };
}

/**
 * RMS distance between signature vectors (both in ~[0,1] per dimension).
 * Below this, two designs of the same kind read as variations of one print.
 * Signatures only carry parameters the eye actually notices (tuned against
 * contact sheets), so e.g. ring count or stroke weight don't split families.
 */
const FAMILY_THRESHOLD = 0.25;

function sigDistance(a: number[], b: number[]) {
  if (a.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum / a.length);
}

/**
 * Leader clustering: each design joins the nearest existing family leader
 * with the same key within FAMILY_THRESHOLD, else it founds a new family.
 * Comparing against leaders only stops similarity from chaining across a
 * whole algorithm. Deterministic in catalog order.
 */
function assignFamilies(sigs: Signature[]): number[] {
  const leaders: { key: string; vec: number[]; family: number }[] = [];
  return sigs.map((sig) => {
    let best: (typeof leaders)[number] | null = null;
    let bestD = Infinity;
    for (const l of leaders) {
      if (l.key !== sig.key) continue;
      const d = sigDistance(l.vec, sig.vec);
      if (d < FAMILY_THRESHOLD && d < bestD) {
        best = l;
        bestD = d;
      }
    }
    if (best) return best.family;
    const family = leaders.length;
    leaders.push({ key: sig.key, vec: sig.vec, family });
    return family;
  });
}

const colourSplit = (rng: Rng): BaseColor[] =>
  shuffle(rng, [
    ...Array<BaseColor>(Math.round(PER_SET * BLACK_SHARE)).fill("black"),
    ...Array<BaseColor>(PER_SET - Math.round(PER_SET * BLACK_SHARE)).fill("white"),
  ]);

function main() {
  // Exactly 70% black / 30% white in each set of 1,000. The first shuffle is
  // the original one, so ids 1–1000 keep their colours.
  const colors = [...colourSplit(mulberry32(SEED)), ...colourSplit(mulberry32(SEED ^ 0x2000))];

  rmSync(PRINTS_DIR, { recursive: true, force: true });
  mkdirSync(PRINTS_DIR, { recursive: true });
  mkdirSync(path.dirname(DATA_FILE), { recursive: true });

  const counters = Object.fromEntries([...LEGACY_CATEGORIES, ...NEW_CATEGORIES].map((c) => [c, 0])) as Record<ShirtCategory, number>;
  const shirts: Omit<ShirtProduct, "family">[] = [];
  const sigs: Signature[] = [];
  let bytes = 0;

  for (let i = 0; i < PER_SET * 2; i++) {
    const n = i + 1;
    const isNew = i >= PER_SET;
    const cats = isNew ? NEW_CATEGORIES : LEGACY_CATEGORIES;
    // Interleave categories so neighbouring ids differ in style.
    const category = cats[i % cats.length];
    const index = ++counters[category];
    const gens = (isNew ? EXPANSION_GENERATORS : LEGACY_GENERATORS)[category];
    const gen = gens[(index - 1) % gens.length];

    const baseColor = colors[i];
    const ink = baseColor === "black" ? "#FFFFFF" : "#000000";
    const ground = baseColor === "black" ? "#000000" : "#FFFFFF";
    const designRng = mulberry32(SEED ^ Math.imul(n, 0x9e3779b1));

    // ~12% of prints are knocked out of a solid ink block (a bold rectangle).
    const knockRoll = designRng();
    const knockout = KNOCKOUT_OK.includes(category) && knockRoll < 0.12;
    const [dInk, dGround] = knockout ? [ground, ink] : [ink, ground];
    const design = gen(designRng, dInk, dGround);
    // New designs bring their own borders; only the originals get the frame overlay.
    const fr = knockout || isNew ? { svg: "", kind: "none" as const } : frame(designRng, ink);

    const f: Partial<Record<FeatureKey, number>> = { ...design.features, ...(isNew ? {} : legacyExtras(design.variant)) };
    const add = (k: FeatureKey, d: number) => (f[k] = (f[k] ?? 0) + d);
    if (fr.kind !== "none") {
      add("geometric", 0.05);
      add("clean_minimal", 0.04);
      add("architectural", 0.03);
    }
    if (knockout) {
      add("contrast", 0.15);
      add("density", 0.25);
      add("clean_minimal", -0.1);
      add("dark_industrial", 0.1);
    }
    // White ink on black reads heavier and more industrial; black on white cleaner.
    if (baseColor === "black") {
      add("dark_industrial", 0.12);
      add("clean_minimal", -0.05);
    } else {
      add("clean_minimal", 0.12);
      add("dark_industrial", -0.08);
    }
    const features = vector(f);

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
      `<rect width="${W}" height="${H}" fill="${ground}"/>` +
      (knockout ? `<rect x="${M / 2}" y="${M / 2}" width="${W - M}" height="${H - M}" fill="${ink}"/>` : "") +
      design.body +
      fr.svg +
      `</svg>`;
    writeFileSync(path.join(PRINTS_DIR, `print_${n}.svg`), svg);
    // A knocked-out block reads completely differently from the plain print.
    sigs.push({ key: `${design.sig.key}|${knockout ? "ko" : "std"}`, vec: design.sig.vec });
    bytes += svg.length;

    const [adjs, nouns] = TITLE_WORDS[category];
    const title = `${adjs[(index - 1) % adjs.length]} ${nouns[Math.floor((index - 1) / adjs.length) % nouns.length]} ${String(index).padStart(3, "0")}`;
    const price = Math.min(59, 39 + Math.round(clamp01(design.complexity) * 14) + int(designRng, 0, 6));

    shirts.push({
      id: `mono-${String(n).padStart(4, "0")}`,
      sku: `MN-${SKU_CODE[category]}-${baseColor === "black" ? "B" : "W"}-${String(n).padStart(4, "0")}`,
      title,
      price,
      baseColor,
      backPrintUrl: `/prints/print_${n}.svg`,
      category,
      variant: design.variant,
      // No ink colour here: every design is sold in both colourways.
      description: `${design.description}${knockout ? " Knocked out of a solid ink block." : ""}`,
      features,
    });
  }

  const familyIndex = assignFamilies(sigs);
  const catalog: ShirtProduct[] = shirts.map((s, i) => ({
    ...s,
    family: `fam-${String(familyIndex[i] + 1).padStart(4, "0")}`,
  }));

  // One object per line: diff-friendly but compact.
  writeFileSync(DATA_FILE, `[\n${catalog.map((s) => JSON.stringify(s)).join(",\n")}\n]\n`);

  const sizes = new Map<string, number>();
  for (const s of catalog) sizes.set(s.family, (sizes.get(s.family) ?? 0) + 1);
  const newFamilies = new Set(catalog.slice(PER_SET).map((s) => s.family)).size;
  const black = shirts.filter((s) => s.baseColor === "black").length;
  const titles = new Set(shirts.map((s) => s.title)).size;
  console.log(`Generated ${shirts.length} shirts → ${path.relative(ROOT, DATA_FILE)}`);
  console.log(`  prints: ${shirts.length} SVGs in ${path.relative(ROOT, PRINTS_DIR)} (${(bytes / 1024 / 1024).toFixed(2)} MB, avg ${(bytes / shirts.length / 1024).toFixed(1)} KB)`);
  console.log(`  colours: ${black} black / ${shirts.length - black} white · unique titles: ${titles}`);
  console.log(`  families: ${sizes.size} (${sizes.size - newFamilies} original, ${newFamilies} new)`);
  console.log(`  categories: ${Object.entries(counters).map(([c, n]) => `${c} ${n}`).join(" · ")}`);
  console.log(`  price range: $${Math.min(...shirts.map((s) => s.price))}–$${Math.max(...shirts.map((s) => s.price))}`);
}

main();
