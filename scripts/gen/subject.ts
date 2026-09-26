/**
 * What a print shows, in a few words ("Solar Eclipse", "Potted Cactus",
 * "Great Wave Homage"), read from the same sentence that describes it — so
 * the name, the page title and the description never disagree. Used for the
 * SEO title ("Northern Pines — Solar Eclipse Line-Art Tee | MONO"), and for
 * the title noun in categories whose poetic nouns said nothing ("Everyday
 * Relic" → "Everyday Cactus").
 */
import type { SourceCategory } from "../../types/shirt";

/** Title Case, small words lower-case after the first ("Moonrise over the Sea"). */
const title = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, p, c) => p + c.toUpperCase())
    .replace(/(?!^)\b(A|An|The|Of|And|In|With|By|To|Over|On)\b/g, (w) => w.toLowerCase())
    .replace(/\bDna\b/, "DNA")
    .replace(/\bUfo\b/, "UFO");

const quoted = (base: string) => base.match(/[“"]([^”"]+)[”"]/)?.[1];
const pick = (base: string, re: RegExp) => base.match(re)?.[1]?.trim();
/** Drop a leading article and "pair(s) of". */
const noun = (s: string) => s.replace(/^(a|an|the)\s+/i, "").replace(/^pairs? of\s+/i, "");

/** The print's subject, and (for some categories) the noun its name should carry. */
export function subjectOf(variant: string, base: string): { subject: string; noun?: string } {
  const b = base;
  switch (variant) {
    case "facade":
      return { subject: "Brutalist Facade" };
    case "perspective":
      return { subject: "Perspective Corridor" };
    case "skyline":
      return { subject: "City Skyline" };
    case "slabs":
      return { subject: "Cantilevered Slabs" };
    case "monoform":
      return { subject: "Primary Form" };
    case "scatter":
      return { subject: "Scattered Shapes" };
    case "concentric":
      return { subject: `Concentric ${title(pick(b, /concentric (\w+)/i) ?? "polygons")}` };
    case "tiling":
      return { subject: "Truchet Tiles" };
    case "word":
      return { subject: `“${quoted(b) ?? "Word"}” Wordmark` };
    case "coordinates":
      return { subject: "Survey Coordinates" };
    case "repeat":
      return { subject: `“${quoted(b) ?? "Word"}” Repeat` };
    case "manifesto":
      return { subject: "Manifesto Columns" };
    case "radial":
      return { subject: "Halftone Burst" };
    case "gradient":
      return { subject: "Halftone Gradient" };
    case "matrix":
      return { subject: `Dot-Matrix ${title(pick(b, /dot-matrix (\w+)/i) ?? "shape")}` };
    case "stipple":
      return { subject: "Stippled Grain" };
    case "ridges":
      return { subject: "Pulsar Ridges" };
    case "interference":
      return { subject: "Sine Moiré" };
    case "contours":
      return { subject: "Topographic Contours" };
    case "gesture":
      return { subject: "Gestural Line" };
    case "mountains":
      return { subject: /\bmoon\b/i.test(b) ? "Mountains by Moonlight" : /\bsun\b/i.test(b) ? "Mountains at Sunrise" : "Mountain Ranges" };
    case "celestial":
      return {
        subject: /eclipse/i.test(b) ? "Solar Eclipse" : /planet/i.test(b) ? "Ringed Planet" : /crescent/i.test(b) ? "Crescent Moon" : /moon/i.test(b) ? "Moon Phase" : "Night Sky",
      };
    case "seascape":
      return { subject: "Sunset over the Sea" };
    case "dunes":
      return { subject: /moon/i.test(b) ? "Dunes by Moonlight" : "Desert Dunes" };
    case "forest":
      return { subject: /moon/i.test(b) ? "Pine Forest by Moonlight" : "Pine Forest" };
    case "poster":
      return { subject: "Slogan Poster" };
    case "warning":
      return { subject: "Warning Sign" };
    case "receipt":
      return { subject: "Joke Receipt" };
    case "quote":
      return { subject: "Serif Quote" };
    case "sprite": {
      const what = pick(b, /8-bit (\w+) sprite/i);
      return { subject: `${title(what ?? "pixel")} Sprite` };
    }
    case "gamescreen":
      return { subject: "Arcade Screen" };
    case "pixelscape":
      return { subject: "Pixel Sunset" };
    case "ascii":
      return { subject: "ASCII Sphere" };
    case "terminal":
      return { subject: "Terminal Session" };
    case "badge":
      return { subject: "Club Badge" };
    case "crest":
      return { subject: "Heraldic Crest" };
    case "stamp":
      return { subject: "Postage Stamp" };
    case "ticket":
      return { subject: "Ticket Stub" };
    case "label":
      return { subject: "Product Label" };
    case "objecticon": {
      const thing = noun(pick(b, /line-drawn (.+?) with the caption/i) ?? "object");
      return { subject: title(thing), noun: title(thing) };
    }
    case "woodcut": {
      const thing = noun(pick(b, /linocut-style (.+?)(?: against| hatched|,)/i) ?? "object");
      return { subject: `${title(thing)} Linocut`, noun: title(thing) };
    }
    case "oddoneout": {
      const things = pick(b, /grid of (.+?) —/i) ?? "things";
      return { subject: `Odd One Out: ${title(things)}`, noun: title(noun(things)) };
    }
    case "diagram": {
      const thing = noun(pick(b, /diagram of (.+?) with/i) ?? "object");
      return { subject: `${title(thing)} Diagram`, noun: title(thing) };
    }
    case "ascii-banner":
      return { subject: `“${quoted(b) ?? "Text"}” ASCII Banner` };
    case "ascii-shade":
      return { subject: `ASCII ${title(noun(pick(b, /^(.+?) rendered/i) ?? "solid"))}` };
    case "ascii-art":
      return { subject: `ASCII ${title(noun(pick(b, /hand-typed ascii (\w+(?: \w+)?)(?: in|:)/i) ?? "art"))}` };
    case "ascii-scene":
      return { subject: `ASCII ${title(noun(pick(b, /^(.+?), typed out/i) ?? "scene"))}` };
    case "caricature-portrait":
    case "caricature-wanted":
    case "caricature-mugshot":
    case "caricature-bobble": {
      const who = pick(b, /\bThe ([A-Z][\w-]*(?: [A-Z][\w-]*)*)/) ?? "Character";
      const kind = { "caricature-portrait": "Caricature", "caricature-wanted": "Wanted Poster", "caricature-mugshot": "Mugshot", "caricature-bobble": "Bobblehead" }[variant];
      return { subject: `${who} ${kind}`, noun: who };
    }
    case "art-wave":
      return { subject: "Great Wave Homage" };
    case "art-starry":
      return { subject: "Starry Night Homage" };
    case "art-kandinsky":
      return { subject: "Kandinsky Homage" };
    case "art-scream":
      return { subject: "The Scream Homage" };
    case "art-malevich":
      return { subject: "Malevich Homage" };
    case "art-vitruvian":
      return { subject: "Vitruvian Man Homage" };
    case "art-pearl":
      return { subject: "Pearl Earring Homage" };
    case "art-klimt":
      return { subject: "Tree of Life Homage" };
    case "art-mona":
      return { subject: "Mona Lisa Homage" };
    case "art-mondrian":
      return { subject: "Mondrian Homage" };
    case "iconic-landmark": {
      const place = pick(b, /^(.+?),[^—]*—/) ?? "Landmark";
      return { subject: title(noun(place)), noun: title(noun(place)) };
    }
    case "iconic-travel": {
      const raw = pick(b, /travel poster: (?:see|fly to|visit|explore|sail to|discover|go to|escape to) ([^.“"]+)/i) ?? pick(b, /travel poster: ([^.“"]+)/i) ?? "travel";
      const place = title(noun(raw.trim()));
      return { subject: `${place} Travel Poster`, noun: place };
    }
    case "iconic-astronaut":
      return { subject: "Astronaut Helmet", noun: "Astronaut" };
    case "iconic-earthrise":
      return { subject: "Earthrise", noun: "Earthrise" };
    case "iconic-launch":
      return { subject: "Rocket Launch", noun: "Rocket" };
    case "iconic-footprint":
      return { subject: "Moon Boot Print", noun: "Moonwalk" };
    default: {
      // Bold icons with a caption: "A bold anchor icon…".
      const icon = pick(b, /bold (.+?) icon/i);
      if (icon === "palm-and-sunset") return { subject: "Palm and Sunset Icon", noun: "Palms" };
      if (icon) return { subject: `${title(icon)} Icon`, noun: title(icon) };
      return { subject: title(variant.replace(/-/g, " ")) };
    }
  }
}

/** The print style, for the SEO title ("… Line-Art Tee"). */
export const STYLE: Record<SourceCategory, string> = {
  architectural: "Architectural",
  geometric: "Geometric",
  typography: "Typographic",
  halftone: "Halftone",
  waves: "Line-Art",
  scenes: "Line-Art",
  slogans: "Slogan",
  pixel: "Pixel-Art",
  emblems: "Badge",
  objects: "Illustrated",
  ascii: "ASCII-Art",
  caricatures: "Caricature",
  famousart: "Fine-Art",
  iconic: "Graphic",
  wildlife: "Photo",
  flight: "Photo",
  machines: "Photo",
  sky: "Star-Chart",
  curves: "Line-Art",
  botany: "Botanical",
  ornament: "Ornamental",
  archive: "Vintage",
};

/** Categories whose names take the subject's noun ("Lucky Cactus", "Proud Barista", "Famous Pyramids"). */
export const SUBJECT_NOUN_CATEGORIES: readonly SourceCategory[] = ["objects", "caricatures", "iconic"];
