"""NEARLY FINISHED / SINCE 1987: a formal portrait of a wooden cutter hauled out in a boatyard, half sanded and
half still painted, its mast on trestles beside it; a photograph in the shop's halftone, set like a product
window on Japanese packaging, with a narrow vertical label beside it. The photograph is P["src"]; the rest in code.
  python build.py params.json out-dir
"""
import json, math, os, sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

P = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, P["oneink_dir"])
import oneink  # the shop's screen (halftone_ink) and checks

PX = 300 / 25.4
W, H = oneink.AREA_W, oneink.AREA_H
mm = lambda v: int(round(v * PX))
FONTS = P["fonts_dir"]

# The photograph: grey, cropped to the boat, the yard and a little sky.
g8 = cv2.imread(P["src"], cv2.IMREAD_GRAYSCALE)
# Retouch: the source drew the line between the sanded and the painted halves as a bright seam (a cut-out
# look); it is filled from the wood round it. The tape along the waterline stays.
R = P.get("seam")
if R:
    seam = np.zeros_like(g8)
    for y in range(R["y0"], R["y1"]):
        xc = R["x0"] + (R["x1"] - R["x0"]) * (y - R["y0"]) / (R["y1"] - R["y0"])
        a, b = int(xc - R["half"]), int(xc + R["half"]) + 1
        seam[y, a:b] = (g8[y, a:b] > R["bright"] * 255)
    seam = cv2.dilate(seam, np.ones((3, 3), np.uint8))
    g8 = cv2.inpaint(g8, seam, 4, cv2.INPAINT_TELEA)
g = g8.astype(np.float32) / 255
C = P["crop"]
g = g[C["y0"]:C["y1"], C["x0"]:C["x1"]]
ph, pw = g.shape
F = P["photo"]
w = mm(F["width_mm"])
h = round(w * ph / pw)
g = cv2.resize(g, (w, h), interpolation=cv2.INTER_LANCZOS4)
g = cv2.GaussianBlur(g, (0, 0), F.get("soften_px", 1.2))  # the upscaled source's pixel steps, smoothed
if F.get("local_amount"):
    # Local contrast (a wide unsharp mask): the pale spar on its trestles and the keel in the dark underbody
    # separate from what is round them.
    g = np.clip(g + F["local_amount"] * (g - cv2.GaussianBlur(g, (0, 0), mm(F["local_mm"]))), 0, 1)
# Ink is darkness. Levels: the pale sky and the haze at the horizon print nothing; the darkest paint is full tone.
t = np.clip((1 - g - F["lo"]) / (F["hi"] - F["lo"]), 0, 1) ** F["gamma"]
if F.get("shoulder"):
    # The darks compressed above a knee (the dark bottom paint keeps its shape and the ink stays soft on cotton):
    # tone over the knee rises at a fraction of the rate, so the darkest reaches about knee + (1 - knee) * rate.
    k, r = F["shoulder"]["knee"], F["shoulder"]["rate"]
    t = np.where(t > k, k + (t - k) * r, t)

# No hard edge: the yard (below the horizon) fades out round the boat, an ellipse centred on the hull,
# and the horizon line fades towards both sides.
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
E = P["fade"]
smooth = lambda v: (lambda c: c * c * (3 - 2 * c))(np.clip(v, 0, 1))
if E.get("kind") == "edges":
    # The yard fades out towards both sides and the bottom of the picture (the boat stays whole): below the
    # keel blocks (E["ground_from"]) the dots shrink smoothly to nothing; the gravel's texture is smoothed
    # out as it fades, so the edge is a vignette, not a torn strip.
    side = smooth(np.minimum(xx, w - 1 - xx) / (E["side"] * w))
    gf = E.get("ground_from", 1 - E["bottom"]) * h
    bottom = smooth(1 - (yy - gf) / max(1.0, h - 1 - gf))
    bottom[yy < gf] = 1
    m = side * bottom
    flat = cv2.GaussianBlur(t, (0, 0), mm(E.get("texture_mm", 3)))
    t = t * m + flat * (1 - m) * m  # texture fades into a smooth tone, the tone into nothing
else:
    cx, cy = E["cx"] * w, E["cy"] * h
    rx, ry = E["rx"] * w, E["ry"] * h
    r = np.hypot((xx - cx) / rx, (yy - cy) / ry)
    m = smooth((1 - r) / E["soft"])
m[yy < E["horizon"] * h] = 1  # above the horizon only the boat has tone: nothing to fade
t *= m

canvas = np.zeros((H, W), np.float32)
x0, y0 = mm(F["x_mm"]), mm(F["top_mm"])
canvas[y0:y0 + h, x0:x0 + w] = t
ink = oneink.halftone_ink(canvas)
# Lone dots (a dot with hardly another within 2 mm, out in the gravel's fade) go: on press they fill in or drop out.
near = cv2.blur(ink.astype(np.float32), (mm(4), mm(4)))
n, lab, st, _ = cv2.connectedComponentsWithStats(ink)
cy_ = np.clip(st[:, cv2.CC_STAT_TOP] + st[:, cv2.CC_STAT_HEIGHT] // 2, 0, H - 1)
cx_ = np.clip(st[:, cv2.CC_STAT_LEFT] + st[:, cv2.CC_STAT_WIDTH] // 2, 0, W - 1)
# (only small pieces are judged: a large one is a shape, whatever lies at the middle of its box)
keep = (near[cy_, cx_] >= P.get("lone_density", 0.06)) | (st[:, cv2.CC_STAT_AREA] > (2 * PX) ** 2)
keep[0] = False
ink = keep[lab].astype(np.uint8)


def capfont(name, cap_mm):
    f = ImageFont.truetype(os.path.join(FONTS, name), 200)
    hb = f.getbbox("H")
    return ImageFont.truetype(os.path.join(FONTS, name), round(200 * mm(cap_mm) / (hb[3] - hb[1])))


def set_line(text, font, track_mm):
    """A line of capitals, letter-spaced, as a 1-bit array (left to right)."""
    widths = [font.getlength(ch) for ch in text]
    total = int(sum(widths) + mm(track_mm) * (len(text) - 1)) + 4
    hb = font.getbbox("H")
    im = Image.new("L", (total, hb[3] - hb[1] + 4), 0)
    d = ImageDraw.Draw(im)
    x = 2
    for ch, wch in zip(text, widths):
        d.text((x, 2 - hb[1]), ch, font=font, fill=255)
        x += wch + mm(track_mm)
    return (np.array(im) > 127).astype(np.uint8)


# The caption, centred over the photograph: NEARLY FINISHED letter-spaced, and under it, small, SINCE 1987.
T = P["caption"]
cxm = mm(T["cx_mm"])
y = mm(T["y_mm"])
for text, font, cap, track, gap in ((T["text"], T["font"], T["cap_mm"], T["track_mm"], T["gap_mm"]), (T["sub"], T["sub_font"], T["sub_cap_mm"], T["sub_track_mm"], 0)):
    line = set_line(text, capfont(font, cap), track)
    x = cxm - line.shape[1] // 2
    ink[y:y + line.shape[0], x:x + line.shape[1]] |= line
    y += line.shape[0] + mm(gap)

slug = P["slug"]
rgba = np.zeros((H, W, 4), np.uint8)
rgba[..., 3] = ink * 255
Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, f"{slug}-white.png"), optimize=True, dpi=(300, 300))
np.save(os.path.join(OUT, "ink.npy"), ink)
pv = cv2.resize(ink.astype(np.float32), (1500, round(1500 * H / W)), interpolation=cv2.INTER_AREA)
Image.fromarray(((1 - pv) * 255).astype(np.uint8), "L").save(os.path.join(OUT, f"{slug}-preview.png"))
ys, xs = np.nonzero(ink)
print(json.dumps({"coverage": round(float(ink.mean()), 4), "sizeCm": [round((xs.max() - xs.min() + 1) / PX / 10, 1), round((ys.max() - ys.min() + 1) / PX / 10, 1)], "topMm": round(ys.min() / PX, 1)}))
