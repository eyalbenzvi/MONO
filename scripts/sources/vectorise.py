"""
Make artwork's last step: a prepared master (scripts/archive prepImage: the
ink as alpha, 750 x 1000) traced to one-ink vector outlines, for templates
that draw it as SVG paths (no images in a print).

  python scripts/sources/vectorise.py <master.webp> <out.json> [--min-area N] [--eps E] [--grow G]

The ink is the alpha at half strength and over, thickened by G pixels (a
hairline engraving grows to a line a screen holds); specks under N pixels go;
the rest is cropped to its box and traced (OpenCV contours, outer and hole
rings, each simplified by E pixels). Out: {"w", "h", "rings": [[x, y, x, y, ...], ...]}
in the crop's whole pixels, drawn even-odd (a hole is a ring inside a ring).
Numbers only on stdout.
"""
import json, sys

import cv2
import numpy as np
from PIL import Image

args = sys.argv[1:]
src, out = args[0], args[1]
min_area = int(args[args.index("--min-area") + 1]) if "--min-area" in args else 6
eps = float(args[args.index("--eps") + 1]) if "--eps" in args else 0.7
grow = int(args[args.index("--grow") + 1]) if "--grow" in args else 0

alpha = np.asarray(Image.open(src).convert("RGBA"))[:, :, 3]
ink = (alpha >= 128).astype(np.uint8)
if grow:
    ink = cv2.dilate(ink, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1)))
# Specks: connected bits smaller than min_area pixels.
n, labels, stats, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
keep = np.zeros(n, dtype=bool)
keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= min_area
ink = keep[labels].astype(np.uint8)
ys, xs = np.nonzero(ink)
if not len(xs):
    print(json.dumps({"rings": 0}))
    sys.exit(1)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
crop = np.ascontiguousarray(ink[y0:y1, x0:x1])
contours, _ = cv2.findContours(crop, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
rings = []
points = 0
for c in contours:
    a = cv2.approxPolyDP(c, eps, True).reshape(-1, 2)
    if len(a) < 3:
        continue
    rings.append([int(v) for v in a.flatten()])
    points += len(a)
json.dump({"w": int(x1 - x0), "h": int(y1 - y0), "rings": rings}, open(out, "w"), separators=(",", ":"))
print(json.dumps({"w": int(x1 - x0), "h": int(y1 - y0), "rings": len(rings), "points": points, "inked": round(float(crop.mean()), 4)}))
