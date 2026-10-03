"""KETCH: a two-masted ketch under full sail on still water, a fine pen drawing with dotted sail seams, under the
shop's heading (KETCH / Maritime · Sail plan, light and letter-spaced, the rule as long as the hull). The drawing is
P["src"] (Google Gemini, redrawn from the owner's pictures); the lines are found by their contrast, every seam dot is
redrawn as one round dot of one size, and the generated water is replaced by a drawn one (a waterline, broken water
lines, a stipple that thins out with depth). (The "firm" mask is for a source photographed on a shirt; unused here.)
  python build.py params.json out-dir"""
import json, os, sys
import cv2
import numpy as np
from PIL import Image

P = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, P["oneink_dir"])
import oneink

PX = oneink.PX_MM
W, H = oneink.AREA_W, oneink.AREA_H
mm = lambda v: int(round(v * PX))

g = cv2.imread(P["src"], cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
g = oneink.flatten_paper(g)  # the shirt's folds and shading out: the paper white
C = P["crop"]
g = g[C["y0"]:C["y1"], C["x0"]:C["x1"]]
k = 1 - g
WT = P.get("water")
if WT:  # the generated water and reflection go: they are redrawn below as an even stipple
    k[WT["cut_y"] - C["y0"]:, :] = 0

def heading(title, sub, cap_t, cap_s, rule_w):
    """The shop's heading (oneink.heading: Space Grotesk, letter-spaced, a rule under it) at a set size, its
    rule as wide as the drawing's hull."""
    from PIL import ImageDraw, ImageFont
    rows = []
    for text, cap_mm, track, stroke_mm in ((title, cap_t, 0.3, P.get("title_stroke_mm", 0.32 * cap_t / 8.5)), (sub, cap_s, 0.16, 0)):
        probe = ImageFont.truetype(oneink.FONT, 1000)
        cap = probe.getbbox("H")[3] - probe.getbbox("H")[1]
        size = round(cap_mm * PX * 1000 / cap)
        f = ImageFont.truetype(oneink.FONT, size)
        sp, sw = track * size, round(stroke_mm * PX)
        widths = [f.getlength(c) for c in text]
        w = int(sum(widths) + sp * (len(text) - 1)) + 4 + 2 * sw
        asc, desc = f.getmetrics()
        im = Image.new("L", (w, asc + desc + 2 * sw), 0)
        dr = ImageDraw.Draw(im)
        x = float(sw)
        for c, cw in zip(text, widths):
            dr.text((x, sw), c, font=f, fill=255, stroke_width=sw, stroke_fill=255)
            x += cw + sp
        a = np.asarray(im) > 127
        ys = np.nonzero(a.any(1))[0]
        rows.append(a[ys[0]:ys[-1] + 1])
    gap, rule_h, rule_gap = mm(P.get("head_gap_k", 0.42) * cap_t), max(mm(0.5 * cap_t / 8.5), 6), mm(P.get("rule_gap_mm", 3.5 * cap_t / 8.5))
    hgt = rows[0].shape[0] + gap + rows[1].shape[0] + rule_gap + rule_h
    out = np.zeros((hgt, W), np.uint8)
    y = 0
    for r in rows:
        out[y:y + r.shape[0], (W - r.shape[1]) // 2:(W - r.shape[1]) // 2 + r.shape[1]] = r
        y += r.shape[0] + gap
    y += rule_gap - gap
    out[y:y + rule_h, (W - rule_w) // 2:(W + rule_w) // 2] = 1
    return out


head = heading(P["title"], P["sub"], P["cap_title_mm"], P["cap_sub_mm"], mm(P["rule_mm"]))
hh = head.shape[0]
top = mm(P["top_mm"])
pic_top = top + hh + mm(P["gap_mm"])
room = H - pic_top - mm(P["bottom_mm"])
ph, pw = k.shape
s = min(mm(P["max_w_mm"]) / pw, room / ph)
nw, nh = int(pw * s), int(ph * s)
if P.get("hull_px"):
    # The rule as long as the hull (stem to stern, the bowsprit not counted): measured on the source.
    head = heading(P["title"], P["sub"], P["cap_title_mm"], P["cap_sub_mm"], int((P["hull_px"][1] - P["hull_px"][0]) * s))
# Only the drawing: the shape the boat spans (the hull of its firm lines: masthead, bowsprit, stern) and the
# water under it; whatever lies outside (a fold the flattening left) goes.
if P.get("firm"):  # (a photographed shirt only; a clean drawing has nothing round it)
    firm = (cv2.GaussianBlur(k, (0, 0), 1.0) > P["firm"]).astype(np.uint8)
    pts = cv2.findNonZero(firm)
    area = np.zeros_like(firm)
    cv2.fillConvexPoly(area, cv2.convexHull(pts), 1)
    x_, y_, w_, h_ = cv2.boundingRect(pts)
    area[y_ + h_ - P["water_up_px"]:, x_:x_ + w_] = 1
    area = cv2.dilate(area, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (P["near_px"], P["near_px"])))
    k = k * cv2.GaussianBlur(area.astype(np.float32), (0, 0), 3)
up = cv2.resize(cv2.GaussianBlur(k, (0, 0), P["pre_blur"]), (nw, nh), interpolation=cv2.INTER_LANCZOS4)
# The water's reflection fades out downward (no hard bottom edge).
F = P["water_fade"]
yy = np.arange(nh, dtype=np.float32)[:, None] / nh
up = up * np.clip(1 - (yy - F["from"]) / F["soft"], 0, 1)
tone = np.zeros((H, W), np.float32)
x0 = (W - nw) // 2
tone[pic_top:pic_top + nh, x0:x0 + nw] = np.clip(up, 0, 1)
# The lines: firm strokes by their darkness, the fine dotted sails and rigging by their contrast with what is
# round them; then joined and cleaned of crumbs.
L = P["lines"]
local = cv2.GaussianBlur(tone, (0, 0), L["bg_mm"] * PX)
ridge = (tone - local) > L["ridge"]
if L.get("pen"):
    ink = oneink.pen_ink(tone)
else:
  ink = ((tone > L["firm"]) | (ridge & (tone > L["floor"]))).astype(np.uint8)
ink = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, oneink.disc(L["close_px"]))
ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, oneink.disc(1.0))
n, lab, st, _ = cv2.connectedComponentsWithStats(ink)
keep = st[:, cv2.CC_STAT_AREA] > (L["crumb_mm"] * PX) ** 2
keep[0] = False
ink = keep[lab].astype(np.uint8)
# A stroke under 0.4 mm thickened to it (it would not hold on the screen).
thick = cv2.morphologyEx(ink, cv2.MORPH_OPEN, oneink.disc(0.2 * PX))
ink = np.maximum(ink, cv2.dilate(ink & (1 - thick), oneink.disc(2.4)))
if L.get("dot_mm"):
    # The stipple (the sails' seams, the reflection): every dot redrawn as one round dot of the same size at its
    # centre, so the seams are even rows that hold on the screen (not specks, not blobs of two run together).
    n, lab, st, cen = cv2.connectedComponentsWithStats(ink)
    area, bw, bh = st[:, cv2.CC_STAT_AREA], st[:, cv2.CC_STAT_WIDTH], st[:, cv2.CC_STAT_HEIGHT]
    dot = (area < (L["dot_max_mm"] * PX) ** 2) & (np.maximum(bw, bh) < 2.2 * np.maximum(1, np.minimum(bw, bh)))
    dot[0] = False
    ink[dot[lab]] = 0
    r = max(1, round(L["dot_mm"] * PX / 2))
    # Where dots crowd (the stipple under the keel) some are left out, so every dot keeps clear of the next
    # (L["dot_gap_mm"] centre to centre) and the clump prints as a fade, not a blot.
    taken = np.zeros_like(ink)
    gap = round(L.get("dot_gap_mm", 0) * PX)
    for i in np.nonzero(dot)[0]:
        c = (int(round(cen[i][0])), int(round(cen[i][1])))
        if gap and taken[c[1], c[0]]:
            continue
        cv2.circle(ink, c, r, 1, -1)
        if gap:
            cv2.circle(taken, c, gap, 1, -1)
if L.get("pinhole_mm"):
    # Pinholes in the solids (the deck, the mast) close up on cotton: filled, so they print as clean solids.
    inv = (1 - ink).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
    holes = st[:, cv2.CC_STAT_AREA] < (L["pinhole_mm"] * PX) ** 2
    holes[0] = False
    ink = np.maximum(ink, holes[lab].astype(np.uint8))
if WT:
    # The water, drawn: the waterline, a few broken water lines that shorten as they go down, and under the
    # hull a stipple of one round dot size on a jittered grid, thinning out with depth (a fade, not a blot).
    rng = np.random.default_rng(WT.get("seed", 3))
    sx = lambda u: int(round(x0 + (u - C["x0"]) * s))
    wy = int(round(pic_top + (WT["cut_y"] - C["y0"]) * s))
    lw = max(1, mm(WT["line_mm"]))
    L0, L1 = sx(WT["water_x"][0]), sx(WT["water_x"][1])
    ink[wy:wy + lw, L0:L1] = 1
    rows = []
    for i, off in enumerate(WT["rows_mm"]):
        y = wy + mm(off)
        shrink = (L1 - L0) * WT["row_shrink"] * i / len(WT["rows_mm"])
        a, b = int(L0 + shrink * rng.uniform(0.6, 1.0)), int(L1 - shrink * rng.uniform(0.6, 1.0))
        x = a
        while x < b:
            n = mm(rng.uniform(*WT["dash_mm"]))
            ink[y:y + lw, x:min(b, x + n)] = 1
            x += n + mm(rng.uniform(*WT["gap_mm"]) * (1 + i * 0.35))
        rows.append(y)
    H0, H1 = sx(WT["hull_x"][0]), sx(WT["hull_x"][1])
    pitch, depth = WT["pitch_mm"] * PX, mm(WT["depth_mm"])
    r = max(1, round(L["dot_mm"] * PX / 2))
    clear = mm(WT["clear_mm"])
    yy = wy + lw + clear
    while yy < wy + depth:
        t = (yy - wy) / depth
        taper = (H1 - H0) * 0.5 * t * WT["taper"]
        xx = H0 + taper + rng.uniform(0, pitch)
        while xx < H1 - taper:
            px, py = xx + rng.uniform(-0.25, 0.25) * pitch, yy + rng.uniform(-0.25, 0.25) * pitch
            if rng.random() < WT["density"] * (1 - t) ** WT["fall"] and min(abs(py - q) for q in rows) > clear:
                cv2.circle(ink, (int(px), int(py)), r, 1, -1)
            xx += pitch
        yy += pitch
ink[top:top + hh] |= head

slug = P["slug"]
rgba = np.zeros((H, W, 4), np.uint8)
rgba[..., 3] = ink * 255
Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, f"{slug}.png"), optimize=True, dpi=(300, 300))
np.save(os.path.join(OUT, "ink.npy"), ink)
ys, xs = np.nonzero(ink)
print(json.dumps({"coverage": round(float(ink.mean()), 4), "sizeCm": [round((xs.max() - xs.min() + 1) / PX / 10, 1), round((ys.max() - ys.min() + 1) / PX / 10, 1)], "topMm": round(ys.min() / PX, 1)}))
oneink.SCREENED = 0.0
print(oneink.check(ink, {"mode": "line", "headRows": top + hh}))
