"""Hiroshige, Sudden Shower over Shin-Ohashi Bridge and Atake (1857), Cleveland Museum of Art 1921.318 (CC0),
traced to one ink. No image model: every line is the woodblock's own (key block and rain blocks).

  python3 shower.py OUT_PREFIX [--bh 0.10] [--cloud 1] [--caption "..."]

1. The scan's max(R,G,B) channel: the black key-block and rain lines stay dark, the blue and pink colour
   blocks go light, so only the black printing is traced.
2. Working scale 2x print: a black-hat filter (closing minus image, 25 px) keeps thin dark lines whatever the
   tone behind them, so a rain line stays continuous across sky, shore and river; flat colour drops out.
3. To print scale, threshold, every line's skeleton redrawn at 0.42 mm or more, specks under 0.5 mm dropped.
4. The black cloud band (bokashi) at the top, cut along the print's own edge, is translated into vertical
   lines at the rain's angle whose width follows the band's darkness (solid at the top, tapering to the
   0.42 mm minimum), so the gradient prints as line, not a dot screen.
5. The print's chamfered outline as a 0.7 mm keyline; a caption under it.
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from skimage.filters import apply_hysteresis_threshold
from skimage.morphology import skeletonize

sys.path.insert(0, "/home/user/MONO/scripts/studio")
import oneink  # noqa: E402
from oneink import PX_MM, disc  # noqa: E402

W, H = 3307, 4370
FONTS = "/home/user/MONO/assets/fonts"
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mx.npy")  # max(R,G,B) of the scan
SRCL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lum.npy")  # mean(R,G,B) of the scan
X0, Y0, X1, Y1 = 351, 441, 7316, 11126  # the image area in the scan (source px), measured
CHAMFER = 120  # its cut corners (source px)
# Series title (red), print title (poem paper), signature (red): measured on the scan by colour.
CARTOUCHES = [(6505, 690, 6995, 2650), (5470, 830, 6540, 1960), (650, 8990, 1050, 10615)]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("out")
    p.add_argument("--lo", type=float, default=0.17)
    p.add_argument("--hi", type=float, default=0.27)
    p.add_argument("--kern", type=int, default=25)
    p.add_argument("--blur", type=float, default=1.2)
    p.add_argument("--minlen", type=float, default=1.5)
    p.add_argument("--cloud", type=int, default=1)
    p.add_argument("--cloud-pitch-mm", type=float, default=1.3)
    p.add_argument("--d0", type=float, default=0.15)
    p.add_argument("--core", type=float, default=0.85)
    p.add_argument("--dark", type=float, default=0.47)
    p.add_argument("--mid", type=float, default=0.555)
    p.add_argument("--min-block-mm", type=float, default=1.6)
    p.add_argument("--hole-mm", type=float, default=3.0)
    p.add_argument("--shore-max", type=float, default=0.5)
    p.add_argument("--gamma", type=float, default=1.0)
    p.add_argument("--frame", type=int, default=1)
    p.add_argument("--art-h-mm", type=float, default=318)
    p.add_argument("--caption", default="CHANCE OF RAIN: 100% SINCE 1857.")
    p.add_argument("--font", default="cinzel-bold.ttf")
    p.add_argument("--track", type=float, default=0.08)
    p.add_argument("--cap-width-mm", type=float, default=200)
    p.add_argument("--cap-gap-mm", type=float, default=9)
    p.add_argument("--top-mm", type=float, default=14)
    a = p.parse_args()

    g = np.load(SRC)[Y0:Y1, X0:X1].astype(np.float32) / 255
    global RGBL
    RGBL = np.load(SRCL)[Y0:Y1, X0:X1].astype(np.float32) / 255
    h0, w0 = g.shape
    S = a.art_h_mm * PX_MM / h0  # print px per source px
    s2 = 2 * S
    w2 = cv2.resize(g, None, fx=s2, fy=s2, interpolation=cv2.INTER_AREA)
    # Black hat: thin dark lines on any tone.
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (a.kern, a.kern))
    bh = cv2.morphologyEx(w2, cv2.MORPH_CLOSE, k) - w2
    bh = cv2.GaussianBlur(bh, (0, 0), a.blur)
    lines = apply_hysteresis_threshold(bh, a.lo, a.hi).astype(np.float32)
    ink = cv2.resize(lines, (round(w0 * S), round(h0 * S)), interpolation=cv2.INTER_AREA) > 0.4
    ink = ink.astype(np.uint8)
    hh, ww = ink.shape
    # Drop texture: pieces under 1.5 mm long (paper fibres, wood grain on the piers), keep every real line.
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink)
    big = np.maximum(st[:, cv2.CC_STAT_WIDTH], st[:, cv2.CC_STAT_HEIGHT]) >= a.minlen * PX_MM
    big[0] = False; ink = big[lab].astype(np.uint8)
    # Keep only inside the image area (minus a margin for the frame).
    shape = np.zeros((hh, ww), np.uint8); ch = round(CHAMFER * S)
    cv2.fillPoly(shape, [np.array([[ch, 0], [ww - 1 - ch, 0], [ww - 1, ch], [ww - 1, hh - 1 - ch], [ww - 1 - ch, hh - 1],
                                   [ch, hh - 1], [0, hh - 1 - ch], [0, ch]], np.int32)], 1)
    pad = round(4 * PX_MM)
    inner = cv2.erode(cv2.copyMakeBorder(shape, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0), disc(1.6 * PX_MM))[pad:-pad, pad:-pad]
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink)
    keep = np.zeros(n, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] > 14; ink = keep[lab].astype(np.uint8)
    ink = np.maximum(ink, cv2.dilate(skeletonize(ink > 0).astype(np.uint8), disc(2.6)))
    ink[inner == 0] = 0

    if a.cloud:
        # Tone: the woodblock's dark colour blocks (the cloud band, the far shore, the piers, the deep water),
        # from the scan's luminance with its thin lines closed away, as darkness relative to the sky.
        # (at 1/8 of the scan, closed over 5 px so the rain lines drop out, then brought to print size)
        L8 = cv2.resize(RGBL, None, fx=0.125, fy=0.125, interpolation=cv2.INTER_AREA)
        L8 = cv2.morphologyEx(L8, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        L8 = cv2.GaussianBlur(L8, (0, 0), 1.0)
        L = cv2.resize(L8, (ww, hh), interpolation=cv2.INTER_CUBIC)
        sky, black = 0.62, 0.21
        dark = np.clip((sky - L) / (sky - black), 0, 1)
        top = np.zeros_like(dark, bool); top[:int(0.2 * hh)] = True
        # The two cartouches (title and series, the poem-paper square) sit on the band: their own lines are kept.
        cart = np.zeros_like(top)
        for cx0, cy0, cx1, cy1 in CARTOUCHES:
            cart[round((cy0 - Y0) * S):round((cy1 - Y0) * S), round((cx0 - X0) * S):round((cx1 - X0) * S)] = True
        pitch = a.cloud_pitch_mm * PX_MM
        yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
        slant = 0.06  # the rain leans about 3.5 degrees (measured on the scan's rain lines)
        u = xx - slant * yy
        idx = np.floor(u / pitch).astype(int)
        ph = (u / pitch) - idx
        wmin, gapmin = 0.42 * PX_MM / pitch, 0.4 * PX_MM / pitch
        # 1. The cloud band (bokashi): darkness by height, gently varying along x; lines at the rain's slant
        #    whose width follows it, a solid core, and each line ending at its own height (it breaks into rain).
        dtop = cv2.GaussianBlur(dark, (0, 0), sigmaX=12 * PX_MM, sigmaY=1.5 * PX_MM)
        rng = np.random.default_rng(7); jit = rng.uniform(0.0, 0.35, idx.max() + 2)
        start = a.d0 + jit[np.clip(idx, 0, None)]
        wid = wmin + (1 - gapmin - wmin) * np.clip((dtop - a.d0) / (a.core - a.d0), 0, 1) ** a.gamma
        cloud = ((dtop > start) & (np.abs(ph - 0.5) < wid / 2)) | (dtop >= a.core)
        cloud &= top & ~cart
        # 2. Dark blocks below the band (the piers, the deep water): solid, the rain knocked out of them in
        #    white along the scan's own rain lines.
        solid = ((L < a.dark) & ~(top & (dtop > a.d0))).astype(np.uint8)
        solid[cart] = 0
        solid[:int(a.shore_max * hh)] = 0  # above the bridge the far shore is hatched, never filled
        solid = cv2.morphologyEx(solid, cv2.MORPH_OPEN, disc(0.5 * PX_MM))
        n, lab, st, _ = cv2.connectedComponentsWithStats(solid)
        keep = st[:, cv2.CC_STAT_AREA] > (a.min_block_mm * PX_MM) ** 2; keep[0] = False; solid = keep[lab].astype(np.uint8)
        # Pinholes in the blocks (wood grain) are filled: holes under 2.5 mm across.
        n, lab, st, _ = cv2.connectedComponentsWithStats(1 - solid)
        hole = np.maximum(st[:, cv2.CC_STAT_WIDTH], st[:, cv2.CC_STAT_HEIGHT]) < a.hole_mm * PX_MM; hole[0] = False
        solid = (solid > 0) | hole[lab]
        n, lab, st, _ = cv2.connectedComponentsWithStats(ink)
        long_ = np.maximum(st[:, cv2.CC_STAT_WIDTH], st[:, cv2.CC_STAT_HEIGHT]) >= 5 * PX_MM; long_[0] = False
        rain = cv2.dilate(skeletonize(long_[lab]).astype(np.uint8), disc(2.4)) > 0
        blk = solid & ~rain
        # 3. Mid tones (the far shore): even hatching at the rain's slant, 0.42 mm lines.
        mid = ((L < a.mid) & ~solid & ~top & ~cart).astype(np.uint8)
        mid[int(a.shore_max * hh):] = 0  # the far shore only (not the water between the piers)
        mid = cv2.morphologyEx(mid, cv2.MORPH_CLOSE, disc(2.0 * PX_MM))
        mid = cv2.morphologyEx(mid, cv2.MORPH_OPEN, disc(1.5 * PX_MM))
        mid = cv2.GaussianBlur(mid.astype(np.float32), (0, 0), 1.5 * PX_MM) > 0.5
        # 3. ... hatched level, the engraver's way of drawing distant land.
        hph = (yy / pitch) % 1.0
        hatch = mid & (np.abs(hph - 0.5) < wmin / 2)
        # The scan's own lines stay outside the blocks and the band (inside, the knock-outs carry them).
        ink[solid | (top & (dtop > a.d0) & ~cart)] = 0
        tone = (cloud | blk | hatch).astype(np.uint8)
        tone[inner == 0] = 0
        ink = np.maximum(ink, tone)

    if a.frame:
        pad = round(2 * PX_MM); big = cv2.copyMakeBorder(shape, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
        edge = (big - cv2.erode(big, disc(0.75 * PX_MM)))[pad:-pad, pad:-pad]
        ink = np.maximum(ink, edge.astype(np.uint8))
    pad = round(2 * PX_MM)
    ink = cv2.morphologyEx(cv2.copyMakeBorder(ink, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0), cv2.MORPH_OPEN,
                           disc(0.2 * PX_MM - 0.01))[pad:-pad, pad:-pad]
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink)
    keep = np.zeros(n, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] > (0.5 * PX_MM) ** 2 * 2; ink = keep[lab].astype(np.uint8)
    ys, xs = np.nonzero(ink); ink = ink[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; ah, aw = ink.shape
    top = int(a.top_mm * PX_MM)
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
        m2 = Image.new("L", (W, H), 0); d = ImageDraw.Draw(m2); x = (W - tw) / 2
        y = top + ah + int(a.cap_gap_mm * PX_MM) - cb[1]
        for ch in a.caption:
            d.text((x, y), ch, font=f, fill=255); x += f.getlength(ch) + a.track * lo
        c = np.maximum(c, (np.array(m2) > 127).astype(np.uint8))
        print("caption cap height mm", round((cb[3] - cb[1]) / PX_MM, 1), "bottom mm", round((y + cb[3]) / PX_MM, 1))
    r = oneink.check(c, {"mode": "line", "edge": None})
    print(json.dumps(r, default=float))
    print("art mm", round(aw / PX_MM, 1), round(ah / PX_MM, 1), "scale", round(S, 4))
    rgba = np.zeros((H, W, 4), np.uint8); rgba[..., 3] = c * 255
    Image.fromarray(rgba, "RGBA").save(f"{a.out}-white.png", dpi=(300, 300))
    tee = np.where(c[..., None] > 0, np.array([22, 22, 22]), np.array([244, 243, 240])).astype(np.uint8)
    Image.fromarray(tee).save(f"{a.out}-tee.png"); Image.fromarray(tee).resize((700, 925), Image.LANCZOS).save(f"{a.out}-s.png")
    json.dump(r, open(f"{a.out}-check.json", "w"), indent=1)


if __name__ == "__main__":
    main()
