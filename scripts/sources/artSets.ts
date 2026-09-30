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
  ia: string;
  find: string[];
  author: string;
  year: number;
  plate: string;
  /** The rights, as the licence check reads them. */
  rights: string;
  /** Tracing: specks under this many pixels go; outlines simplified by this many. */
  minArea?: number;
  eps?: number;
  /** Lines thickened by this many pixels of the master (750 wide) before tracing. */
  grow?: number;
}

const MARSH = { grow: 1, ia: "dinosaursofnort00mars", author: "O. C. Marsh", year: 1896, rights: "US government work (USGS, Sixteenth Annual Report, part 1, 1896); public domain" };

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
};
