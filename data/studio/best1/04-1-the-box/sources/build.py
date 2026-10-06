"""
THE BOX: three numbered panels and one dry line, BOX NOT SOLD SEPARATELY. 1: hands lift a plush cat bed out of its delivery box;
2: they offer it to a tabby, who looks away; 3: the tabby sits in the empty box, eyes half shut, the bed
abandoned beside it. The panels are the owner's ChatGPT drawing (original-3.jpg, the third of three runs
of one prompt: the boldest line), each kept with its own frame: the payoff (3) large, 1 and 2 as insets above it; numerals and the line in Oswald.

  python data/studio/best1/04-1-the-box/sources/build.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))
import kit  # noqa: E402

SRC = HERE / "original-3.jpg"
PANELS = [(152, 25, 618, 448), (81, 477, 672, 900), (100, 927, 698, 1352)]
FRAME = (152, 617)  # the frames' left and right edges in the source, the same in all three panels
FRAME_Y = [(25, 448), (477, 900), (927, 1352)]  # each frame's top and bottom

# Panel 3, the payoff, large; 1 and 2 side by side above it as insets, the three frames on one column.
S3 = 0.42  # mm per source px for panel 3
COL_W = (FRAME[1] - FRAME[0]) * S3
COL_X = 140 - COL_W / 2
GUTTER = 10.0
S12 = ((COL_W - GUTTER) / 2) / (FRAME[1] - FRAME[0])
TOP = 9.0

body = []


def place(k, s, fx, fy):
    """Panel k at scale s with its frame's top-left corner at (fx, fy) mm; its numeral inside that corner."""
    x0, y0, x1, y1 = PANELS[k]
    # Inset 2's arms and tail ran out past its frame: cut at the frame (side by side, they would cross panel 1).
    clip = (FRAME[0] - 1, y0, FRAME[1] + 1, y1) if k == 1 else None
    uri, w, h = kit.line_art(SRC, (x0, y0, x1, y1), level=150, median=3, scale=3, grow=2, clip=clip)
    x = fx - (FRAME[0] - x0) * s
    y = fy - (FRAME_Y[k][0] - y0) * s
    body.append(f'<image x="{x:.2f}" y="{y:.2f}" width="{(x1 - x0) * s:.2f}" height="{(y1 - y0) * s:.2f}" xlink:href="{uri}" preserveAspectRatio="none"/>')
    size = 15 if k < 2 else 19
    body.append(f'<text x="{fx + 4.2:.2f}" y="{fy + 3.5 + size * 0.74:.2f}" font-family="Oswald" font-size="{size}" fill="black" stroke="black" stroke-width="0.45" stroke-linejoin="round">{k + 1}</text>')
    return fy + (FRAME_Y[k][1] - FRAME_Y[k][0]) * s


bottom12 = max(place(0, S12, COL_X, TOP), place(1, S12, COL_X + COL_W / 2 + GUTTER / 2, TOP))
bottom3 = place(2, S3, COL_X, bottom12 + GUTTER)
# One dry line under the payoff.
body.append(f'<text x="140" y="{bottom3 + 13:.2f}" text-anchor="middle" font-family="Oswald" font-size="9.5" letter-spacing="1.1" fill="black" stroke="black" stroke-width="0.2" stroke-linejoin="round">BOX NOT SOLD SEPARATELY.</text>')

ink = kit.render("".join(body), HERE / ".render")
ink = kit.despeck(ink)
kit.deliver(ink, HERE.parent, "the-box", "both", {"wit": 0.9, "pictorial": 0.85, "line_art": 0.8, "figurative": 0.35, "nature": 0.3, "retro": 0.45, "classic": 0.2, "typography": 0.15, "contrast": 0.7, "density": 0.45}, tee_default="white")
