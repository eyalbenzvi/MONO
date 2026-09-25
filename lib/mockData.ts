import type { BaseColor, FeatureVector, ShirtProduct } from "@/types/shirt";

/**
 * Compact constructor, in FEATURE_KEYS order:
 * geometric, typography, architectural, abstract, line_art,
 * halftone_raster, density, contrast, dark_industrial, clean_minimal
 */
const f = (...v: number[]): FeatureVector => {
  if (v.length !== 10) throw new Error(`feature vector needs 10 values, got ${v.length}`);
  const [geometric, typography, architectural, abstract, line_art, halftone_raster, density, contrast, dark_industrial, clean_minimal] = v;
  return { geometric, typography, architectural, abstract, line_art, halftone_raster, density, contrast, dark_industrial, clean_minimal };
};

const unsplash = (photoId: string, w: number, h: number) =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${w}&h=${h}&q=80&sat=-100`;

interface Seed {
  title: string;
  artist: string;
  price: number;
  baseColor: BaseColor;
  photo: string;
  description: string;
  features: FeatureVector;
}

const seeds: Seed[] = [
  {
    title: "Brutal Grid 01",
    artist: "Studio Béton",
    price: 42,
    baseColor: "black",
    photo: "photo-1486325212027-8081e485255e",
    description: "Stacked concrete facade shot straight-on, printed as a hard-edged rectangle.",
    features: f(0.8, 0.05, 0.95, 0.2, 0.3, 0.2, 0.75, 0.8, 0.85, 0.2),
  },
  {
    title: "White Facade",
    artist: "Ren Okada",
    price: 38,
    baseColor: "white",
    photo: "photo-1487958449943-2429e8be8625",
    description: "Curved white architecture with long shadows. Quiet, airy, almost empty.",
    features: f(0.6, 0.0, 0.9, 0.35, 0.45, 0.05, 0.2, 0.55, 0.1, 0.9),
  },
  {
    title: "Stairwell Spiral",
    artist: "Nadia Koss",
    price: 45,
    baseColor: "black",
    photo: "photo-1511818966892-d7d671e672a2",
    description: "Looking down a spiral stairwell — geometry that pulls you in.",
    features: f(0.9, 0.0, 0.8, 0.5, 0.55, 0.1, 0.6, 0.85, 0.5, 0.45),
  },
  {
    title: "Paper Folds",
    artist: "Mille Aarup",
    price: 36,
    baseColor: "white",
    photo: "photo-1518005020951-eccb494ad742",
    description: "Folded white planes and soft gradients. Minimal to the bone.",
    features: f(0.55, 0.0, 0.5, 0.7, 0.2, 0.05, 0.15, 0.3, 0.05, 0.95),
  },
  {
    title: "Fog Horizon",
    artist: "Ivo Marrel",
    price: 34,
    baseColor: "white",
    photo: "photo-1470071459604-3b5ec3a7fe05",
    description: "Hills dissolving into fog. Tonal, grainy, meditative.",
    features: f(0.05, 0.0, 0.0, 0.6, 0.1, 0.55, 0.35, 0.25, 0.15, 0.75),
  },
  {
    title: "Night Field",
    artist: "Observatory Club",
    price: 40,
    baseColor: "black",
    photo: "photo-1419242902214-272b3f66ee7a",
    description: "A dense star field rendered as fine speckle — reads as halftone noise.",
    features: f(0.1, 0.0, 0.0, 0.7, 0.05, 0.9, 0.9, 0.7, 0.4, 0.3),
  },
  {
    title: "Tower Canyon",
    artist: "K. Albrecht",
    price: 44,
    baseColor: "black",
    photo: "photo-1480714378408-67cf0d13bc1b",
    description: "Skyscraper canyon, crushed blacks, industrial density.",
    features: f(0.6, 0.1, 0.9, 0.15, 0.25, 0.35, 0.9, 0.85, 0.9, 0.1),
  },
  {
    title: "Skyline Silhouette",
    artist: "Mara Velt",
    price: 39,
    baseColor: "white",
    photo: "photo-1477959858617-67f85cf4f1df",
    description: "Wide city skyline flattened to a graphic silhouette band.",
    features: f(0.5, 0.05, 0.85, 0.2, 0.35, 0.3, 0.55, 0.75, 0.55, 0.4),
  },
  {
    title: "Wave Study",
    artist: "Tide Office",
    price: 37,
    baseColor: "black",
    photo: "photo-1509114397022-ed747cca3f65",
    description: "Liquid contour lines of a breaking wave, printed as flowing line art.",
    features: f(0.2, 0.0, 0.05, 0.85, 0.8, 0.2, 0.5, 0.65, 0.2, 0.5),
  },
  {
    title: "Peak Contrast",
    artist: "Alpine Press",
    price: 41,
    baseColor: "black",
    photo: "photo-1464822759023-fed622ff2c3b",
    description: "Snow ridges against a black sky. Maximum tonal contrast.",
    features: f(0.35, 0.0, 0.1, 0.45, 0.3, 0.25, 0.45, 0.98, 0.35, 0.45),
  },
  {
    title: "Valley Grain",
    artist: "Ivo Marrel",
    price: 35,
    baseColor: "white",
    photo: "photo-1506744038136-46273834b3fb",
    description: "Granite valley reduced to coarse newsprint-style grain.",
    features: f(0.15, 0.0, 0.2, 0.4, 0.15, 0.85, 0.7, 0.6, 0.3, 0.35),
  },
  {
    title: "Night Signal",
    artist: "K. Albrecht",
    price: 43,
    baseColor: "black",
    photo: "photo-1444723121867-7a241cacace9",
    description: "City lights at night — a raster of bright points on deep black.",
    features: f(0.3, 0.15, 0.6, 0.35, 0.1, 0.75, 0.85, 0.9, 0.8, 0.1),
  },
  {
    title: "Street Grid",
    artist: "Mara Velt",
    price: 38,
    baseColor: "white",
    photo: "photo-1449824913935-59a10b8d2000",
    description: "Aerial street grid — a map-like pattern of blocks and lines.",
    features: f(0.85, 0.1, 0.7, 0.2, 0.65, 0.2, 0.7, 0.6, 0.45, 0.3),
  },
  {
    title: "Ridge Lines",
    artist: "Alpine Press",
    price: 36,
    baseColor: "white",
    photo: "photo-1493246507139-91e8fad9978e",
    description: "Layered mountain ridges traced into clean receding lines.",
    features: f(0.2, 0.0, 0.05, 0.5, 0.85, 0.1, 0.3, 0.45, 0.1, 0.8),
  },
  {
    title: "Type Specimen",
    artist: "Grotesk Supply",
    price: 46,
    baseColor: "white",
    photo: "photo-1455390582262-044cdead277a",
    description: "Letterpress blocks and specimen type. Pure typography print.",
    features: f(0.4, 0.98, 0.05, 0.15, 0.3, 0.2, 0.55, 0.8, 0.25, 0.6),
  },
  {
    title: "Manifesto",
    artist: "Grotesk Supply",
    price: 48,
    baseColor: "black",
    photo: "photo-1504711434969-e33886168f5c",
    description: "Dense newsprint columns — a wall of text as texture.",
    features: f(0.3, 0.9, 0.1, 0.25, 0.15, 0.6, 0.95, 0.75, 0.7, 0.05),
  },
  {
    title: "Neon Words",
    artist: "Late Shift",
    price: 44,
    baseColor: "black",
    photo: "photo-1516450360452-9312f5e86fc7",
    description: "Night sign lettering, blown out into glowing monochrome glyphs.",
    features: f(0.25, 0.85, 0.3, 0.4, 0.45, 0.2, 0.5, 0.95, 0.65, 0.2),
  },
  {
    title: "Monolith",
    artist: "Studio Béton",
    price: 50,
    baseColor: "white",
    photo: "photo-1494145904049-0dca59b4bbad",
    description: "A single dark slab against open sky. Almost nothing, very loud.",
    features: f(0.7, 0.0, 0.75, 0.3, 0.05, 0.05, 0.1, 0.95, 0.55, 0.85),
  },
  {
    title: "Steel Truss",
    artist: "Foundry 9",
    price: 47,
    baseColor: "black",
    photo: "photo-1513828583688-c52646db42da",
    description: "Bridge truss cross-bracing — rivets, beams, rust turned to grey.",
    features: f(0.75, 0.0, 0.8, 0.1, 0.7, 0.15, 0.7, 0.8, 0.95, 0.05),
  },
  {
    title: "Smoke Form",
    artist: "Vapor Lab",
    price: 39,
    baseColor: "black",
    photo: "photo-1507608616759-54f48f0af0ee",
    description: "Drifting smoke on black. Organic, soft-edged, pure abstraction.",
    features: f(0.0, 0.0, 0.0, 0.98, 0.35, 0.3, 0.3, 0.7, 0.35, 0.55),
  },
  {
    title: "Ink Bloom",
    artist: "Vapor Lab",
    price: 37,
    baseColor: "white",
    photo: "photo-1541701494587-cb58502866ab",
    description: "Ink dispersing in water, flattened into a single tone.",
    features: f(0.05, 0.0, 0.0, 0.95, 0.2, 0.45, 0.6, 0.55, 0.15, 0.4),
  },
  {
    title: "Radial Pulse",
    artist: "Op Unit",
    price: 42,
    baseColor: "white",
    photo: "photo-1550684376-efcbd6e3f031",
    description: "Concentric op-art rings. Geometric line work that vibrates.",
    features: f(0.95, 0.0, 0.1, 0.6, 0.9, 0.1, 0.65, 0.9, 0.2, 0.5),
  },
  {
    title: "Soft Gradient",
    artist: "Op Unit",
    price: 33,
    baseColor: "white",
    photo: "photo-1557672172-298e090bd0f1",
    description: "A smooth tonal gradient. The quietest print in the drop.",
    features: f(0.1, 0.0, 0.0, 0.55, 0.0, 0.15, 0.05, 0.15, 0.0, 0.98),
  },
  {
    title: "Dither Field",
    artist: "Raster Dept.",
    price: 40,
    baseColor: "black",
    photo: "photo-1579546929518-9e396f3cc809",
    description: "Gradient crushed into ordered dither — pure 1-bit halftone.",
    features: f(0.45, 0.0, 0.0, 0.5, 0.05, 0.98, 0.8, 0.85, 0.5, 0.3),
  },
  {
    title: "Blueprint",
    artist: "Foundry 9",
    price: 45,
    baseColor: "white",
    photo: "photo-1503387762-592deb58ef4e",
    description: "Technical drawing: plans, section lines and dimensioning.",
    features: f(0.8, 0.35, 0.85, 0.05, 0.95, 0.0, 0.55, 0.6, 0.35, 0.65),
  },
];

export const MOCK_SHIRTS: ShirtProduct[] = seeds.map((s, i) => ({
  id: `mono-${String(i + 1).padStart(3, "0")}`,
  title: s.title,
  artist: s.artist,
  price: s.price,
  baseColor: s.baseColor,
  description: s.description,
  backImageUrl: unsplash(s.photo, 720, 960),
  frontImageUrl: unsplash(s.photo, 240, 240),
  features: s.features,
}));

export const getShirtById = (id: string) => MOCK_SHIRTS.find((s) => s.id === id);
