/**
 * A Victorian sampler's stitch patterns as pixel grids ("X" a stitch): six
 * borders (tiles three stitches deep, repeated round the edge, turned for the
 * sides) and eight motifs (eleven by eleven: tree, house, geometric heart,
 * star, bird, flower, crown, ship). The template stitches every cell as an X.
 */
export const BORDERS = ["zigzag", "diamonds", "chequer", "ladder", "waves", "teeth"] as const;
export type Border = (typeof BORDERS)[number];
export const BORDER_NAMES: Record<Border, string> = { zigzag: "Zigzag", diamonds: "Diamonds", chequer: "Chequer", ladder: "Ladder", waves: "Waves", teeth: "Teeth" };

/** Each border's tile: three rows, repeated along the top (the outer row first). */
export const BORDER_TILES: Record<Border, string[]> = {
  zigzag: ["X...", ".X.X", "..X."],
  diamonds: [".X..", "X.X.", ".X.."],
  chequer: ["X.", ".X", "X."],
  ladder: ["XXXX", ".X..", "XXXX"],
  waves: [".XX...", "X..X..", "....XX"],
  teeth: ["XXXX", ".XX.", "...."],
};

export const MOTIFS = ["tree", "house", "heart", "star", "bird", "flower", "crown", "ship"] as const;
export type Motif = (typeof MOTIFS)[number];
export const MOTIF_NAMES: Record<Motif, string> = { tree: "Tree", house: "House", heart: "Heart", star: "Star", bird: "Bird", flower: "Flower", crown: "Crown", ship: "Ship" };

export const MOTIF_GRIDS: Record<Motif, string[]> = {
  tree: ["....XXX....", "...XXXXX...", "..XX.X.XX..", ".XXXXXXXXX.", "..XX.X.XX..", ".XXXXXXXXX.", "XXX..X..XXX", ".....X.....", ".....X.....", "....XXX....", "...XXXXX..."],
  house: [".....X.....", "....X.X....", "...X...X...", "..X.....X..", ".XXXXXXXXX.", ".X.......X.", ".X.XX.XX.X.", ".X.XX.XX.X.", ".X.......X.", ".X...XX..X.", ".XXXXXXXXX."],
  heart: ["...........", ".XXX...XXX.", "X...X.X...X", "X....X....X", "X.........X", ".X.......X.", "..X.....X..", "...X...X...", "....X.X....", ".....X.....", "..........."],
  star: [".....X.....", ".....X.....", "....XXX....", "XXXXX.XXXXX", ".XX.....XX.", "..X.....X..", "..X..X..X..", ".X..X.X..X.", ".X.X...X.X.", "XXX.....XXX", "..........."],
  bird: ["...........", "..XX.......", ".XXXX......", "XX.XX......", "..XXXX..XX.", "...XXXXXXX.", "...XXXXXX..", "....XXXX...", ".....X.X...", ".....X.X...", "....XX.XX.."],
  flower: ["....X.X....", "...X.X.X...", "..X..X..X..", "...X.X.X...", "....XXX....", ".....X.....", "..XX.X.XX..", ".X..XXX..X.", "..XX.X.XX..", ".....X.....", "...XXXXX..."],
  crown: ["...........", "X....X....X", "XX..XXX..XX", "X.X.X.X.X.X", "X..X...X..X", "X.........X", "XXXXXXXXXXX", "X.X.X.X.X.X", "XXXXXXXXXXX", "...........", "..........."],
  ship: [".....X.....", ".....XX....", ".....XXX...", ".....XXXX..", ".XX..XXXXX.", ".XXX.X.....", ".XXXXX.....", ".....X.....", "XXXXXXXXXXX", ".XXXXXXXXX.", "..XXXXXXX.."],
};
