/**
 * Offline procedural generator for the MONO catalog (2,800 designs).
 *
 *   npm run generate
 *
 * Writes public/prints/print_N.svg and data/shirts.json. Fully deterministic
 * (seeded PRNG): re-running produces byte-identical output.
 *
 * - ids 1–1000: the original five families (./gen/legacy) — unchanged.
 * - ids 1001–2000: five new categories (./gen/expansion): scenes, slogans,
 *   pixel & retro, badges, illustrated objects.
 * - ids 2001–2800: ASCII art, caricatures (original archetypes), famous art
 *   (public-domain homages) and iconic images (./gen/set3).
 * - ids 2801–3400: photographs — wildlife, flight, engines & gauges — from
 *   Smithsonian Open Access (CC0). scripts/photos/fetchPhotos.ts commits
 *   their prints (public/prints/print_N.webp: greyscale, the whole picture)
 *   and data/photos/photos.json; this reads them (never inverted: a
 *   photograph inverted is a negative).
 *
 * Every print is single-ink: white ink on a black ground for black tees,
 * black ink on a white ground for white tees (tones come from dot / hatch
 * patterns). The app blends the ground into the fabric and can invert a
 * print exactly for the other tee colour.
 *
 * Feature vectors are computed from each design's actual parameters.
 * Near-identical designs are grouped into families from a visual signature.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FEATURE_KEYS, PHOTO_CATEGORIES, SKU_CODES, isPhoto, otherColor, type BaseColor, type CatalogEntry, type FeatureKey, type ShirtCategory, type ShirtProduct } from "../types/shirt";
import { CALIBRATION_SIZE, centeredCosine, cosineSimilarity, getCalibrationQueue } from "../lib/recommendation";
import { finishDescriptions, sentence } from "./gen/describe";
import { STYLE, SUBJECT_NOUN_CATEGORIES, subjectOf } from "./gen/subject";
import { WEAK_QUALITY, measurePrint } from "./gen/quality";
import { DROP_SIZE, PER_CATEGORY, PRICE, SHARD_SIZE, TOTAL } from "./gen/constants";
import { minifySvg } from "./gen/minify";
import { retiredIds } from "./gen/retire";
import { H, M, W, mulberry32, shuffle, vector, type Rng, type Signature } from "./gen/core";
import { LEGACY_CATEGORIES, LEGACY_GENERATORS } from "./gen/legacy";
import { EXPANSION_CATEGORIES, EXPANSION_GENERATORS, legacyExtras } from "./gen/expansion";
import { asciiArt, asciiBanner, asciiScene, asciiShade } from "./gen/set3/ascii";
import { caricatureBobble, caricatureMugshot, caricaturePortrait, caricatureWanted } from "./gen/set3/caricature";
import { greatWave, masterpiece, modernMasters, starryNight } from "./gen/set3/famousart";
import { landmark, motif, spaceAge, travelPoster } from "./gen/set3/iconic";
import type { Generator } from "./gen/core";
import { photoOrder, recordUrl, type PhotoSource } from "./photos/source";

const SEED = 0x6d6f6e6f; // "mono"
/** Designs in each of the first two sets (five categories each). */
const PER_SET = 5 * PER_CATEGORY;
const BLACK_SHARE = 0.7;

const NEW_CATEGORIES = EXPANSION_CATEGORIES;
const SET3_CATEGORIES = ["ascii", "caricatures", "famousart", "iconic"] as const satisfies readonly ShirtCategory[];
const SET3_PER_CATEGORY = PER_CATEGORY;

const SET3_GENERATORS: Record<(typeof SET3_CATEGORIES)[number], Generator[]> = {
  ascii: [asciiBanner, asciiShade, asciiArt, asciiScene],
  caricatures: [caricaturePortrait, caricatureWanted, caricatureMugshot, caricatureBobble],
  famousart: [greatWave, starryNight, modernMasters, masterpiece],
  iconic: [landmark, travelPoster, spaceAge, motif],
};

/** A set of designs: its categories, a generator list for each, and its size. */
interface DesignSet {
  cats: readonly ShirtCategory[];
  generatorsFor: (category: ShirtCategory) => Generator[];
  size: number;
  legacy: boolean;
  /** Made from photographs (data/photos), not generators. */
  photo?: boolean;
}
/** Typed per set (every category of the set must have generators). */
function set<C extends ShirtCategory>(s: { cats: readonly C[]; gens: Record<C, Generator[]>; size: number; legacy: boolean }): DesignSet {
  const isMine = (c: ShirtCategory): c is C => (s.cats as readonly ShirtCategory[]).includes(c);
  return {
    cats: s.cats,
    size: s.size,
    legacy: s.legacy,
    generatorsFor: (c) => {
      if (!isMine(c)) throw new Error(`no generators for ${c} in this set`);
      return s.gens[c];
    },
  };
}

/** Each set: its categories, generators and size. Ids run on across sets. */
const SETS: DesignSet[] = [
  set({ cats: LEGACY_CATEGORIES, gens: LEGACY_GENERATORS, size: PER_SET, legacy: true }),
  set({ cats: NEW_CATEGORIES, gens: EXPANSION_GENERATORS, size: PER_SET, legacy: false }),
  set({ cats: SET3_CATEGORIES, gens: SET3_GENERATORS, size: SET3_CATEGORIES.length * SET3_PER_CATEGORY, legacy: false }),
  { cats: PHOTO_CATEGORIES, size: PHOTO_CATEGORIES.length * PER_CATEGORY, legacy: false, photo: true, generatorsFor: () => [] },
];


/** Monday of the first weekly drop; each design gets its drop date explicitly. */
const DROP_EPOCH = Date.UTC(2025, 4, 26);
const DAY = 86_400_000;

/** Precomputed neighbours per design (other families, one per algorithm). */
const SIMILAR_K = 6;

const ROOT = path.resolve(__dirname, "..");
const PRINTS_DIR = path.join(ROOT, "public", "prints");
/** Full catalog (server-side: product pages, metadata, OG images; tests). */
const DATA_FILE = path.join(ROOT, "data", "shirts.json");
/** Lean index bundled with the app. */
const INDEX_FILE = path.join(ROOT, "data", "shirts.index.json");
/** Descriptions + neighbours, fetched on demand. */
const SHARD_DIR = path.join(ROOT, "public", "data");

/* ------------------------------------------------------------------ */
/* Titles & SKUs                                                       */
/* ------------------------------------------------------------------ */

/** Drawn categories (the photographs are named after their subject). */
type DrawnCategory = Exclude<ShirtCategory, (typeof PHOTO_CATEGORIES)[number]>;
const TITLE_WORDS: Record<DrawnCategory, [string[], string[]]> = {
  architectural: [
    ["Concrete", "Brutal", "Monolith", "Facade", "Structural", "Civic", "Steel", "Tectonic", "Transit", "Pillar", "Modular", "Grid", "Poured", "Cantilever", "Plinth"],
    ["Lattice", "Elevation", "Section", "Frame", "Plan", "Module", "Stack", "Corridor", "Array", "Bay", "Tower", "Atrium", "Span", "Block", "Terrace"],
  ],
  geometric: [
    ["Prime", "Solid", "Vector", "Orbit", "Pivot", "Axial", "Nodal", "Inverse", "Kinetic", "Euclid", "Pure", "Square", "Radial", "Minimal", "Angular"],
    ["Form", "Polygon", "Sphere", "Vertex", "Cluster", "Arc", "Prism", "Tile", "Unit", "Shape", "Circle", "Grid", "Axis", "Figure", "Field"],
  ],
  typography: [
    ["Coordinate", "Index", "Manifest", "Transmit", "Serial", "Datum", "Header", "Glyph", "Caption", "Bulletin", "Bold", "Plain", "Heavy", "Printed", "Stacked"],
    ["Log", "Sheet", "Stamp", "Code", "Report", "Series", "Notation", "Ledger", "Type", "Archive", "Word", "Letter", "Column", "Headline", "Block"],
  ],
  halftone: [
    ["Raster", "Grain", "Dot", "Static", "Pulse", "Dither", "Screen", "Noise", "Matrix", "Pixel", "Soft", "Coarse", "Fine", "Faded", "Tonal"],
    ["Field", "Fade", "Bloom", "Gradient", "Sun", "Moon", "Scan", "Plate", "Haze", "Burst", "Grain", "Screen", "Wash", "Glow", "Halo"],
  ],
  waves: [
    ["Drift", "Tide", "Flow", "Contour", "Echo", "Current", "Ripple", "Phase", "Fluid", "Loop", "Slow", "Tidal", "Quiet", "Rolling", "Soft"],
    ["Lines", "Study", "Wave", "Map", "Pattern", "Motion", "Stream", "Weave", "Rhythm", "Trace", "Current", "Swell", "Drift", "Ridge", "Field"],
  ],
  scenes: [
    ["Quiet", "Northern", "Lunar", "Desert", "Coastal", "Midnight", "Distant", "Hollow", "Silver", "Wild", "Misty", "Golden", "Still", "Far", "Faded"],
    ["Horizon", "Ridge", "Tide", "Moon", "Dune", "Pines", "Valley", "Shore", "Orbit", "Dusk", "Coast", "Summit", "Lake", "Plain", "Night"],
  ],
  slogans: [
    ["Loud", "Honest", "Dry", "Plain", "Bold", "Deadpan", "Small", "Big", "Open", "Fine", "Frank", "Blunt", "Sincere", "Clear", "Candid"],
    ["Print", "Statement", "Notice", "Memo", "Remark", "Truth", "Reminder", "Headline", "Take", "Word", "Line", "Note", "Motto", "Claim", "Point"],
  ],
  pixel: [
    ["8-Bit", "Arcade", "Pixel", "Retro", "Neon", "Glitch", "Turbo", "Cartridge", "Joystick", "Chip", "Blocky", "Pocket", "Bonus", "Low-Res", "Glitchy"],
    ["Hero", "Quest", "Level", "Sprite", "Screen", "Boss", "Save", "Combo", "Bonus", "Run", "Stage", "Pixel", "Coin", "Warp", "Ending"],
  ],
  emblems: [
    ["Official", "Royal", "Loyal", "Grand", "Secret", "Honorary", "Founding", "Local", "Vintage", "Certified", "Noble", "Elder", "Ancient", "Club", "Private"],
    ["Badge", "Crest", "Seal", "Stamp", "Emblem", "Pass", "Ticket", "Order", "Society", "Club", "Guild", "League", "Medal", "Circle", "Charter"],
  ],
  objects: [
    ["Everyday", "Lucky", "Borrowed", "Pocket", "Studio", "Humble", "Curious", "Spare", "Found", "Tiny", "Useful", "Common", "Simple", "Second", "Loyal"],
    ["Object", "Thing", "Tool", "Relic", "Item", "Artifact", "Gadget", "Keepsake", "Piece", "Kit", "Gizmo", "Trinket", "Utensil", "Thingamajig", "Souvenir"],
  ],
  ascii: [
    ["Plain", "Monospace", "Terminal", "Typed", "Legacy", "Command", "Raw", "Console", "Text", "Char", "Plaintext", "Buffered", "Encoded", "Escaped", "Piped"],
    ["Text", "Prompt", "Render", "Output", "Log", "Screen", "Stream", "Mode", "Buffer", "Shell", "Glyph", "Cursor", "Ledger", "Script", "Terminal"],
  ],
  caricatures: [
    ["Usual", "Local", "Classic", "Certified", "Proud", "Typical", "Famous", "Legendary", "Resident", "Friendly", "Notorious", "Regular", "Serial", "Habitual", "Proper"],
    ["Suspect", "Character", "Regular", "Type", "Face", "Legend", "Specimen", "Persona", "Icon", "Neighbour", "Fixture", "Figure", "Local", "Stalwart", "Customer"],
  ],
  famousart: [
    ["Gallery", "Museum", "Salon", "Old", "Master", "Grand", "Gilded", "Hung", "Framed", "Curated", "Classic", "Painted", "Varnished", "Restored", "Rare"],
    ["Study", "Homage", "Piece", "Canvas", "Print", "Sketch", "Classic", "Wing", "Room", "Edition", "Salon", "Masterwork", "Panel", "Fresco", "Tableau"],
  ],
  iconic: [
    ["Postcard", "World", "Landmark", "Souvenir", "Famous", "Grand", "Wanderer", "Voyage", "Horizon", "Atlas", "Vintage", "Faraway", "Classic", "Global", "Scenic"],
    ["View", "Icon", "Sight", "Wonder", "Stop", "Poster", "Trip", "Mark", "Route", "Moment", "Postcard", "Skyline", "Horizon", "Voyage", "Landmark"],
  ],
};


/** A name that fits a card: no parentheses, a long name gives way to its nickname, then to its first words. */
export function photoTitle(subject: string, MAX = 32): string {
  let t = subject.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const nick = t.match(/"([^"]+)"/)?.[1];
  if (t.length > MAX && nick && nick.length >= 5) return nick;
  t = t.replace(/\s*"[^"]*"/g, "").trim();
  const words = t.split(" ");
  while (words.join(" ").length > MAX && words.length > 2) words.pop();
  while (words.length > 1 && /^(and|of|&|for|the|a|in|or|\/)$/i.test(words[words.length - 1])) words.pop();
  return words.join(" ");
}

/** Photographs (data/photos/photos.json) in design order: see photoOrder. */
const PHOTO_DIR = path.resolve(__dirname, "..", "data", "photos");
function photoQueue(): Map<number, { index: number; photo: PhotoSource }> {
  const all: PhotoSource[] = JSON.parse(readFileSync(path.join(PHOTO_DIR, "photos.json"), "utf8"));
  nameSubjects([...new Set(all.map((p) => p.subject))].sort());
  return new Map(photoOrder(all, PER_CATEGORY).map(({ n, index, photo }) => [n, { index, photo }]));
}

/** "Roshan Patel, Smithsonian's National Zoo" → "Roshan Patel"; a unit-only credit names no one. */
const photographer = (credit: string) => {
  const [who, ...rest] = credit.split(/,\s*/);
  return rest.length && !/smithsonian|museum|zoo/i.test(who) ? who : null;
};

/** Categories whose designs may be knocked out of a solid ink block. */
const KNOCKOUT_OK: ShirtCategory[] = [...LEGACY_CATEGORIES, "slogans", "pixel", "objects", "ascii"];

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

const colourSplit = (rng: Rng, n: number): BaseColor[] =>
  shuffle(rng, [
    ...Array<BaseColor>(Math.round(n * BLACK_SHARE)).fill("black"),
    ...Array<BaseColor>(n - Math.round(n * BLACK_SHARE)).fill("white"),
  ]);

type Draft = Omit<CatalogEntry, "family" | "description" | "summary" | "similar" | "rank"> & { base: string };

/**
 * One name per subject. Where two different subjects shorten to the same
 * name (or to another's full name), both keep more words until they
 * differ — so ", Take 2" only ever means another photograph of the same thing.
 */
const PHOTO_TITLES = new Map<string, string>();
function nameSubjects(subjects: string[]) {
  const max = new Map(subjects.map((s) => [s, 32]));
  for (let round = 0; round < 12; round++) {
    const names = new Map(subjects.map((s) => [s, photoTitle(s, max.get(s))]));
    const bySubjects = new Map<string, Set<string>>();
    for (const [s, t] of names) bySubjects.set(t, (bySubjects.get(t) ?? new Set()).add(s));
    let clash = false;
    for (const [s, t] of names)
      if (bySubjects.get(t)!.size > 1 || (t !== s && subjects.includes(t))) {
        clash = true;
        max.set(s, max.get(s)! + 8);
      }
    if (!clash) {
      for (const [s, t] of names) PHOTO_TITLES.set(s, t);
      return;
    }
  }
  throw new Error("photo titles: couldn't tell some subjects apart");
}

/** The day the photographs dropped: the Monday of the week they were added. */
const PHOTO_DROP = "2026-09-21";

/**
 * One photograph as a design. Its print is the photograph itself —
 * greyscale, the whole picture — committed by scripts/photos
 * (public/prints/print_<n>.webp); this names it and reads its features
 * from the picture's own measures and its category. One file serves both
 * tee colours: on a black tee the picture's lights show (white ink), on a
 * white tee its darks (black ink) — the same positive either way, never an
 * inverted negative.
 */
function photoDesign(n: number, index: number, category: PhotoSource["category"], photo: PhotoSource, takenTitles: Set<string>): Draft {
  const file = path.join(PRINTS_DIR, `print_${n}.webp`);
  if (!existsSync(file)) throw new Error(`missing ${path.relative(ROOT, file)} (run scripts/photos/fetchPhotos.ts select)`);
  const frame = photo.mode === "frame";
  // The tee that shows more of the picture: a light picture on black, a dark one on white.
  const baseColor: BaseColor = photo.tone >= 0.5 ? "black" : "white";
  const shown = baseColor === "black" ? photo.tone : 1 - photo.tone;
  const dial = /indicator|gauge|meter|compass|clock|altimeter|tachometer|horizon|barograph|recorder/i.test(photo.subject);
  const f: Partial<Record<FeatureKey, number>> = {
    photographic: 0.95,
    pictorial: 0.7,
    halftone_raster: 0.1,
    line_art: 0.05,
    density: Math.min(1, photo.coverage * shown * 2.2),
    contrast: Math.min(1, 0.2 + photo.contrast * 2.4),
    clean_minimal: frame ? 0.15 : 0.55,
    abstract: 0.05,
    nature: category === "wildlife" ? 0.9 : 0,
    figurative: category === "wildlife" ? 0.35 : 0,
    dark_industrial: category === "machines" ? 0.6 : category === "flight" ? 0.35 : 0.05,
    retro: category === "wildlife" ? 0 : 0.45,
    geometric: category === "machines" && dial ? 0.35 : 0.05,
    architectural: category === "flight" ? 0.1 : 0,
  };
  // Same colourway adjustment as every other design.
  if (baseColor === "black") (f.dark_industrial! += 0.12), (f.clean_minimal! -= 0.05);
  else (f.clean_minimal! += 0.12), (f.dark_industrial! -= 0.08);

  // A second photograph of the same subject is its second take (renamed by rank below).
  const first = PHOTO_TITLES.get(photo.subject)!;
  let title = first;
  for (let k = 2; takenTitles.has(title); k++) title = `${first}, Take ${k}`;
  takenTitles.add(title);

  const by = photographer(photo.credit);
  const where =
    photo.unit === "nzp"
      ? `photographed${by ? ` by ${by}` : ""} at the Smithsonian's National Zoo`
      : `from the National Air and Space Museum, photographed ${frame ? "on display" : "against a plain backdrop and cut out"}`;
  // Quality from the picture: how much of the print it fills, its tonal range, its detail.
  const quality = Math.round(100 * (0.3 * Math.min(1, photo.coverage / 0.35) + 0.35 * Math.min(1, photo.contrast * 3.5) + 0.35 * Math.min(1, photo.detail * 1.5)));
  const [x0, y0, x1, y1] = photo.box;
  return {
    id: `mono-${String(n).padStart(4, "0")}`,
    n,
    no: index,
    sku: `MN-${SKU_CODES[category]}-${baseColor === "black" ? "B" : "W"}-${String(n).padStart(4, "0")}`,
    title,
    price: PRICE,
    baseColor,
    backPrintUrl: `/prints/print_${n}.webp`,
    category,
    variant: `photo-${category}-${photo.mode}`,
    base: `${photo.subject}, ${where}, printed in greyscale.`,
    subject: photo.subject,
    style: STYLE[category],
    quality,
    printCm: { width: Math.max(1, Math.round((x1 - x0) * 28)), height: Math.max(1, Math.round((y1 - y0) * 37)) },
    features: vector(f),
    photo: { credit: photo.credit, url: recordUrl(photo.record), image: photo.key },
    dropDate: PHOTO_DROP,
  };
}

function main() {
  // Exactly 70% black / 30% white in each set. The first shuffle is the
  // original one, so ids 1–1000 keep their colours (and so on per set).
  // Photographs pick their colour from their own tones (below).
  const colorSeeds = [SEED, SEED ^ 0x2000, SEED ^ 0x3000];
  const colors = SETS.flatMap((set, k) => (set.photo ? Array<BaseColor>(set.size).fill("black") : colourSplit(mulberry32(colorSeeds[k]), set.size)));
  const photos = photoQueue();
  const total = colors.length;
  if (total !== TOTAL) throw new Error(`sets add up to ${total} designs, expected ${TOTAL}`);

  // The drawn prints are rewritten; the photographs' prints (.webp) are inputs.
  mkdirSync(PRINTS_DIR, { recursive: true });
  for (const f of readdirSync(PRINTS_DIR)) if (f.endsWith(".svg")) rmSync(path.join(PRINTS_DIR, f));
  mkdirSync(path.dirname(DATA_FILE), { recursive: true });

  const counters = Object.fromEntries(SETS.flatMap((set) => set.cats).map((c) => [c, 0])) as Record<ShirtCategory, number>;
  const shirts: Draft[] = [];
  const sigs: Signature[] = [];
  let bytes = 0;
  const takenTitles = new Set<string>();
  const spareTitle: Partial<Record<ShirtCategory, number>> = {};

  for (let i = 0; i < total; i++) {
    const n = i + 1;
    let setStart = 0;
    let setIdx = 0;
    while (i >= setStart + SETS[setIdx].size) setStart += SETS[setIdx++].size;
    const set = SETS[setIdx];
    const isNew = !set.legacy;
    // Interleave categories so neighbouring ids differ in style.
    const category = set.cats[(i - setStart) % set.cats.length];
    const index = ++counters[category];

    if (set.photo) {
      const { photo, index: at } = photos.get(n)!;
      if (at !== index || photo.category !== category) throw new Error(`photo order out of step at ${n}`);
      const shirt = photoDesign(n, index, photo.category, photo, takenTitles);
      bytes += statSync(path.join(PRINTS_DIR, `print_${n}.webp`)).size;
      sigs.push({ key: `photo|${category}|${shirt.subject.toLowerCase()}`, vec: [] });
      shirts.push(shirt);
      continue;
    }

    const gens = set.generatorsFor(category);
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

    const svg = minifySvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
      `<rect width="${W}" height="${H}" fill="${ground}"/>` +
      (knockout ? `<rect x="${M / 2}" y="${M / 2}" width="${W - M}" height="${H - M}" fill="${ink}"/>` : "") +
      design.body +
      fr.svg +
      `</svg>`,
    );
    writeFileSync(path.join(PRINTS_DIR, `print_${n}.svg`), svg);
    // A knocked-out block reads completely differently from the plain print.
    sigs.push({ key: `${design.sig.key}|${knockout ? "ko" : "std"}`, vec: design.sig.vec });
    bytes += svg.length;

    // Titles carry no number (that's `no`, shown small, and part of the SKU).
    // (adj, noun) = (i mod A, (⌊i/A⌋ + i) mod N) is one-to-one for i < A·N,
    // so every title is unique within its category and pairs are spread out.
    // A pair another category already used moves to one of this category's
    // spare combinations (taken from the top, past its designs; checked after
    // the loop), keeping titles unique across the catalog.
    const [adjs, nouns] = TITLE_WORDS[category as DrawnCategory];
    const combos = adjs.length * nouns.length;
    const titleAt = (k: number) => `${adjs[k % adjs.length]} ${nouns[(Math.floor(k / adjs.length) + k) % nouns.length]}`;
    // What the print shows, read from its own description (the SEO title
    // and, where the poetic nouns said nothing, the name's noun).
    const { subject, noun } = subjectOf(design.variant, design.description);
    // Also skip pairs that repeat a word ("Postcard Postcard").
    const repeats = (t: string) => new Set(t.toLowerCase().split(" ")).size < t.split(" ").length;
    let title = "";
    if (noun && SUBJECT_NOUN_CATEGORIES.includes(category)) {
      // "Lucky Cactus", "Proud Barista": the adjective rotates, the noun is the subject.
      // All fifteen taken for this noun: the full subject ("Pocket Umbrella Diagram").
      for (const n of noun === subject ? [noun] : [noun, subject])
        for (let k = 0; k < adjs.length && !title; k++) {
          const t = `${adjs[(index - 1 + k) % adjs.length]} ${n}`;
          if (!takenTitles.has(t) && !repeats(t)) title = t;
        }
    }
    if (!title) {
      title = titleAt(index - 1);
      while (takenTitles.has(title) || repeats(title)) {
        const spare = (spareTitle[category] ?? combos) - 1;
        spareTitle[category] = spare;
        title = titleAt(spare);
      }
    }
    takenTitles.add(title);
    const { quality, printCm } = measurePrint(svg, baseColor);

    shirts.push({
      id: `mono-${String(n).padStart(4, "0")}`,
      n,
      no: index,
      sku: `MN-${SKU_CODES[category]}-${baseColor === "black" ? "B" : "W"}-${String(n).padStart(4, "0")}`,
      title,
      price: PRICE,
      baseColor,
      backPrintUrl: `/prints/print_${n}.svg`,
      category,
      variant: design.variant,
      // No ink colour here: every design is sold in both colourways.
      base: knockout ? `${sentence(design.description)} Knocked out of a solid ink block.` : design.description,
      subject,
      style: STYLE[category],
      quality,
      printCm,
      features,
      dropDate: new Date(DROP_EPOCH + Math.floor((n - 1) / DROP_SIZE) * 7 * DAY).toISOString().slice(0, 10),
    });
  }

  // Retire the designs the content review took out (scripts/gen/retire):
  // everything above was generated in full, so the rest keep their ids,
  // titles and prints. Their prints (drawn) are removed; `no` renumbers.
  const retired = retiredIds(shirts);
  for (let k = shirts.length - 1; k >= 0; k--) {
    if (!retired.has(shirts[k].id)) continue;
    if (!shirts[k].photo) rmSync(path.join(PRINTS_DIR, `print_${shirts[k].n}.svg`), { force: true });
    shirts.splice(k, 1);
    sigs.splice(k, 1);
  }
  const perCategory: Partial<Record<ShirtCategory, number>> = {};
  for (const s of shirts) s.no = perCategory[s.category] = (perCategory[s.category] ?? 0) + 1;

  const familyIndex = assignFamilies(sigs);
  const descriptions = finishDescriptions(
    shirts.map((s) => ({ base: s.base, category: s.category, rng: mulberry32((SEED ^ 0x5eed) + Math.imul(s.n, 2654435761)) })),
  );
  const ranks = editorialRanks(shirts.map((s) => s.features), shirts.map((s) => s.quality));
  const withFamily = shirts.map(({ base, ...s }, i) => ({
    ...s,
    family: `fam-${String(familyIndex[i] + 1).padStart(4, "0")}`,
    // `summary`: the design's own sentence (meta descriptions); `description`
    // adds the closing line about how it wears (the product page).
    summary: sentence(base),
    description: descriptions[i],
    rank: ranks[i],
  }));
  // Takes of one subject: the plain name goes to the one the shop shows
  // first (best rank), the rest are its later takes.
  const takes = new Map<string, typeof withFamily>();
  for (const s of withFamily) if (s.photo) takes.set(s.subject, [...(takes.get(s.subject) ?? []), s]);
  for (const list of takes.values()) {
    const base = list[0].title.replace(/, Take \d+$/, "");
    if (list.length < 2) {
      list[0].title = base; // the only photograph left of its subject
      continue;
    }
    [...list].sort((a, b) => a.rank - b.rank).forEach((s, k) => (s.title = k === 0 ? base : `${base}, Take ${k + 1}`));
  }
  const similar = neighbours(withFamily);
  const catalog: CatalogEntry[] = withFamily.map((s, i) => ({ ...s, similar: similar[i] }));
  const calibration = calibrationIds(catalog);

  // Full catalog, one object per line: diff-friendly but compact.
  writeFileSync(DATA_FILE, `[\n${catalog.map((s) => JSON.stringify(s)).join(",\n")}\n]\n`);
  writeIndex(catalog, calibration, writeShards(catalog));

  for (const [c, spare] of Object.entries(spareTitle)) {
    if (spare < counters[c as ShirtCategory]) throw new Error(`not enough title words for ${c}`);
  }

  const sizes = new Map<string, number>();
  for (const s of catalog) sizes.set(s.family, (sizes.get(s.family) ?? 0) + 1);
  const newFamilies = new Set(catalog.slice(PER_SET).map((s) => s.family)).size;
  const set3Families = new Set(catalog.slice(PER_SET * 2, PER_SET * 2 + SET3_CATEGORIES.length * SET3_PER_CATEGORY).map((s) => s.family)).size;
  const photoFamilies = new Set(catalog.filter((s) => s.photo).map((s) => s.family)).size;
  const black = shirts.filter((s) => s.baseColor === "black").length;
  const titles = new Set(shirts.map((s) => s.title)).size;
  console.log(`Generated ${shirts.length} shirts → ${path.relative(ROOT, DATA_FILE)}`);
  console.log(`  photographs: ${PHOTO_CATEGORIES.length * PER_CATEGORY} (greyscale WebP prints, one per design)`);
  console.log(`  prints: ${shirts.length} SVGs in ${path.relative(ROOT, PRINTS_DIR)} (${(bytes / 1024 / 1024).toFixed(2)} MB, avg ${(bytes / shirts.length / 1024).toFixed(1)} KB)`);
  console.log(`  colours: ${black} black / ${shirts.length - black} white · unique titles: ${titles}`);
  console.log(`  families: ${sizes.size} (${sizes.size - newFamilies} original, ${newFamilies - set3Families - photoFamilies} second set, ${set3Families} third set, ${photoFamilies} photographs)`);
  console.log(`  categories: ${Object.entries(counters).map(([c, n]) => `${c} ${n}`).join(" · ")}`);
  const uniqueDesc = new Set(catalog.map((s) => s.description)).size;
  console.log(`  descriptions: ${uniqueDesc} unique · index ${(statSync(INDEX_FILE).size / 1024).toFixed(0)} KB · shards ${Math.ceil(catalog[catalog.length - 1].n / SHARD_SIZE)} · retired ${retired.size}`);
  console.log(`  price: $${PRICE} · calibration: ${calibration.join(" ")}`);
  console.log(`  quality: ${catalog.filter((s) => s.quality < WEAK_QUALITY).length} weak prints (< ${WEAK_QUALITY}) · drops ${catalog[0].dropDate} → ${catalog[catalog.length - 1].dropDate}`);
}

/* ------------------------------------------------------------------ */
/* Precomputed data                                                    */
/* ------------------------------------------------------------------ */

type Features = CatalogEntry["features"];

/**
 * Editorial order for the "Popular" sort (a fixed ranking, not usage data):
 * designs closest to the catalog's centre of gravity — broadly appealing —
 * first, nudged towards bold, readable prints.
 */
function editorialRanks(features: Features[], quality: number[]): number[] {
  const mean = Object.fromEntries(FEATURE_KEYS.map((k) => [k, features.reduce((sum, f) => sum + f[k], 0) / features.length])) as Features;
  // Weak prints (a lone small shape) sink below every strong one.
  const score = features.map((f, i) => ({ i, v: cosineSimilarity(f, mean) / 100 + 0.3 * f.contrast + 0.1 * f.wit + 0.2 * (quality[i] / 100) - (quality[i] < WEAK_QUALITY ? 10 : 0) }));
  score.sort((a, b) => b.v - a.v || a.i - b.i);
  const ranks = new Array<number>(features.length);
  score.forEach(({ i }, r) => (ranks[i] = r));
  return ranks;
}

/** Top neighbours by centered cosine: other families only, one per algorithm. */
function neighbours(list: Omit<CatalogEntry, "similar">[]): string[][] {
  return list.map((s) => {
    const sims = list
      .filter((o) => o.family !== s.family)
      .map((o) => ({ o, sim: centeredCosine(s.features, o.features) }))
      .sort((a, b) => b.sim - a.sim || a.o.n - b.o.n);
    const out: string[] = [];
    const variants = new Set([s.variant]);
    for (const { o } of sims) {
      if (variants.has(o.variant)) continue;
      variants.add(o.variant);
      out.push(o.id);
      if (out.length === SIMILAR_K) break;
    }
    return out;
  });
}

/**
 * The taste test (see lib/deck): one design per family, covering as many
 * categories as there are slots, at least one photograph, boldest first. Precomputed so the app
 * doesn't run farthest-point sampling on every load.
 */
function calibrationIds(catalog: CatalogEntry[]): string[] {
  const leaders = new Map<string, CatalogEntry>();
  // Families led by their first strong design; weak prints never rate taste.
  for (const s of catalog) if (s.quality >= WEAK_QUALITY && !leaders.has(s.family)) leaders.set(s.family, s);
  const queue = getCalibrationQueue([...leaders.values()], CALIBRATION_SIZE, (s) => s.category, isPhoto);
  const bold = (s: CatalogEntry) => s.features.contrast + s.features.density;
  const opener = queue.reduce((best, s) => (bold(s) > bold(best) ? s : best), queue[0]);
  return [opener, ...queue.filter((s) => s !== opener)].map((s) => s.id);
}

/**
 * Lean index for the app bundle, stored by column (it gzips to a third of
 * the row form). Every column is in design order; `n` holds each design's
 * number (ids are mono-<n>; retired designs leave gaps):
 * family#, variant# and category# point into their tables, `white` is a
 * 0/1 string, `features` has one string per FEATURE_KEYS entry: character
 * k is design k's value ×100 (0–100) written as one symbol of `digits`
 * (101 symbols: printable ASCII without the backslash, then À–É).
 * `drop` is each design's drop date in days after `dropEpoch`; `weak` is a
 * 0/1 string (quality below WEAK_QUALITY). Derived, so not stored: `no`
 * (running count within the category). The head also carries `shardSize`
 * and the content hash of every detail shard (their file names). Decoded
 * by lib/catalog, which checks `v` and `keys`.
 */
const FEATURE_DIGITS =
  Array.from({ length: 92 }, (_, i) => String.fromCharCode(35 + i)).filter((c) => c !== "\\").join("") +
  Array.from({ length: 10 }, (_, i) => String.fromCharCode(0xc0 + i)).join("");
if (FEATURE_DIGITS.length !== 101) throw new Error("feature digits must cover 0–100");

function writeIndex(catalog: CatalogEntry[], calibration: string[], shards: string[]) {
  const seen: Partial<Record<ShirtCategory, number>> = {};
  catalog.forEach((s, i) => {
    const no = (seen[s.category] = (seen[s.category] ?? 0) + 1);
    if ((i > 0 && s.n <= catalog[i - 1].n) || s.no !== no) throw new Error(`index can't derive ${s.id}`);
  });
  const variants = [...new Set(catalog.map((s) => s.variant))];
  const categories = [...new Set(catalog.map((s) => s.category))];
  const col = <T>(f: (s: CatalogEntry) => T) => catalog.map(f);
  const columns = {
    // Design numbers (ids are mono-<n>): increasing, with gaps where designs were retired.
    n: col((s) => s.n),
    family: col((s) => Number(s.family.slice(4))),
    variant: col((s) => variants.indexOf(s.variant)),
    category: col((s) => categories.indexOf(s.category)),
    white: col((s) => (s.baseColor === "white" ? 1 : 0)).join(""),
    price: col((s) => s.price),
    title: col((s) => s.title),
    rank: col((s) => s.rank),
    drop: col((s) => Math.round((Date.parse(`${s.dropDate}T00:00:00Z`) - DROP_EPOCH) / DAY)),
    weak: col((s) => (s.quality < WEAK_QUALITY ? 1 : 0)).join(""),
    features: FEATURE_KEYS.map((k) => col((s) => FEATURE_DIGITS[Math.round(s.features[k] * 100)]).join("")),
  };
  const head = {
    v: INDEX_VERSION,
    keys: FEATURE_KEYS,
    digits: FEATURE_DIGITS,
    variants,
    categories,
    calibration,
    dropEpoch: new Date(DROP_EPOCH).toISOString().slice(0, 10),
    shardSize: SHARD_SIZE,
    shards,
  };
  const body = Object.entries({ ...head, ...columns }).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`);
  writeFileSync(INDEX_FILE, `{\n${body.join(",\n")}\n}\n`);
}

/** Index format version (lib/catalog refuses any other). */
const INDEX_VERSION = 4;

/**
 * public/data/details-<k>.<hash>.json: { id: { d: description, s: similar
 * ids, t: subject, p: [print width, height] cm } } per SHARD_SIZE designs.
 * The content hash in the name lets them be cached forever; the index lists
 * the hashes. Returns them.
 */
function writeShards(catalog: CatalogEntry[]): string[] {
  rmSync(SHARD_DIR, { recursive: true, force: true });
  mkdirSync(SHARD_DIR, { recursive: true });
  // Shard k holds designs n = k·SHARD_SIZE+1 … (k+1)·SHARD_SIZE (lib/catalog shardOf).
  const count = Math.ceil(catalog[catalog.length - 1].n / SHARD_SIZE);
  const hashes: string[] = [];
  for (let k = 0; k < count; k++) {
    const part = Object.fromEntries(
      catalog
        .filter((s) => Math.floor((s.n - 1) / SHARD_SIZE) === k)
        .map((s) => [s.id, { d: s.description, s: s.similar, t: s.subject, p: [s.printCm.width, s.printCm.height], ...(s.photo ? { c: s.photo.credit, u: s.photo.url } : {}) }]),
    );
    const json = JSON.stringify(part);
    const hash = createHash("sha256").update(json).digest("hex").slice(0, 10);
    writeFileSync(path.join(SHARD_DIR, `details-${k}.${hash}.json`), json);
    hashes.push(hash);
  }
  return hashes;
}

main();
