/**
 * Finishing pass for descriptions: each design's own sentence (what it is)
 * is followed by one closing line about how it wears, picked per category.
 * The pick is deterministic, and a catalog-wide pass guarantees that no
 * full description appears more than MAX_REPEATS times.
 */
import type { ShirtCategory } from "../../types/shirt";
import type { Rng } from "./core";

export const MAX_REPEATS = 3;

/** Ends the text with punctuation, so the next sentence doesn't run on. */
export const sentence = (text: string) => (/[.!?…”)]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

/** How a print wears, per category — honest feel, no claims or counts. */
const TAILS: Record<ShirtCategory, string[]> = {
  architectural: [
    "Reads like a blueprint from across the room.",
    "Strict lines, softened by cotton.",
    "For people who notice buildings.",
    "Order with a little tension in it.",
    "Heavy on structure, light on fuss.",
    "Looks planned, because it was.",
    "A floor plan you can wear.",
    "Concrete energy without the weight.",
    "Clean enough for the office, odd enough for the weekend.",
    "Measured, rhythmic, a little severe.",
    "Grid discipline, worn casually.",
    "Brutalism, but make it comfortable.",
  ],
  geometric: [
    "Nothing extra, nothing missing.",
    "Quiet from a distance, sharp up close.",
    "Shapes doing very little, very well.",
    "Balanced enough to calm a busy outfit.",
    "A study in restraint.",
    "Geometry class, but good.",
    "Bold without shouting.",
    "Works with anything with a straight face.",
    "Crisp edges, soft fabric.",
    "Pure form, no explanation needed.",
    "Minimal, but it holds the eye.",
    "The kind of print that ages well.",
  ],
  typography: [
    "Type set big enough to read from the other side of the street.",
    "Letters treated as shapes.",
    "Editorial energy, zero small print.",
    "Says one thing and means it.",
    "Built on a grid, loud on purpose.",
    "Like a poster that decided to be a shirt.",
    "Words as texture.",
    "For people who kern in their sleep.",
    "Graphic first, readable second.",
    "Newsprint attitude, cotton comfort.",
    "The typeface is the picture.",
    "Plain-spoken and very sure of itself.",
  ],
  halftone: [
    "Grey made entirely of dots, the way presses do it.",
    "Looks different up close than from afar.",
    "Printer's-proof texture, on purpose.",
    "Soft gradients, hard dots.",
    "A little retro, a little op-art.",
    "Vibrates gently when you walk.",
    "Light and shade without a single grey.",
    "Pop-art technique, no primary colours.",
    "Screen-print texture you can almost feel.",
    "Busy up close, calm at a distance.",
    "Tonal depth from one ink.",
    "The dots are the point.",
  ],
  waves: [
    "Lines that drift and never quite settle.",
    "Hypnotic if you stare too long.",
    "Movement, printed still.",
    "Somewhere between a map and a sound wave.",
    "Calm, rhythmic, slightly restless.",
    "Organic lines with a scientific streak.",
    "Reads like data, feels like water.",
    "A little optical illusion for everyday.",
    "Flowing linework that suits a slower day.",
    "Contour-map calm.",
    "Pulses gently from a distance.",
    "Line art with a heartbeat.",
  ],
  scenes: [
    "A landscape for people who'd rather be outside.",
    "Postcard calm without the postcard.",
    "Printed like a gallery screen print.",
    "Quiet, spacious and a little nostalgic.",
    "Weekend-trip energy on a weekday.",
    "Soft tones, big sky.",
    "Travel mood, zero luggage.",
    "Looks good with muddy boots.",
    "Nature, reduced to its best lines.",
    "Evening light in one ink.",
    "A small escape on your back.",
    "Scenic without being twee.",
  ],
  slogans: [
    "Deadpan delivery, sincere message (mostly).",
    "A conversation starter that doesn't need you to start it.",
    "Honest statements for honest people.",
    "Funny once, still funny on the tenth wear.",
    "Says it so you don't have to.",
    "Dry humour, soft cotton.",
    "Office-appropriate, depending on the office.",
    "Wear it on the days you mean it.",
    "Low effort, high commitment.",
    "The joke is for people who get it.",
    "Plain type, strong opinions.",
    "For the friend who reads everything out loud.",
  ],
  pixel: [
    "Low resolution, high nostalgia.",
    "Straight out of a cartridge.",
    "Blocky in the best way.",
    "Insert coin to continue wearing.",
    "Retro computing, cotton edition.",
    "Every pixel placed on purpose.",
    "Arcade-cabinet energy.",
    "Recognisable from across the room, even at 8 bits.",
    "For people who remember the start screen.",
    "Command-line chic.",
    "Crisp grid, warm memories.",
    "Old graphics, new shirt.",
  ],
  emblems: [
    "A badge for a club you just joined.",
    "Official-looking, entirely unofficial.",
    "Heritage vibes, zero history.",
    "Membership has its privileges (none).",
    "Stamped, sealed and wearable.",
    "Looks like it came with a certificate.",
    "Vintage insignia energy.",
    "For societies that meet rarely, if ever.",
    "Formal lettering, informal intentions.",
    "Crest-worthy, ceremony-free.",
    "Traditional layout, playful motto.",
    "Wears like a team shirt for a team of one.",
  ],
  objects: [
    "An everyday thing, drawn with more care than it asked for.",
    "Small subject, big presence.",
    "Illustration-first, and it shows.",
    "For people who notice the little things.",
    "Drawn like a museum catalogue entry.",
    "Quietly funny, clearly drawn.",
    "Still life, with a sense of humour.",
    "A love letter to ordinary stuff.",
    "Clean linework, warm subject.",
    "Part diagram, part affection.",
    "The kind of detail that starts conversations.",
    "Humble object, confident print.",
  ],
  ascii: [
    "Made entirely of characters, like a terminal with taste.",
    "For people whose favourite font is monospace.",
    "Text-mode art, printed big.",
    "Readable, but not in the usual way.",
    "Old-school computing, lovingly typed.",
    "Every character earns its place.",
    "Looks like code, feels like art.",
    "A picture you could email in 1994.",
    "Nerdy in the best sense.",
    "Characters doing the work of pixels.",
    "Monospace, maximum charm.",
    "Terminal aesthetics, soft cotton.",
  ],
  caricatures: [
    "An invented character, lovingly exaggerated — nobody real.",
    "Everyone knows one of these.",
    "Affectionate mockery, strictly fictional.",
    "Character study, heavy on character.",
    "For the friend who is exactly this.",
    "Big features, bigger personality.",
    "Comic-strip energy, one panel only.",
    "A portrait of a type, not a person.",
    "Recognisable in every office and every group chat.",
    "Drawn with a wink.",
    "Cartoon clarity, deadpan delivery.",
    "Funny because it's (fictionally) true.",
  ],
  famousart: [
    "A public-domain classic, redrawn in one colour.",
    "Museum-shop energy without the queue.",
    "Art history, reduced to its strongest lines.",
    "Classic composition, cotton canvas.",
    "A homage, not a copy — drawn from scratch.",
    "For people who linger in galleries.",
    "Old master mood, modern fit.",
    "Recognisable at a glance, fresh up close.",
    "The gallery label is half the fun.",
    "Culture, casually worn.",
    "A little reverence, a little wink.",
    "Timeless composition, single ink.",
  ],
  iconic: [
    "A symbol you know, drawn from scratch.",
    "Postcard-famous, poster-bold.",
    "Travel-poster energy for any day of the week.",
    "Big icon, clean lines.",
    "Recognisable from across the street.",
    "Wanderlust in one colour.",
    "Classic imagery, modern restraint.",
    "A landmark moment on your back.",
    "Iconic without the logo.",
    "Graphic, confident, instantly readable.",
    "Retro optimism, printed flat.",
    "The kind of image that needs no caption (but has one).",
  ],
  wildlife: [
    "A real photograph, not a drawing: every whisker and feather.",
    "Reads as a picture from across the room, and holds up close.",
    "A black-and-white photograph, printed whole.",
    "Quiet animal portrait, loud enough to start a conversation.",
    "The zoo, in black and white.",
    "Photographic detail, flattened into one colour.",
    "Nature, straight from the lens to the press.",
    "For people who stop at every enclosure.",
    "Soft greys, real fur.",
    "A field guide page you can wear.",
    "Honest photograph, simple print.",
    "Looks better the longer you look.",
  ],
  flight: [
    "A museum photograph, like a page from an old airshow programme.",
    "Aviation history in one ink.",
    "For people who look up when something flies over.",
    "The whole machine, nose to tail.",
    "Hangar light, in black and white.",
    "Engineering you can wear, straight from the collection.",
    "Metal and fabric, rendered in cotton.",
    "The real machine, not an illustration of one.",
    "Speed, printed very still.",
    "A plate from the archive, pulled onto a tee.",
    "Classic lines, real metal.",
    "Flight, frozen in one colour.",
  ],
  machines: [
    "Every rivet and dial, in one ink.",
    "Mechanical detail, photographed in black and white.",
    "For people who take things apart to see how they work.",
    "A museum photograph of the real thing.",
    "Gauges and cylinders, printed like a service manual plate.",
    "Industrial, precise, a little romantic.",
    "The machine as a portrait.",
    "Reads as hardware from across the room.",
    "Engineering, not decoration — and it looks good anyway.",
    "Polished metal, in greys.",
    "Heavy machinery, light cotton.",
    "From the collection to the chest.",
  ],
};

/**
 * Appends a closing line to each base description, starting from a
 * deterministic pick and moving on while the result is already used
 * MAX_REPEATS times. Input order decides ties, so output is stable.
 */
export function finishDescriptions(items: { base: string; category: ShirtCategory; rng: Rng }[]): string[] {
  const counts = new Map<string, number>();
  return items.map(({ base: raw, category, rng }) => {
    const base = sentence(raw);
    const tails = TAILS[category];
    const start = Math.floor(rng() * tails.length);
    let out = `${base} ${tails[start]}`;
    for (let k = 0; k < tails.length; k++) {
      const candidate = `${base} ${tails[(start + k) % tails.length]}`;
      if ((counts.get(candidate) ?? 0) < MAX_REPEATS) {
        out = candidate;
        break;
      }
    }
    counts.set(out, (counts.get(out) ?? 0) + 1);
    return out;
  });
}
