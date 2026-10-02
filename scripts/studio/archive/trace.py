"""Trace an archive line image (woodcut, engraving, etching) to a one-ink print, the way the studio's
archive designs were made (docs/content/design-loop.md). No image model: the lines are the source's own.

  python3 scripts/studio/archive/trace.py SOURCE.png OUT_PREFIX --scale S [--crop x0,y0,x1,y1]
      [--seam '[[x,y],...]'] [--circle cx,cy,diam_mm] [--th 0.45] [--caption "..."] [--font cinzel-bold.ttf]
      [--track 0.0] [--cap-width-mm 225] [--mask 'x0,y0,x1,y1;...']

Steps: paper flattened (divided by a dilated blur), the kept area (crop, seam polygon keeping everything to
its right, or a microscope-field circle with a 0.7 mm keyline) upscaled with Lanczos to print scale BEFORE the
threshold (lines stay continuous), an adaptive threshold (stricter in dark masses so cross-hatching stays open),
every line's skeleton redrawn at 0.42 mm or more (the shop's 0.4 mm minimum), specks under 0.5 mm dropped.
--scale is print px per source px. Check printability first: measure the source's hatch spacing (px) and
keep spacing × scale ≥ 9 px (0.75 mm at 300 DPI), or the hatching plugs.

Writes OUT_PREFIX-white.png (RGBA, ink in alpha, 3307 × 4370 = 28 × 37 cm at 300 DPI), OUT_PREFIX-tee.png
(on a white tee, full size), OUT_PREFIX-s.png (700 px preview) and prints oneink.check's measures.
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from skimage.morphology import skeletonize

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import oneink  # noqa: E402
from oneink import PX_MM, disc  # noqa: E402

W, H = 3307, 4370
FONTS = os.path.join(os.path.dirname(__file__), "..", "..", "..", "assets", "fonts")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("source"); p.add_argument("out")
    p.add_argument("--scale", type=float, required=True)
    p.add_argument("--crop"); p.add_argument("--seam"); p.add_argument("--circle"); p.add_argument("--mask")
    p.add_argument("--th", type=float, default=0.45)
    p.add_argument("--caption", default=""); p.add_argument("--font", default="libre-caslon-text-bold.ttf")
    p.add_argument("--track", type=float, default=0.0); p.add_argument("--cap-width-mm", type=float, default=225)
    p.add_argument("--top-mm", type=float, default=14)
    a = p.parse_args()
    Image.MAX_IMAGE_PIXELS = None
    g = np.asarray(Image.open(a.source).convert("L")).astype(np.float32)
    for box in (a.mask or "").split(";"):
        if box.strip():
            x0, y0, x1, y1 = map(int, box.split(",")); g[y0:y1, x0:x1] = 255
    if a.seam:
        seam = json.loads(a.seam); keep = np.zeros_like(g, np.uint8)
        poly = seam + [[g.shape[1], seam[-1][1]], [g.shape[1], seam[0][1]]]
        cv2.fillPoly(keep, [np.array(poly, np.int32)], 1); g = np.where(keep > 0, g, 255)
    circle = None
    if a.circle:
        cx, cy, dmm = a.circle.split(","); cx, cy, dmm = int(cx), int(cy), float(dmm)
        r = int(dmm / 2 * PX_MM / a.scale)
        pad = np.full((2 * r, 2 * r), 255, np.float32)
        X0, Y0, X1, Y1 = max(0, cx - r), max(0, cy - r), min(g.shape[1], cx + r), min(g.shape[0], cy + r)
        pad[Y0 - (cy - r):Y1 - (cy - r), X0 - (cx - r):X1 - (cx - r)] = g[Y0:Y1, X0:X1]
        g = pad; circle = True
    elif a.crop:
        x0, y0, x1, y1 = map(int, a.crop.split(",")); g = g[y0:y1, x0:x1]
    bgd = cv2.GaussianBlur(cv2.dilate(g, np.ones((31, 31), np.uint8)), (0, 0), 18)
    n = np.clip(g / np.maximum(bgd, 1), 0, 1)
    up = cv2.resize(n, None, fx=a.scale, fy=a.scale, interpolation=cv2.INTER_LANCZOS4 if a.scale >= 1 else cv2.INTER_AREA)
    up = cv2.GaussianBlur(up, (0, 0), 0.6)
    loc = cv2.GaussianBlur(up, (0, 0), 3 * PX_MM)
    ink = (up < a.th - 0.09 * np.clip((0.62 - loc) / 0.3, 0, 1)).astype(np.uint8)
    inside = None
    if circle:
        D = up.shape[0]; yy, xx = np.mgrid[0:D, 0:D]; R = D / 2
        inside = ((xx - R + 0.5) ** 2 + (yy - R + 0.5) ** 2) <= (R - 1.5 * PX_MM) ** 2
        ink[~inside] = 0
    k, lab, st, _ = cv2.connectedComponentsWithStats(ink); keep = np.zeros(k, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] > 14; ink = keep[lab].astype(np.uint8)
    ink = np.maximum(ink, cv2.dilate(skeletonize(ink > 0).astype(np.uint8), disc(2.6)))
    if circle:
        ink[~inside] = 0
        m = int(4 * PX_MM); big = np.zeros((ink.shape[0] + 2 * m, ink.shape[1] + 2 * m), np.uint8); big[m:-m, m:-m] = ink
        R2 = big.shape[0] / 2
        cv2.circle(big, (int(R2), int(R2)), int(R2 - m - 1.5 * PX_MM + 2.5 * PX_MM), 1, max(1, round(0.7 * PX_MM)), cv2.LINE_AA)
        ink = big
    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disc(0.2 * PX_MM - 0.01))
    k, lab, st, _ = cv2.connectedComponentsWithStats(ink); keep = np.zeros(k, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] > (0.5 * PX_MM) ** 2 * 2; ink = keep[lab].astype(np.uint8)
    ys, xs = np.nonzero(ink); ink = ink[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; ah, aw = ink.shape
    top = int(a.top_mm * PX_MM)
    if top + ah > H or aw > W:
        sys.exit(f"art {aw / PX_MM:.0f} × {ah / PX_MM:.0f} mm does not fit the 280 × 370 mm area at this scale")
    c = np.zeros((H, W), np.uint8); x0 = (W - aw) // 2; c[top:top + ah, x0:x0 + aw] = ink
    if a.caption:
        F = os.path.join(FONTS, a.font); target = a.cap_width_mm * PX_MM

        def width(sz):
            f = ImageFont.truetype(F, sz)
            return sum(f.getlength(ch) for ch in a.caption) + a.track * sz * (len(a.caption) - 1), f
        lo, hi = 20, 900
        while hi - lo > 1:
            mid = (lo + hi) // 2; lo, hi = (mid, hi) if width(mid)[0] <= target else (lo, mid)
        tw, f = width(lo); cb = f.getbbox("H")
        m2 = Image.new("L", (W, H), 0); d = ImageDraw.Draw(m2); x = (W - tw) / 2; y = top + ah + int(10 * PX_MM) - cb[1]
        for ch in a.caption:
            d.text((x, y), ch, font=f, fill=255); x += f.getlength(ch) + a.track * lo
        c = np.maximum(c, (np.array(m2) > 127).astype(np.uint8))
    r = oneink.check(c, {"mode": "line", "edge": "circle" if circle else None})
    print(json.dumps({k: (v.item() if hasattr(v, "item") else v) for k, v in r.items()}, default=float))
    rgba = np.zeros((H, W, 4), np.uint8); rgba[..., 3] = c * 255
    Image.fromarray(rgba, "RGBA").save(f"{a.out}-white.png", dpi=(300, 300))
    tee = np.where(c[..., None] > 0, np.array([22, 22, 22]), np.array([244, 243, 240])).astype(np.uint8)
    Image.fromarray(tee).save(f"{a.out}-tee.png"); Image.fromarray(tee).resize((700, 925), Image.LANCZOS).save(f"{a.out}-s.png")


if __name__ == "__main__":
    main()
