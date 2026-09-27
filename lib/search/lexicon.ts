/**
 * What words in a query mean beyond themselves (English). Data only: a
 * phrase can suggest a facet (a chip the shopper accepts; its words still
 * search as text), widen a subject to related words, or lean on the design
 * features. Tuned against the final catalog later — keep it generic.
 * Phrases are matched on cleaned words, longest first.
 */
import type { FeatureKey } from "@/types/shirt";
import type { Facet } from "./facets";

export interface LexiconEntry {
  phrases: string[];
  facet?: Facet;
  expand?: string[];
  soft?: Partial<Record<FeatureKey, 1 | -1>>;
}

const era = (value: string, ...phrases: string[]): LexiconEntry => ({ phrases, facet: { kind: "era", value } });
const look = (value: string, ...phrases: string[]): LexiconEntry => ({ phrases, facet: { kind: "look", value } });
const subject = (phrases: string[], expand: string[]): LexiconEntry => ({ phrases, expand });

export const LEXICON: LexiconEntry[] = [
  // How it's made, and the tee.
  { phrases: ["photo", "photograph", "photography", "photographic"], facet: { kind: "medium", value: "photo" } },
  { phrases: ["drawn", "drawing", "illustration", "vector"], facet: { kind: "medium", value: "drawn" } },
  { phrases: ["archive", "museum", "antique print", "old print"], facet: { kind: "medium", value: "ink" } },
  { phrases: ["on black", "black tee", "black shirt", "black t shirt", "dark tee"], facet: { kind: "tee", value: "black" } },
  { phrases: ["on white", "white tee", "white shirt", "white t shirt", "light tee"], facet: { kind: "tee", value: "white" } },
  { phrases: ["new", "newest", "this week", "latest", "just in"], facet: { kind: "new", value: "week" } },

  // When.
  era("c14", "1300s", "14th century", "fourteenth century", "medieval"),
  era("c15", "1400s", "15th century", "fifteenth century"),
  era("c16", "1500s", "16th century", "sixteenth century", "renaissance"),
  era("c17", "1600s", "17th century", "seventeenth century", "baroque", "edo"),
  era("c18", "1700s", "18th century", "eighteenth century", "georgian"),
  era("c19", "1800s", "19th century", "nineteenth century", "victorian"),
  era("c20", "1900s", "20th century", "twentieth century"),
  era("d1850", "1850s"),
  era("d1860", "1860s"),
  era("d1870", "1870s"),
  era("d1880", "1880s"),
  era("d1890", "1890s"),
  era("d1900", "1900s decade"),
  era("d1910", "1910s"),
  era("d1920", "1920s", "art deco", "roaring twenties"),
  era("d1930", "1930s"),
  era("d1940", "1940s"),
  era("d1950", "1950s", "mid century"),
  era("d1960", "1960s"),
  era("d1970", "1970s"),

  // How it looks.
  look("minimal", "minimal", "minimalist", "clean"),
  look("bold", "bold", "high contrast", "striking"),
  look("dense", "dense", "busy", "packed"),
  look("airy", "airy", "sparse", "light touch"),
  look("line", "line art", "lineart", "outline"),
  look("halftone", "halftone", "dotted", "dots"),
  look("symmetric", "symmetric", "symmetrical", "mirrored"),
  look("detailed", "detailed", "intricate", "fine detail"),
  look("simple", "simple", "plain"),
  look("small", "small print", "small", "tiny", "subtle"),
  look("full", "full print", "big print", "large print", "all over"),
  look("wide", "wide", "landscape", "panoramic"),
  look("notext", "no text", "without text", "no words", "no lettering"),

  // Leanings (no facet, a nudge on the design features).
  { phrases: ["minimal", "clean", "simple", "understated"], soft: { clean_minimal: 1 } },
  { phrases: ["busy", "loud", "maximal"], soft: { density: 1 } },
  { phrases: ["funny", "joke", "witty", "humor", "humour", "pun"], soft: { wit: 1 } },
  { phrases: ["old", "vintage", "antique", "classic", "old school"], soft: { classic: 1, retro: 1 } },
  { phrases: ["retro", "nostalgic"], soft: { retro: 1 } },
  { phrases: ["nature", "natural", "organic", "outdoors"], soft: { nature: 1 } },
  { phrases: ["geometric", "geometry", "mathematical", "math", "maths"], soft: { geometric: 1 } },
  { phrases: ["abstract"], soft: { abstract: 1 } },
  { phrases: ["industrial", "mechanical", "technical"], soft: { dark_industrial: 1 } },
  { phrases: ["typographic", "typography", "lettering", "text", "words"], soft: { typography: 1 } },
  { phrases: ["figurative", "people", "portrait"], soft: { figurative: 1 } },
  { phrases: ["pictorial", "scene", "scenic"], soft: { pictorial: 1 } },
  { phrases: ["architectural", "architecture"], soft: { architectural: 1 } },
  { phrases: ["dark", "moody"], soft: { contrast: 1 } },
  { phrases: ["soft", "gentle", "calm", "quiet"], soft: { contrast: -1, density: -1 } },

  // Subjects: a word, and what else it means.
  subject(["space", "cosmos", "cosmic", "universe"], ["sky", "star", "planet", "moon", "rocket", "astronaut", "constellation", "orbit", "galaxy", "comet"]),
  subject(["astronomy", "astronomical"], ["star", "planet", "moon", "constellation", "orbit", "telescope", "eclipse"]),
  subject(["sky", "night sky", "stars"], ["star", "constellation", "moon", "planet"]),
  subject(["moon", "lunar"], ["moon", "phase", "eclipse", "crescent"]),
  subject(["sun", "solar"], ["sun", "solar", "eclipse", "daylight", "analemma"]),
  subject(["sea", "ocean", "maritime", "nautical", "marine"], ["ocean", "wave", "sail", "seascape", "ship", "boat", "harbor", "coast", "shore"]),
  subject(["wave", "waves", "surf"], ["wave", "ocean", "sea", "surf"]),
  subject(["boat", "ship", "sailing"], ["ship", "boat", "sail", "harbor", "yacht", "steamer"]),
  subject(["river", "lake", "water"], ["river", "lake", "stream", "bridge", "canal", "water"]),
  subject(["bird", "birds"], ["owl", "eagle", "heron", "hawk", "crane", "duck", "parrot", "sparrow", "swan", "egret", "pelican", "falcon", "gull", "bird"]),
  subject(["cat", "cats", "big cat"], ["tiger", "lion", "cheetah", "leopard", "panther", "lynx", "cat"]),
  subject(["dog", "dogs"], ["dog", "hound", "wolf", "fox"]),
  subject(["horse", "horses"], ["horse", "pony", "stallion", "mare"]),
  subject(["animal", "animals", "wildlife", "zoo"], ["animal", "bird", "tiger", "lion", "bear", "panda", "elephant", "deer", "monkey", "zebra"]),
  subject(["fish", "fishes"], ["fish", "carp", "koi", "trout", "salmon"]),
  subject(["insect", "insects", "bug", "bugs"], ["insect", "butterfly", "moth", "beetle", "bee", "dragonfly"]),
  subject(["butterfly", "butterflies"], ["butterfly", "moth"]),
  subject(["flower", "flowers", "floral", "bloom"], ["flower", "rose", "lily", "iris", "orchid", "peony", "poppy", "tulip", "daisy", "blossom", "chrysanthemum"]),
  subject(["plant", "plants", "botanical", "botany"], ["plant", "leaf", "flower", "fern", "seed", "stem", "tree", "botanical"]),
  subject(["tree", "trees", "forest", "woods"], ["tree", "forest", "wood", "pine", "oak", "willow", "birch"]),
  subject(["leaf", "leaves"], ["leaf", "fern", "frond"]),
  subject(["mountain", "mountains"], ["mountain", "peak", "fuji", "alp", "valley", "hill"]),
  subject(["landscape", "landscapes", "countryside"], ["landscape", "valley", "field", "hill", "view", "farm", "meadow"]),
  subject(["city", "urban", "cityscape"], ["city", "street", "skyline", "building", "tower", "bridge", "square"]),
  subject(["building", "buildings"], ["building", "facade", "tower", "church", "house", "temple", "cathedral"]),
  subject(["church", "cathedral"], ["church", "cathedral", "abbey", "chapel"]),
  subject(["bridge", "bridges"], ["bridge", "arch", "viaduct"]),
  subject(["ruin", "ruins", "ancient"], ["ruin", "temple", "column", "roman", "antique"]),
  subject(["japan", "japanese"], ["japan", "japanese", "ukiyo", "edo", "fuji", "hokusai", "hiroshige"]),
  subject(["china", "chinese"], ["china", "chinese", "ink", "brush"]),
  subject(["asia", "asian", "oriental"], ["japan", "china", "ink", "brush", "woodblock"]),
  subject(["plane", "planes", "aircraft", "airplane", "aeroplane", "aviation"], ["aircraft", "plane", "airplane", "jet", "wing", "flight", "biplane"]),
  subject(["rocket", "rockets", "spacecraft"], ["rocket", "spacecraft", "capsule", "satellite", "missile"]),
  subject(["engine", "engines", "motor"], ["engine", "motor", "turbine", "cylinder", "piston"]),
  subject(["machine", "machines", "machinery"], ["machine", "engine", "gear", "motor", "patent"]),
  subject(["car", "cars", "auto"], ["car", "automobile", "vehicle", "wheel"]),
  subject(["train", "trains", "railway", "railroad"], ["train", "locomotive", "railway", "rail", "station"]),
  subject(["invention", "inventions", "patent"], ["patent", "model", "invention", "machine"]),
  subject(["tool", "tools", "instrument", "instruments"], ["instrument", "tool", "dial", "compass", "sextant", "gauge"]),
  subject(["electronics", "circuit", "circuits", "electric"], ["circuit", "schematic", "transistor", "logic", "gate", "resistor"]),
  subject(["computer", "code", "coding", "programmer", "hacker"], ["ascii", "terminal", "code", "punch", "binary", "matrix"]),
  subject(["science", "scientific"], ["science", "chart", "table", "diagram", "periodic", "equation"]),
  subject(["math", "maths", "mathematics"], ["curve", "spiral", "lissajous", "attractor", "platonic", "golden", "pi"]),
  subject(["spiral", "spirals"], ["spiral", "golden", "phyllotaxis", "helix"]),
  subject(["curve", "curves"], ["curve", "lissajous", "harmonograph", "spiral", "wave"]),
  subject(["pattern", "patterns", "ornament", "ornamental", "decorative"], ["pattern", "ornament", "tile", "lace", "rosette", "stencil", "guilloche"]),
  subject(["tile", "tiles", "mosaic"], ["tile", "tiling", "mosaic", "khatam", "truchet"]),
  subject(["map", "maps", "cartography"], ["map", "chart", "globe", "atlas"]),
  subject(["weather", "wind", "storm"], ["wind", "weather", "beaufort", "storm", "forecast", "rain"]),
  subject(["music", "musical"], ["music", "note", "score", "instrument"]),
  subject(["typewriter", "letters", "alphabet"], ["alphabet", "letter", "type", "morse"]),
  subject(["winter", "snow"], ["snow", "winter", "ice"]),
  subject(["night", "evening", "nocturne"], ["night", "nocturne", "moon", "evening", "moonlight"]),
  subject(["garden", "gardens"], ["garden", "flower", "park"]),
  subject(["snake", "reptile", "reptiles"], ["snake", "lizard", "turtle", "tortoise", "crocodile"]),
  subject(["bear", "bears"], ["bear", "panda"]),
  subject(["monkey", "ape", "primate"], ["monkey", "ape", "gorilla", "orangutan", "lemur"]),
  subject(["skull", "bones", "skeleton"], ["skull", "skeleton", "bone", "anatomy"]),
  subject(["portrait", "face"], ["portrait", "face", "head"]),
];
