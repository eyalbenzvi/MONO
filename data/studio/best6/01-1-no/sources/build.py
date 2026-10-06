"""
NO. (third redraw): the owner's third Gemini redraw (the paw now presses the full stop; a deadpan, half-lidded stare) on the second redraw: bolder letters cut with a few wide
white strokes, the full stop solid on the baseline, a white gap between the tail and the N. Built as the first
redraw; the letters and the full stop are kept as drawn (owner's exception to the no-slab rule).

Earlier note: NO. (redrawn): the owner's Gemini redraw of best3's "No." as one hand-inked drawing, the cat and the letters
in a single brush (gemini-no-3.png). A smug cat lies along the top of a hand-cut "NO", its tail down the front of
the N; its paw has just batted the full stop off the end of the line and the dot is falling.
Here: the drawing enlarged to print size from its grey (smooth edges), cut to one ink, specks taken out, and the
two solid masses (the tail's dark end and the falling dot) opened into brush strands so no slab of ink is wider
than 4 mm.

  python data/studio/best6/01-1-no/sources/build.py
"""
import sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[2] / "best1"))
import kit  # noqa: E402

PX = kit.PX_MM
W, H = kit.W, kit.H
mm = lambda v: int(round(v * PX))
ell = lambda d: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (d, d))

src = np.asarray(Image.open(HERE / "gemini-no-3.png").convert("L")).astype(np.float32)
# The drawing's own extent (its paper margin dropped).
ys, xs = np.nonzero(src < 128)
src = src[max(0, ys.min() - 4):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5]

WIDTH = 270.0  # mm across the print
cw = mm(WIDTH)
ch = round(src.shape[0] * cw / src.shape[1])
big = cv2.resize(src, (cw, ch), interpolation=cv2.INTER_LANCZOS4)
big = cv2.GaussianBlur(big, (0, 0), 1.4)
art = (big < 140).astype(np.uint8)
art = cv2.morphologyEx(art, cv2.MORPH_OPEN, ell(3))

# Solid masses wider than 4 mm (the tail's dark end, the dot): opened into brush strands that run with the form,
# keeping a solid edge round each, so they print as dense dry-brush, not a slab.
core = cv2.erode(art, ell(mm(4.0)))
slab = cv2.dilate(core, ell(mm(4.0))) & art
# Only the real masses: the small knots where a hatch line meets a letter's outline stay as drawn.
n_, lab_, st_, cen_ = cv2.connectedComponentsWithStats(slab)
big_ = np.zeros(n_, bool)
big_[1:] = st_[1:, cv2.CC_STAT_AREA] > mm(9.0) ** 2
# ...and only the tail and the dark fur under the body: a knot where the O meets the baseline stays solid as drawn
# (striped, it read as a stray tab).
big_[1:] &= (cen_[1:, 0] < 0.11 * cw) | (cen_[1:, 1] < 0.44 * ch)  # the letters' cut strokes stay as drawn
slab = big_[lab_].astype(np.uint8)
if slab.any():
    inner = cv2.erode(slab, ell(mm(1.6)))
    yy, xx = np.mgrid[0:ch, 0:cw].astype(np.float32) / PX
    # Strands: along the tail (near vertical, leaning with it), with a slow wobble; gap 0.9 mm every 2.2 mm (open enough to hold on the screen).
    phase = xx * np.cos(np.radians(12)) + yy * np.sin(np.radians(12)) + 0.35 * np.sin(yy / 6.0) + 0.2 * np.sin(yy / 2.3 + xx)
    gaps = (np.mod(phase, 2.2) < 0.9)
    art[(inner > 0) & gaps] = 0

art = kit.despeck(art, 0.6)

ink = np.zeros((H, W), np.uint8)
ox, oy = (W - cw) // 2, mm(20)
ink[oy:oy + ch, ox:ox + cw] = art[:min(ch, H - oy)]

kit.deliver(ink, HERE.parent, "no", "both", {"wit": 0.9, "typography": 0.8, "pictorial": 0.65, "nature": 0.25, "line_art": 0.75, "retro": 0.35, "classic": 0.3, "clean_minimal": 0.4, "contrast": 0.8, "density": 0.45}, tee_default="white")
