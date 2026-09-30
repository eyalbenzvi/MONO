/**
 * The Make prints' artwork, by name (scripts/sources/makeArt.ts): each
 * picture's book on the Internet Archive and the words of its caption there,
 * which find the page. Every one public domain: published in the United
 * States before 1929, or a work of the US government.
 */
export interface ArtItem {
  id: string;
  /** How the print names it. */
  name: string;
  /** The Internet Archive item (a scanned book or paper) and the words the plate's page holds. */
  ia?: string;
  find?: string[];
  author?: string;
  year?: number;
  plate?: string;
  /** The rights, as the licence check reads them (Internet Archive items; Commons files carry their own). */
  rights?: string;
  /** Wikimedia Commons instead: the searches, and the words a file's title or description must hold (a regular expression). */
  commons?: { queries: string[]; must: string };
  /** Tracing: specks under this many pixels go; outlines simplified by this many. */
  minArea?: number;
  eps?: number;
  /** Lines thickened by this many pixels of the master (750 wide) before tracing. */
  grow?: number;
  /** The master traced at this scale (a picture printed small needs fewer points). */
  scale?: number;
}

const MARSH = { grow: 1, ia: "dinosaursofnort00mars", author: "O. C. Marsh", year: 1896, rights: "US government work (USGS, Sixteenth Annual Report, part 1, 1896); public domain" };

/**
 * A landmark on Commons: within its own category and those under it (the
 * subject, as Commons' editors filed it), an engraving or a drawing searched
 * first, then any picture, then the name searched plainly; the words a file
 * must hold on top.
 */
/** Searches of their own for the landmarks whose own category holds little under a free licence. */
const MORE: Record<string, string[]> = { machupicchu: ["Machu Picchu 1911", "Machu Picchu Bingham", "Machupicchu"] };
const lm = (id: string, name: string, category: string, must: string): ArtItem => {
  // deepcat finds nothing for a category with too many under it; its own files (incategory), then the name alone, follow.
  const [deep, own] = [`deepcat:"${category}"`, `incategory:"${category}"`];
  return { id, name, commons: { queries: [`${deep} engraving`, `${deep} drawing`, `${deep} lithograph`, deep, `${own} engraving`, own, `${name} engraving`, name, ...(MORE[id] ?? [])], must }, scale: 0.5, eps: 0.8, minArea: 4 };
};

export const ART_SETS: Record<string, ArtItem[]> = {
  /**
   * Your Dinosaur. Four from Marsh, The Dinosaurs of North America (1896); the
   * four animals his book doesn't restore (Tyrannosaurus was named after his
   * death; he drew no whole Allosaurus, Diplodocus or pterosaur) from the
   * public-domain monographs that first did.
   */
  dinosaurs: [
    { id: "triceratops", name: "Triceratops", ...MARSH, find: ["RESTORATION OF TRICERATOPS PRORSUS"], plate: "Plate LXXI" },
    { id: "stegosaurus", name: "Stegosaurus", ...MARSH, find: ["RESTORATION OF STEGOSAURUS UNGULATUS"], plate: "Plate LII" },
    { id: "brontosaurus", name: "Brontosaurus", ...MARSH, find: ["RESTORATION OF BRONTOSAURUS EXCELSUS"], plate: "Plate XLII" },
    { id: "iguanodon", name: "Iguanodon", ...MARSH, find: ["RESTORATION OF IGUANODON BERNISSARTENSIS"], plate: "Plate LXXXV" },
    { id: "tyrannosaurus", grow: 1, name: "Tyrannosaurus", ia: "bulletin-american-museum-natural-history-35-733-771", find: ["Fig. 18. Mounted skeleton of Tyrannosaurus"], author: "H. F. Osborn", year: 1916, plate: "Fig. 18", rights: "Public domain (published in the United States in 1916)" },
    { id: "allosaurus", name: "Allosaurus", ia: "osteologyofcarni00gilm", find: ["RESTORATION OF ANTRODEMUS VALENS"], author: "C. W. Gilmore", year: 1920, plate: "Plate 16", rights: "US government work (US National Museum Bulletin 110, 1920); public domain" },
    { id: "diplodocus", grow: 1, name: "Diplodocus", ia: "diplodocusmarshi11hatc", find: ["DIPLODOCVS"], author: "J. B. Hatcher", year: 1901, plate: "Plate XIII", rights: "Public domain (published in the United States in 1901)" },
    { id: "pteranodon", grow: 1, name: "Pteranodon", ia: "osteologyofptera00eatorich", find: ["Plate XXXI. Restoration of Pteranodon"], author: "G. F. Eaton", year: 1910, plate: "Plate XXXI", rights: "Public domain (published in the United States in 1910)" },
  ],
  /**
   * Your Landmarks: 24, each from Wikimedia Commons under a public-domain or
   * CC0 licence (the licence check reads each file's own), chosen by the
   * numbers: the metadata's score, then the converted drawing's checks.
   */
  landmarks: [
    lm("eiffel", "Eiffel Tower", "Eiffel Tower", "eiffel"),
    lm("colosseum", "Colosseum", "Colosseum", "colosse|coliseum|colosseo|flavian amphitheat"),
    lm("bigben", "Big Ben", "Elizabeth Tower", "elizabeth tower|clock tower.{0,40}(westminster|london|parliament)|(westminster|parliament).{0,40}(clock|tower)|big ben.{0,40}(london|westminster|tower|clock|parliament)|(london|westminster|parliament).{0,40}big ben"),
    lm("tajmahal", "Taj Mahal", "Taj Mahal", "taj mahal"),
    lm("giza", "Pyramids of Giza", "Giza pyramid complex", "giza|gizeh|great pyramid"),
    lm("machupicchu", "Machu Picchu", "Machu Picchu", "machu ?picchu"),
    lm("greatwall", "Great Wall of China", "Great Wall of China", "great wall"),
    lm("sydneyopera", "Sydney Opera House", "Sydney Opera House", "sydney opera house"),
    lm("goldengate", "Golden Gate Bridge", "Golden Gate Bridge", "golden gate bridge"),
    lm("liberty", "Statue of Liberty", "Statue of Liberty", "statue of liberty|liberty enlightening"),
    lm("westernwall", "Western Wall", "Western Wall", "western wall|wailing wall|kotel"),
    lm("petra", "Petra", "Al-Khazneh", "khazneh|treasury|petra.{0,40}jordan|jordan.{0,40}petra|petra.{0,20}(tomb|temple|monastery|siq)"),
    lm("acropolis", "Acropolis", "Acropolis of Athens", "acropolis.{0,40}athens|athens.{0,40}acropolis|parthenon"),
    lm("sagrada", "Sagrada Família", "Sagrada Família", "sagrada fam[ií]lia.{0,60}(barcelona|gaud|bas[ií]lica|templ|fa[cç]ade)|(barcelona|gaud).{0,60}sagrada"),
    lm("towerbridge", "Tower Bridge", "Tower Bridge", "tower bridge"),
    lm("pisa", "Leaning Tower of Pisa", "Leaning Tower of Pisa", "leaning tower|torre di pisa|tower of pisa|campanile.{0,40}pisa|pisa.{0,40}(tower|campanile)"),
    lm("redeemer", "Christ the Redeemer", "Christ the Redeemer (statue)", "cristo redentor|corcovado|christ the redeemer.{0,60}(rio|corcovado|brazil|statue)"),
    lm("fuji", "Mount Fuji", "Mount Fuji", "fuji"),
    lm("angkor", "Angkor Wat", "Angkor Wat", "angkor wat"),
    lm("brandenburg", "Brandenburg Gate", "Brandenburg Gate", "brandenburg(er)? ?(gate|tor)"),
    lm("burjkhalifa", "Burj Khalifa", "Burj Khalifa", "burj khalifa"),
    lm("empirestate", "Empire State Building", "Empire State Building", "empire state building"),
    lm("neuschwanstein", "Neuschwanstein", "Neuschwanstein Castle", "neuschwanstein"),
    lm("santorini", "Santorini", "Santorini", "santorini|thera|\\boia\\b"),
  ],
};
