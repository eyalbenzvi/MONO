"""
HOW TO GO TO BED: a dog's bedtime as numbered steps, four of them "Turn around." Seven brush drawings of
one dog (ChatGPT, the owner's three runs of one prompt: original-1/2/3.jpg, the same dog and brush;
original-3's last drawing carries a stray "b" and isn't used), each at one scale so the dog
stays one size, set in a grid under the heading; type in Libre Caslon.

  python data/studio/best1/02-1-how-to-go-to-bed/sources/build.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))
import kit  # noqa: E402

A, B, C = HERE / "original-2.jpg", HERE / "original-3.jpg", HERE / "original-1.jpg"
# The turns tighten step by step: looking up, looking back over the shoulder, curling, and (original-1's
# drawing, with its motion arcs) spinning head to tail; then down, then the sigh.
STEPS = [
    ("1. Choose the spot.", A, (206, 56, 566, 251)),
    ("2. Turn around.", B, (212, 304, 529, 537)),
    ("3. Turn around.", B, (200, 595, 505, 829)),
    ("4. Turn around.", A, (271, 590, 487, 827)),
    ("5. Turn around.", C, (287, 538, 573, 754)),
    ("6. Lie down.", A, (260, 892, 511, 1056)),
    ("7. Sigh.", A, (253, 1141, 513, 1311)),
]
# original-1 draws the dog a little smaller on its canvas: its curled dog is 264 px across to original-2's 251.
SRC_SCALE = {A: 1.0, B: 1.0, C: 251 / 264}
PAD = 6  # px of margin kept round each crop

COL_X = (80, 200)  # the two columns, drawn in towards the centre
CAP = 10.6  # the captions' font size, mm
CAP_GAP = 11.5  # ground line to caption baseline
ROW_GAP = 5.5  # caption baseline to the next row's tallest drawing
TOP_ART = 36.0  # where the drawings start, under the heading
BOTTOM = 362.0  # the last caption's baseline

from PIL import ImageFont  # noqa: E402

body = []
# The heading at the full measure (measured in the font), heavier (the owner took the moon out from under it).
TITLE, TRACK = "HOW TO GO TO BED", 0.11
f1k = ImageFont.truetype(str(kit.FONTS / "libre-caslon-text.ttf"), 1000)
tsize = 252 / ((f1k.getlength(TITLE) + TRACK * 1000 * (len(TITLE) - 1)) / 1000)
body.append(f'<text x="140" y="22" text-anchor="middle" font-family="Libre Caslon Text" font-size="{tsize:.2f}" letter-spacing="{TRACK * tsize:.2f}" fill="black" stroke="black" stroke-width="0.45" stroke-linejoin="round">{TITLE}</text>')

# Rows of two (the last alone), each as tall as its tallest drawing; the scale chosen so the rows fill the height.
crops = [(c, src, (x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD)) for c, src, (x0, y0, x1, y1) in STEPS]
rows = [crops[0:2], crops[2:4], crops[4:6], crops[6:7]]
tall_px = sum(max((b[3] - b[1]) * SRC_SCALE[src] for _, src, b in row) for row in rows)
fixed = len(rows) * CAP_GAP + (len(rows) - 1) * ROW_GAP
MM_PER_PX = (BOTTOM - TOP_ART - fixed) / tall_px
# ... but no drawing wider than its column allows.
MM_PER_PX = min(MM_PER_PX, 112 / max((b[2] - b[0]) * SRC_SCALE[src] for _, src, b in crops))
y = TOP_ART
for r, row in enumerate(rows):
    tallest = max((b[3] - b[1]) * SRC_SCALE[src] * MM_PER_PX for _, src, b in row)
    ground = y + tallest
    for c, (caption, src, box) in enumerate(row):
        # Thicker brush (grow), and the filled far legs kept as outlines (no blots of ink).
        uri, w, h = kit.line_art(src, box, level=150, median=3, scale=3, grow=3, hollow=(22, 8))
        k = SRC_SCALE[src] * MM_PER_PX
        wmm, hmm = (box[2] - box[0]) * k, (box[3] - box[1]) * k
        cx = 140 if len(row) == 1 else COL_X[c]
        body.append(f'<image x="{cx - wmm / 2:.2f}" y="{ground - hmm:.2f}" width="{wmm:.2f}" height="{hmm:.2f}" xlink:href="{uri}" preserveAspectRatio="none"/>')
        body.append(f'<text x="{cx}" y="{ground + CAP_GAP:.2f}" text-anchor="middle" font-family="Libre Caslon Text" font-style="italic" font-size="{CAP}" fill="black" stroke="black" stroke-width="0.36" stroke-linejoin="round">{kit.esc(caption)}</text>')
    y = ground + CAP_GAP + ROW_GAP
print("mm per px", round(MM_PER_PX, 3))

ink = kit.render("".join(body), HERE / ".render")
ink = kit.despeck(ink)
kit.deliver(ink, HERE.parent, "how-to-go-to-bed", "both", {"wit": 0.85, "pictorial": 0.7, "line_art": 0.75, "typography": 0.45, "nature": 0.35, "classic": 0.35, "clean_minimal": 0.55, "retro": 0.2, "contrast": 0.7, "density": 0.25}, tee_default="black")
