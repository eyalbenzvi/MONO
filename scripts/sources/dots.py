"""
Make artwork's screen for a photograph: the AM round-dot screen of
scripts/photos/halftone.py (dots at 45 degrees, the darkest capped short of a
solid mass), at a pitch sized for the small frame the picture prints in,
written as vector dots rather than pixels.

  python scripts/sources/dots.py <master.webp> <out.json> [--pitch P]

The master is scripts/archive prepImage's photo print (grey, alpha where
the picture is). Its paper level is taken off as halftone.py takes it; each
cell of the rotated grid gets a dot whose area is the cell's darkness, at
most MAX_TONE (and never touching its neighbours), none under a speck.
Out: {"w", "h", "rings": [], "dots": [x, y, r, ...]} in the crop's pixels
(r in tenths of a pixel). Numbers only on stdout.
"""
import json, math, sys

import numpy as np
from PIL import Image

args = sys.argv[1:]
src, out = args[0], args[1]
pitch = float(args[args.index("--pitch") + 1]) if "--pitch" in args else 14.0
MAX_TONE = 0.7

im = np.asarray(Image.open(src).convert("LA")).astype(np.float32) / 255
grey, alpha = im[:, :, 0], im[:, :, 1]
inside = alpha > 0.5
ys, xs = np.nonzero(inside)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
g = grey[y0:y1, x0:x1]
a = inside[y0:y1, x0:x1]
dark = np.where(a, 1 - g, 0)
# The paper's residual tone (the lightest tenth of the picture) comes off first.
paper = np.percentile(dark[a], 10) if a.any() else 0
dark = np.clip((dark - paper) / max(1e-3, 1 - paper), 0, 1)
h, w = dark.shape
c, s = math.cos(math.radians(45)), math.sin(math.radians(45))
dots = []
rmax = pitch * math.sqrt(MAX_TONE / math.pi)
span = int(math.hypot(w, h) / pitch) + 2
cx, cy = w / 2, h / 2
for i in range(-span, span + 1):
    for j in range(-span, span + 1):
        u, v = i * pitch, j * pitch
        x, y = cx + u * c - v * s, cy + u * s + v * c
        if not (0 <= x < w and 0 <= y < h):
            continue
        # The cell's mean darkness.
        r0 = int(pitch / 2)
        cell = dark[max(0, int(y) - r0):int(y) + r0 + 1, max(0, int(x) - r0):int(x) + r0 + 1]
        t = float(cell.mean()) if cell.size else 0
        r = min(rmax, pitch * math.sqrt(t / math.pi))
        if r < pitch * 0.12:
            continue
        dots += [int(round(x)), int(round(y)), int(round(r * 10))]
json.dump({"w": int(w), "h": int(h), "rings": [], "dots": dots}, open(out, "w"), separators=(",", ":"))
print(json.dumps({"w": int(w), "h": int(h), "dots": len(dots) // 3, "rings": 0, "points": len(dots) // 3}))
