/**
 * Captions for the third set (ids 2001–2800): ASCII art, caricatures,
 * famous art and iconic images.
 *
 * Caricatures are original archetypes, never real people. Famous-art prints
 * are homages to public-domain works only (artists who died well over 70
 * years ago). Landmarks are drawn from scratch; no photographs, logos or
 * trademarks are reproduced.
 */

/* ------------------------------------------------------------------ */
/* ASCII                                                               */
/* ------------------------------------------------------------------ */

export const BANNER_WORDS: string[][] = [
  ["NOPE"], ["LOL"], ["BRB"], ["404"], ["MEH"], ["WHY"], ["HELLO"], ["IDK"], ["HMM"], ["OMG"], ["YOLO"], ["BYE"], ["ZZZ"], ["SUP"],
  ["BIG", "MOOD"], ["NO", "WIFI"], ["LOW", "BATT"], ["SEND", "HELP"], ["NOT", "TODAY"], ["OUT", "OF", "OFFICE"], ["BRB", "NAP"],
  ["SUDO", "NAP"], ["CTRL", "Z"], ["NEW", "PHONE", "WHO"], ["DO", "NOT", "DISTURB"],
];

export const BANNER_CAPTIONS = [
  "rendered in 100% organic ASCII",
  "no pixels were harmed",
  "best viewed in a terminal",
  "compiled from pure attitude",
  "ctrl+c, ctrl+v since 1963",
  "font: whatever you had lying around",
  "printed at 80 columns of honesty",
  "hand-typed. mostly.",
];

export const SHADE_CAPTIONS: Record<string, string[]> = {
  sphere: ["sphere(r=1) // perfectly round, emotionally", "a ball, but make it text", "lit from the left. like my opinions."],
  donut: ["donut.c // zero calories", "torus, lightly glazed", "the only donut that fits in a terminal"],
  cube: ["cube.txt // six sides, no drama", "box(1,1,1) // thinking inside it", "a cube walks into a terminal"],
  capsule: ["capsule // take one daily", "pill.exe // side effects: vibes", "one tablet, no prescription"],
  octa: ["octahedron // d8 of destiny", "eight faces, one mood", "geometry class, but fun"],
};

/** Hand-drawn ASCII pieces (original). Rendered in a monospace grid. */
export const ASCII_ART: Record<string, { art: string; captions: string[] }> = {
  cat: {
    art: String.raw`
    /\_____/\
   /  o   o  \
  ( ==  ^  == )
   )         (
  (           )
 ( (  )   (  ) )
(__(__)___(__)__)`,
    captions: ["cat.txt — 1.2 KB of pure attitude", "if i fits, i prints", "has not been fed (has been fed)"],
  },
  rocket: {
    art: String.raw`
     /\
    /  \
   | () |
   |    |
   | [] |
  /|    |\
 /_|____|_\
    /**\
   /****\ `,
    captions: ["to the moon, in 80 columns", "launching... please wait", "rocket.txt // no refunds"],
  },
  coffee: {
    art: String.raw`
     ( (
      ) )
   ........
   |      |]
   \      /
    '----'`,
    captions: ["brewed in plain text", "coffee.exe has stopped responding", "decaf is not a font"],
  },
  owl: {
    art: String.raw`
   /\___/\
  ( (o) (o) )
  (   \ /   )
   \  ~~~  /
   /|     |\
  / |  "  | \
    |_____|
    /\   /\ `,
    captions: ["who? whom. (grammar owl)", "awake. judging. both.", "night shift, text mode"],
  },
  robot: {
    art: String.raw`
     [___]
    |o   o|
    |  _  |
    |_____|
   /|  |  |\
  d |__|__| b
     || ||
    _|| ||_`,
    captions: ["beep boop, no thoughts", "human.exe not found", "runs on vibes and 5 volts"],
  },
  whale: {
    art: String.raw`
         .
        ":"
      ___:____     |"\/"|
    ,'        '.    \  /
    |  O        \___/  |
  ~^~^~^~^~^~^~^~^~^~^~^~^~`,
    captions: ["a whale of a string", "deep thoughts, shallow water", "whale.txt // very big file"],
  },
  cactus: {
    art: String.raw`
       ,*-.
       |  |
   ,.  |  |
   | |_|  | ,.
   '---.  |_| |
       |  .--'
       |  |
       |  |
  ~~~~~~~~~~~~~~`,
    captions: ["don't touch. i'm prickly today", "needs water once a month. relatable.", "low maintenance, high attitude"],
  },
  house: {
    art: String.raw`
        /\
       /  \   ||
      /    \  ||
     /      \_||
    /  ____  \
    |  |  |  |
    |  |__|  |
  __|________|__`,
    captions: ["home is where the wifi connects", "127.0.0.1 sweet 127.0.0.1", "no place like ~/"],
  },
  ghost: {
    art: String.raw`
    .-----.
   /  O O  \
  |    ^    |
  |  \___/  |
  |         |
  |/\/\/\/\/|`,
    captions: ["boo.txt (spooky, 0 bytes of fear)", "ghosted you. sorry.", "haunting this terminal since '85"],
  },
  ufo: {
    art: String.raw`
        _____
     __/ o o \__
    (___________)
       /  |  \
      /   |   \ `,
    captions: ["they came for the cows. stayed for the wifi", "take me to your router", "abducted.txt"],
  },
  dog: {
    art: String.raw`
    / \__
   (    @\___
   /         O
  /   (_____/
 /_____/   U`,
    captions: ["good boy, fully ASCII compliant", "who's a good string? you are", "fetch(); // returns ball"],
  },
  snail: {
    art: String.raw`
    @     @
     \   /   ____
      \_/  /  __ \
       |  |  /  \ |
      /   |  \__/ |
 ____/____\______/__`,
    captions: ["loading... (snail speed)", "slow and steady, in 12 point", "in no hurry whatsoever"],
  },
};

export const SCENE_CAPTIONS: Record<string, string[]> = {
  moonsea: ["ocean view, 8-bit rent", "moon.txt over sea.txt", "tide.log // nothing to report"],
  mountains: ["landscape.txt // hiking in plain text", "peaks rendered, legs not included", "altitude: ~/"],
  sunset: ["sunset.sh // runs daily", "golden hour, monospace edition", "the sun sets in 42 columns"],
  city: ["city.txt // still awake", "downtown at 3 a.m., text mode", "skyline.exe, lights left on"],
};

/* ------------------------------------------------------------------ */
/* Caricatures — original archetypes only                              */
/* ------------------------------------------------------------------ */

export interface Archetype {
  name: string;
  hair: "messy" | "spiky" | "slick" | "pompadour" | "bun" | "curly" | "mohawk" | "ring" | "bald" | "none";
  hat?: "cap" | "beanie" | "beret" | "toque" | "headphones" | "headset";
  eyes: "dots" | "wide" | "tired" | "sunglasses" | "glasses" | "spiral" | "closed" | "side";
  brows: "arch" | "angry" | "worried" | "bushy" | "flat";
  nose: "bulb" | "hook" | "ski" | "long" | "button";
  mouth: "grin" | "smile" | "smirk" | "flat" | "open" | "yell" | "wobbly" | "pout";
  facial?: "moustache" | "handlebar" | "beard" | "stubble";
  extras?: ("thought" | "sweat" | "tie" | "bowtie" | "phone" | "cheeks")[];
  prop?: string;
  body?: "buff";
  lines: string[];
}

export const ARCHETYPES: Archetype[] = [
  { name: "The Overthinker", hair: "messy", eyes: "spiral", brows: "worried", nose: "bulb", mouth: "wobbly", extras: ["thought"], lines: ["Currently replaying a conversation from 2014.", "Has 37 tabs open. In the brain.", "Read your message. Still drafting a reply."] },
  { name: "The Barista", hair: "bun", eyes: "dots", brows: "arch", nose: "hook", mouth: "smirk", facial: "handlebar", prop: "coffee", lines: ["Knows your order. Judges it silently.", "Oat, soy, almond, or disappointment?", "Spelled your name wrong on purpose."] },
  { name: "The Night Owl", hair: "messy", eyes: "tired", brows: "flat", nose: "bulb", mouth: "flat", prop: "coffee", lines: ["Productive between 2 and 4 a.m. only.", "Good morning is a strong phrase.", "Sleep is a subscription I cancelled."] },
  { name: "The Gym Bro", hair: "none", hat: "cap", eyes: "dots", brows: "angry", nose: "ski", mouth: "grin", body: "buff", lines: ["Never skips leg day. Never mentions it. (Mentions it.)", "Do you even lift, bro?", "Protein shake in one hand, mirror in the other."] },
  { name: "The DJ", hair: "slick", hat: "headphones", eyes: "sunglasses", brows: "flat", nose: "ski", mouth: "grin", lines: ["Has one more track. Always one more.", "The drop is coming. Any minute now.", "Sunglasses indoors, for professional reasons."] },
  { name: "The Philosopher", hair: "ring", eyes: "closed", brows: "bushy", nose: "long", mouth: "flat", facial: "beard", lines: ["Asked 'why?' once. Never stopped.", "Thinks, therefore is. Mostly thinks.", "Pondering the meaning of 'reply all'."] },
  { name: "The Influencer", hair: "pompadour", eyes: "sunglasses", brows: "arch", nose: "ski", mouth: "pout", extras: ["phone"], lines: ["The coffee was cold by the time the photo was right.", "Link in bio. Bio in link.", "Doing it for the content."] },
  { name: "The Dad", hair: "none", hat: "cap", eyes: "dots", brows: "flat", nose: "bulb", mouth: "grin", facial: "moustache", lines: ["Hi hungry, I'm Dad.", "Knows a guy. Has a lawn opinion.", "Who left the lights on? We don't own the power company."] },
  { name: "The Intern", hair: "spiky", eyes: "wide", brows: "worried", nose: "button", mouth: "wobbly", extras: ["sweat"], lines: ["Replied-all. Twice.", "Is it too late to say I have no idea?", "Printer jam specialist since Monday."] },
  { name: "The CEO", hair: "slick", eyes: "side", brows: "angry", nose: "long", mouth: "smirk", extras: ["tie"], lines: ["Let's circle back on that synergy.", "Per my last email, which I did not write.", "Believes 'quick call' is a real thing."] },
  { name: "The Artist", hair: "none", hat: "beret", eyes: "closed", brows: "arch", nose: "hook", mouth: "smirk", facial: "handlebar", lines: ["It's not a mess. It's a period.", "Suffers beautifully, in charcoal.", "Would explain, but you wouldn't get it."] },
  { name: "The Gamer", hair: "spiky", hat: "headset", eyes: "wide", brows: "angry", nose: "ski", mouth: "open", lines: ["Just one more round (said at 9 p.m.).", "Lag is a personality trait.", "Respawning since 1998."] },
  { name: "The Chef", hair: "none", hat: "toque", eyes: "closed", brows: "arch", nose: "bulb", mouth: "grin", facial: "moustache", lines: ["A pinch is whatever I say it is.", "Yes chef. Also, the chef.", "Tastes everything. Twice. For science."] },
  { name: "The Professor", hair: "ring", eyes: "glasses", brows: "bushy", nose: "long", mouth: "flat", extras: ["bowtie"], lines: ["This will be on the exam. Everything will.", "Actually, it's pronounced differently.", "Office hours: never, but warmly."] },
  { name: "The Rockstar", hair: "mohawk", eyes: "closed", brows: "angry", nose: "hook", mouth: "yell", lines: ["Still recovering from a gig in 1997.", "Turned it up to eleven. Stayed there.", "Encore? Always."] },
  { name: "The Grandma", hair: "bun", eyes: "glasses", brows: "arch", nose: "button", mouth: "smile", extras: ["cheeks"], lines: ["Have you eaten? You look thin.", "Knits faster than you type.", "Brought snacks. Always brings snacks."] },
  { name: "The Plant Parent", hair: "curly", eyes: "dots", brows: "arch", nose: "button", mouth: "smile", extras: ["cheeks"], prop: "cactus", lines: ["Talks to 43 plants. They listen.", "My kids are photosynthetic.", "Overwatered, emotionally."] },
  { name: "The Photographer", hair: "none", hat: "beanie", eyes: "side", brows: "flat", nose: "hook", mouth: "smirk", facial: "stubble", prop: "camera", lines: ["Just one more, the light is perfect.", "Sees the world in 3:2.", "Took 400 photos. Posted one."] },
];

export const WANTED_CRIMES = [
  "REPLYING 'K'",
  "EATING THE LAST SLICE",
  "SPOILING THE FINALE",
  "SAYING 'PER MY LAST EMAIL'",
  "LEAVING 1% IN THE CARTON",
  "SNORING ON AN UNMUTED CALL",
  "RECLINING ON A SHORT FLIGHT",
  "CLAPPING WHEN THE PLANE LANDS",
  "SPEAKERPHONE IN PUBLIC",
  "STEALING EVERY PEN",
  "RESTARTING THE SONG AGAIN",
  "REPLYING ALL",
  "UNSOLICITED PUNS",
  "TALKING DURING THE MOVIE",
];

export const WANTED_REWARDS = ["$3 AND A SANDWICH", "ONE (1) HIGH FIVE", "A SINCERE THANK YOU", "EXPOSURE", "$12 OR BEST OFFER", "HALF A CROISSANT", "A GOLD STAR STICKER", "ETERNAL GLORY"];

export const BOBBLE_TAGLINES = ["Collector's edition. Head may wobble when judged.", "Nods along to everything.", "Limited edition of one (you).", "Dashboard-approved.", "Agrees with you. Always."];

/* ------------------------------------------------------------------ */
/* Famous art — public-domain homages                                  */
/* ------------------------------------------------------------------ */

export interface ArtCredit {
  artist: string;
  year: string;
  titles: string[];
}

export const ART: Record<string, ArtCredit> = {
  wave: { artist: "Hokusai", year: "1831", titles: ["The Great Wave", "The Great Wave (of Emails)", "Monday, Approaching", "Surf's Up, 1831"] },
  starry: { artist: "Van Gogh", year: "1889", titles: ["The Starry Night", "Starry-ish Night", "Couldn't Sleep Either", "Night Sky, One Colour"] },
  mondrian: { artist: "Mondrian", year: "1930", titles: ["Composition in Black", "Composition with Opinions", "Grid, Unbothered", "Floor Plan of a Mood"] },
  malevich: { artist: "Malevich", year: "1915", titles: ["Suprematist Composition", "Shapes Having a Meeting", "Black Square (It's a Mood)", "Everything Is Tilted"] },
  kandinsky: { artist: "Kandinsky", year: "1913", titles: ["Squares with Concentric Circles", "Circles in Squares", "Twelve Moods", "Target Practice"] },
  klimt: { artist: "Klimt", year: "1909", titles: ["The Tree of Life", "Tree of Life (Spiral Edition)", "Branches, Overthinking", "Family Tree, Complicated"] },
  scream: { artist: "Munch", year: "1893", titles: ["The Scream", "The Scream (Monday Edition)", "When the Wi-Fi Drops", "Reading the Group Chat"] },
  vitruvian: { artist: "Leonardo", year: "c.1490", titles: ["Vitruvian Man", "Proportions, Approximately", "Stretching Before Work", "Four Arms, No Plans"] },
  pearl: { artist: "Vermeer", year: "c.1665", titles: ["Girl with a Pearl Earring", "The Pearl", "Looking Back, Unimpressed", "Just One Earring"] },
  mona: { artist: "Leonardo", year: "c.1503", titles: ["Mona Lisa", "Mona Lisa, Unimpressed", "She Knows What You Did", "The Original Selfie"] },
};

export const MUSEUM_MEDIUMS = ["Oil on canvas. Now cotton.", "Ink on cotton, 100% homage.", "On loan from art history.", "Please do not touch (the shirt is fine).", "Gift shop edition.", "Public domain, private wardrobe."];

/* ------------------------------------------------------------------ */
/* Iconic images                                                       */
/* ------------------------------------------------------------------ */

export const LANDMARK_INFO: Record<string, { name: string; place: string; coords: string; lines: string[] }> = {
  eiffel: { name: "Eiffel Tower", place: "PARIS", coords: "48.8584° N  2.2945° E", lines: ["Tall, dark and iron-ic.", "324 m of showing off.", "Built for a fair. Stayed for the view."] },
  liberty: { name: "Statue of Liberty", place: "NEW YORK", coords: "40.6892° N  74.0445° W", lines: ["Holding the torch since 1886.", "Arm day, every day.", "Green with patina, not envy."] },
  pisa: { name: "Leaning Tower", place: "PISA", coords: "43.7230° N  10.3966° E", lines: ["It's fine. Totally fine.", "Worth the lean.", "Leaning into it since 1178."] },
  bigben: { name: "Clock Tower", place: "LONDON", coords: "51.5007° N  0.1246° W", lines: ["Always on time. Very British about it.", "Bong. (Pardon.)", "Tea time is every hour."] },
  taj: { name: "Taj Mahal", place: "AGRA", coords: "27.1751° N  78.0421° E", lines: ["The ultimate grand gesture.", "Symmetry, but make it love.", "Flowers would have been fine."] },
  pyramids: { name: "The Pyramids", place: "GIZA", coords: "29.9792° N  31.1342° E", lines: ["Built to last. Still here.", "Triangles, but ancient.", "4,500 years, zero renovations."] },
  moai: { name: "Moai", place: "RAPA NUI", coords: "27.1127° S  109.3497° W", lines: ["Resting stone face.", "Staring contest champions.", "Unbothered for centuries."] },
  stonehenge: { name: "Stonehenge", place: "WILTSHIRE", coords: "51.1789° N  1.8262° W", lines: ["Ancient. Unexplained. Vibes.", "Some assembly required.", "The original rock band."] },
  colosseum: { name: "Colosseum", place: "ROME", coords: "41.8902° N  12.4922° E", lines: ["Wasn't built in a day either.", "Open-air seating, all of it.", "Needs a small repair."] },
  lighthouse: { name: "The Lighthouse", place: "THE COAST", coords: "somewhere, on a rock", lines: ["Keeping the light on for you.", "Stands alone. Shines anyway.", "Night shift, forever."] },
};

export const TRAVEL_TAGLINES: Record<string, string[]> = {
  eiffel: ["Come for the view. Stay for the croissants.", "The iron lady awaits."],
  liberty: ["Bring your tired, your poor, your snacks.", "The torch is on. Come on over."],
  pisa: ["It's worth the lean.", "Tilt your head and it's straight."],
  bigben: ["Right on time. Every time.", "Bring an umbrella. Just in case."],
  taj: ["Symmetry you can feel.", "Worth the sunrise alarm."],
  pyramids: ["Ancient, sunny, very pointy.", "The original triangles."],
  moai: ["Meet the locals. They won't blink.", "Faces you won't forget."],
  stonehenge: ["Rock-solid holidays.", "Ancient mystery, free parking."],
  colosseum: ["Gladiators not included.", "All roads lead here."],
  lighthouse: ["Ideal for introverts.", "Sea air, one bright idea."],
};

export const SPACE_CAPTIONS: Record<string, string[]> = {
  astronaut: ["SPACE IS THE PLACE", "NEED MORE SPACE", "OUT OF OFFICE (OUT OF ORBIT)", "HOUSTON, WE HAVE A VIBE"],
  footprint: ["ONE SMALL STEP", "LEAVE ONLY FOOTPRINTS", "FIRST DAY OUT", "STEPPED OUT FOR A BIT"],
  earthrise: ["EARTHRISE · 1968", "HOME, FROM A DISTANCE", "WISH YOU WERE HERE", "NO PLACE LIKE HOME"],
  launch: ["LAUNCH DAY", "T-MINUS FOREVER", "LIFTOFF CONFIRMED", "WE HAVE LIFTOFF (FINALLY)"],
};

export const MOTIF_CAPTIONS: Record<string, string[]> = {
  ufo: ["I WANT TO LEAVE", "TAKE ME WITH YOU", "NOT FROM AROUND HERE", "BEAM ME UP, ANYONE"],
  palms: ["OUT OF OFFICE", "PALM READING", "ENDLESS WEEKEND", "SUN'S OUT"],
  dna: ["IT'S IN MY DNA", "BORN THIS WAY", "GENETICALLY CHILL", "SOURCE CODE"],
  atom: ["NEVER TRUST AN ATOM — THEY MAKE UP EVERYTHING", "SMALL BUT MIGHTY", "POSITIVELY CHARGED", "SPLIT DECISION"],
  dove: ["PEACE & QUIET", "MOSTLY PEACEFUL", "BRING THE OLIVE BRANCH", "COO LIKE THAT"],
  anchor: ["STAY GROUNDED", "REFUSE TO SINK", "HOLD STEADY", "DEEPLY ANCHORED"],
  plane: ["SENT WITHOUT REVIEW", "FLY AWAY", "NOTE TO SELF", "AIRMAIL"],
};
