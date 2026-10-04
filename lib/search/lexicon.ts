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
  { phrases: ["drawn", "vector", "generative"], facet: { kind: "medium", value: "drawn" } },
  { phrases: ["archive", "museum", "antique print", "old print"], facet: { kind: "medium", value: "ink" } },
  { phrases: ["on black", "black tee", "black shirt", "black t shirt", "dark tee"], facet: { kind: "tee", value: "black" } },
  { phrases: ["on white", "white tee", "white shirt", "white t shirt", "light tee"], facet: { kind: "tee", value: "white" } },
  // (Not "new" alone: "new york", "new england".)
  { phrases: ["newest", "this week", "latest", "just in", "new this week", "new in"], facet: { kind: "new", value: "week" } },

  // When.
  era("c14", "1300s", "14th century", "fourteenth century"),
  era("c15", "1400s", "15th century", "fifteenth century"),
  era("c16", "1500s", "16th century", "sixteenth century", "renaissance"),
  era("c17", "1600s", "17th century", "seventeenth century", "baroque"),
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

  // How it looks.
  look("minimal", "minimal", "minimalist", "clean"),
  look("bold", "bold", "high contrast", "striking"),
  look("dense", "dense", "busy", "packed"),
  look("airy", "airy", "sparse", "light touch"),
  look("line", "line art", "lineart", "outline"),
  look("halftone", "halftone dots", "dotted", "dots"),
  look("symmetric", "symmetric", "symmetrical", "mirrored"),
  look("detailed", "detailed", "intricate", "fine detail"),
  look("simple", "simple"),
  look("small", "small print", "small", "tiny", "subtle"),
  look("full", "full print", "big print", "large print", "all over"),
  look("wide", "wide", "wide format", "panoramic"),

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
  { phrases: ["dark", "moody", "gloomy"], soft: { contrast: 1 } },
  { phrases: ["soft", "gentle", "calm", "quiet", "peaceful", "serene", "tranquil"], soft: { contrast: -1, density: -1 } },

  // Subjects: a word, and what else it means.
  subject(["space", "cosmos", "cosmic", "universe"], ["sky", "star", "planet", "moon", "rocket", "constellation", "orbit", "comet"]),
  subject(["stars", "sky", "night sky", "astronomy", "astronomical"], ["star", "constellation", "moon", "planet", "orbit", "telescope", "eclipse"]),
  subject(["zodiac", "star sign", "star signs", "astrology", "horoscope"], ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpius", "sagittarius", "capricornus", "aquarius", "pisces"]),
  subject(["planets", "planet", "saturn", "jupiter", "mars", "venus", "mercury", "solar system"], ["planet", "ringed", "jupiter", "orbit"]),
  subject(["nasa", "astronaut", "apollo", "spaceflight", "moon landing"], ["apollo", "lunar", "spacecraft", "shuttle", "capsule", "module", "orbiter", "rover"]),
  subject(["moon", "lunar"], ["moon", "phase", "eclipse", "crescent"]),
  subject(["sun", "solar"], ["sun", "solar", "eclipse", "daylight", "analemma"]),
  subject(["sea", "ocean", "maritime", "nautical", "marine", "coastal", "beach", "seaside"], ["ocean", "wave", "sail", "seascape", "ship", "boat", "harbor", "coast", "shore"]),
  subject(["wave", "waves", "surf"], ["wave", "ocean", "sea", "surf"]),
  subject(["boat", "ship", "sailing"], ["ship", "boat", "sail", "harbor", "yacht", "steamer"]),
  subject(["river", "lake", "water"], ["river", "lake", "stream", "bridge", "canal", "water"]),
  subject(["bird", "birds"], ["owl", "eagle", "heron", "hawk", "crane", "duck", "parrot", "sparrow", "swan", "egret", "pelican", "falcon", "gull", "bird"]),
  subject(["cat", "cats", "big cat"], ["tiger", "lion", "cheetah", "leopard", "panther", "lynx", "cat"]),
  subject(["dog", "dogs"], ["dog", "hound", "canis", "puppy", "fox"]),
  subject(["horse", "horses"], ["horse", "pony", "stallion", "mare"]),
  subject(["animal", "animals", "wildlife", "zoo"], ["animal", "bird", "tiger", "lion", "bear", "panda", "elephant", "deer", "monkey", "zebra", "wildlife", "zoo"]),
  subject(["fish", "fishes", "koi"], ["fish", "carp", "koi", "trout", "salmon"]),
  subject(["insect", "insects", "bug", "bugs"], ["insect", "butterfly", "moth", "beetle", "bee", "dragonfly"]),
  subject(["butterfly", "butterflies"], ["butterfly", "moth"]),
  subject(["flower", "flowers", "floral", "bloom"], ["flower", "rose", "lily", "iris", "orchid", "peony", "poppy", "tulip", "daisy", "blossom", "chrysanthemum"]),
  subject(["plant", "plants", "botanical", "botany"], ["plant", "leaf", "flower", "fern", "seed", "stem", "tree", "botanical"]),
  subject(["tree", "trees", "forest", "woods"], ["tree", "forest", "wood", "pine", "oak", "willow", "birch"]),
  subject(["leaf", "leaves"], ["leaf", "leaves", "fern", "frond"]),
  subject(["cactus", "cacti", "succulent"], ["cholla", "opuntia", "cereus", "yucca", "desert"]),
  subject(["fruit", "fruits", "orchard"], ["fruit", "apple", "pear", "grape", "cherry", "berry", "orchard", "peach", "plum"]),
  subject(["sakura", "cherry blossom"], ["cherry", "blossom", "plum"]),
  subject(["fog", "foggy", "misty", "haze"], ["mist", "moonlight"]),
  subject(["farm", "rural", "barn", "cottage", "cottagecore"], ["farm", "barn", "orchard", "sheep", "cow", "field", "village"]),
  subject(["mountain", "mountains"], ["mountain", "peak", "fuji", "alp", "valley", "hill"]),
  subject(["landscape", "landscapes", "countryside"], ["landscape", "valley", "field", "hill", "view", "farm", "meadow"]),
  subject(["city", "urban", "cityscape"], ["city", "street", "skyline", "building", "tower", "bridge", "square"]),
  subject(["building", "buildings"], ["building", "facade", "tower", "church", "house", "temple", "cathedral"]),
  subject(["church", "cathedral", "gothic"], ["church", "cathedral", "abbey", "chapel", "lancet", "arch"]),
  subject(["bridge", "bridges"], ["bridge", "arch", "viaduct"]),
  subject(["japan", "japanese"], ["japan", "japanese", "ukiyo", "edo", "fuji", "hokusai", "hiroshige"]),
  // Techniques: their near words.
  { phrases: ["printmaking", "lithograph", "lithography", "litho", "aquatint", "mezzotint", "drypoint", "intaglio", "linocut"], expand: ["etching", "engraving", "woodcut"] },
  { phrases: ["sumi e", "sumi", "ink wash", "brush painting", "zen"], expand: ["painting", "bamboo", "pine"] },
  { phrases: ["china", "chinese"], expand: ["china", "chinese", "ming", "qing"] },
  { phrases: ["asia", "asian", "oriental"], expand: ["japan", "china", "woodblock"] },
  subject(["new york", "nyc", "manhattan"], ["york", "brooklyn", "manhattan", "hudson"]),
  subject(["new england"], ["maine", "massachusetts", "vermont", "connecticut", "boston", "nantucket"]),
  subject(["italy", "italian"], ["rome", "roman", "venice", "tivoli", "florence", "trevi"]),
  subject(["france", "french"], ["paris", "normandy", "honfleur", "french"]),
  subject(["england", "britain", "british"], ["london", "thames", "england", "sussex"]),
  subject(["aircraft", "plane", "planes", "airplane", "aeroplane", "aviation", "jet", "helicopter", "zeppelin", "airship", "glider", "balloon", "flying"], ["aircraft", "biplane", "monoplane", "glider", "airship", "balloon", "ultralight", "wing", "flight"]),
  subject(["rocket", "rockets", "spacecraft"], ["rocket", "spacecraft", "capsule", "satellite", "missile"]),
  subject(["engine", "engines", "motor"], ["engine", "motor", "turbine", "cylinder", "piston"]),

  subject(["car", "cars", "auto"], ["car", "automobile", "vehicle", "wheel"]),
  subject(["train", "trains", "railway", "railroad"], ["train", "locomotive", "railway", "rail", "station"]),
  subject(["inventions", "invention", "patent", "machine", "machines", "machinery"], ["patent", "model", "invention", "machine", "engine", "gear", "motor"]),
  subject(["instrument", "instruments", "tool", "tools", "gauge", "gauges"], ["instrument", "indicator", "dial", "meter", "altimeter", "tachometer", "barometer", "compass", "sextant", "telescope", "gauge"]),
  subject(["electronics", "circuit", "circuits", "electric"], ["circuit", "schematic", "transistor", "logic", "gate", "resistor"]),
  subject(["code", "computer", "coding", "programmer", "hacker"], ["ascii", "terminal", "code", "punch", "binary", "matrix"]),
  subject(["science", "scientific", "physics", "chemistry"], ["science", "periodic", "element", "equation", "attractor", "physics", "chemistry"]),
  subject(["math", "maths", "mathematics"], ["curve", "spiral", "lissajous", "attractor", "platonic", "golden", "pi"]),
  subject(["spiral", "spirals"], ["spiral", "golden", "phyllotaxis", "helix"]),
  subject(["curve", "curves"], ["curve", "lissajous", "harmonograph", "spiral"]),
  subject(["op art", "optical illusion", "illusion", "psychedelic", "trippy", "hypnotic"], ["moire", "interference", "concentric", "guilloche", "lissajous"]),
  subject(["mandala", "kaleidoscope", "spirograph"], ["rosette", "guilloche", "harmonograph", "lissajous", "concentric", "fold"]),
  subject(["fractal", "fractals", "chaos", "chaos theory", "strange attractor"], ["attractor", "lorenz", "rossler", "phyllotaxis"]),
  subject(["steampunk", "clockwork", "gears"], ["engine", "cylinder", "gauge", "dial", "indicator", "patent"]),
  subject(["pattern", "patterns", "ornament", "ornamental", "decorative"], ["pattern", "ornament", "tile", "lace", "rosette", "stencil", "guilloche"]),
  subject(["tile", "tiles", "mosaic"], ["tile", "tiling", "mosaic", "khatam", "truchet"]),
  subject(["map", "maps", "cartography"], ["map", "chart", "globe", "atlas"]),
  subject(["wind", "weather", "storm"], ["wind", "weather", "beaufort", "storm", "forecast", "rain"]),
  subject(["music", "musical"], ["music", "note", "score", "instrument"]),
  subject(["alphabet", "letters", "typewriter"], ["alphabet", "letter", "type", "morse"]),
  subject(["winter", "snow"], ["snow", "winter", "ice"]),
  subject(["night", "evening", "nocturne"], ["night", "nocturne", "moon", "evening", "moonlight"]),
  subject(["garden", "gardens"], ["garden", "flower", "park"]),
  subject(["snake", "reptile", "reptiles"], ["snake", "lizard", "turtle", "tortoise", "crocodile"]),
  subject(["bear", "bears"], ["bear", "panda"]),
  subject(["monkey", "ape", "primate"], ["monkey", "ape", "gorilla", "orangutan", "lemur"]),
];
