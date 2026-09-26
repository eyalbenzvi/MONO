"""
Model photos: the framing (analyze.py) once filled whatever it needed beyond
the generated picture by repeating the edge pixels, which shows as streaks
along the sides and bottom. This finds those strips on each framed photo
(rows or columns identical to their neighbour, from the edge in) and fills
them with the picture mirrored at the strip's inner edge, defocused towards
the edge. Both colour twins of a photo get the same fill.

  python scripts/models/unsmear.py
"""
import glob, os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
MODELS = os.path.join(ROOT, "public", "models")
FLAT, MARGIN, BLUR = 1.2, 3, 10


def run(lines):
    """How many lines, from the edge in, repeat their neighbour."""
    n = 0
    for a, b in zip(lines, lines[1:]):
        if np.mean(np.abs(a - b)) >= FLAT:
            break
        n += 1
    return n + MARGIN if n else 0


def strips(g):
    h, w = g.shape
    return {
        "left": run([g[:, i] for i in range(w)]),
        "right": run([g[:, w - 1 - i] for i in range(w)]),
        "top": run([g[i] for i in range(h)]),
        "bottom": run([g[h - 1 - i] for i in range(h)]),
    }


def fill(a, s):
    """Mirror the picture into each strip at its inner edge (a reflection is seamless there)."""
    a = a.copy()
    for side, n in s.items():
        if not n:
            continue
        t = a if side in ("top", "bottom") else a.T
        if side in ("bottom", "right"):
            t = t[::-1]
        for i in range(n):
            t[i] = t[2 * n - i]
    # The mirrored strip is defocused towards the edge (like the depth of field
    # around it), so a mirrored light or doorway never reads as a pattern.
    blurred = np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(BLUR))).astype(np.float32)
    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w]
    weight = np.zeros_like(a)
    for side, n in s.items():
        if not n:
            continue
        d = {"left": xx, "right": w - 1 - xx, "top": yy, "bottom": h - 1 - yy}[side]
        span = n * 2.0
        weight = np.maximum(weight, np.clip(1 - d / span, 0, 1) ** 0.8)
    return a * (1 - weight) + blurred * weight


for white in sorted(glob.glob(os.path.join(MODELS, "*-white.webp"))):
    black = white.replace("-white", "-black")
    g = np.asarray(Image.open(white).convert("L")).astype(np.float32)
    s = strips(g)
    if not any(s.values()):
        continue
    for f in (white, black):
        a = np.asarray(Image.open(f).convert("L")).astype(np.float32)
        Image.fromarray(np.clip(fill(a, s), 0, 255).astype(np.uint8)).save(f, quality=86, method=6)
    print(os.path.basename(white)[:3], s)
