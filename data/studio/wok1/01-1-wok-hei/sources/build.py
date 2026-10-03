"""WOK HEI: a wok mid-toss in a sheet of flame, rice, prawns and spring onion frozen in the air, the cook's
hand on the handle; white ink on a black tee: only what the flame lights prints. The photograph is P["src"]
(Gemini, from the owner); the shop's halftone screen. python build.py params.json out-dir"""
import json, os, sys
import cv2
import numpy as np
from PIL import Image

P = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, P["oneink_dir"])
import oneink

PX = 300 / 25.4
W, H = oneink.AREA_W, oneink.AREA_H
mm = lambda v: int(round(v * PX))

g = cv2.imread(P["src"], cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
# Erased from the photograph (a soft-edged polygon to black): the cook's second forearm, raised above the hand,
# read as a loose limb joined to nothing.
for poly in P.get("erase", []):
    m = np.zeros(g.shape, np.float32)
    cv2.fillPoly(m, [np.array(poly["pts"], np.int32)], 1.0)
    m = cv2.GaussianBlur(m, (0, 0), poly.get("soft_px", 4))
    g = g * (1 - m)
C = P["crop"]
g = g[C["y0"]:C["y1"], C["x0"]:C["x1"]]
ph, pw = g.shape
h = mm(P["height_mm"])
w = round(h * pw / ph)
g = cv2.resize(g, (w, h), interpolation=cv2.INTER_LANCZOS4)
g = cv2.GaussianBlur(g, (0, 0), P.get("soften_px", 1.2))
if P.get("local_amount"):
    g = np.clip(g + P["local_amount"] * (g - cv2.GaussianBlur(g, (0, 0), mm(P["local_mm"]))), 0, 1)
# White ink is light: the black of the smithy prints nothing, the fire and the lit edges print full.
t = np.clip((g - P["lo"]) / (P["hi"] - P["lo"]), 0, 1) ** P["gamma"]
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
# The cook's arm: its dark midtones lifted inside a soft box, so the wrist joins the hand to the forearm.
for R in P.get("lifts", []):
    fe = R.get("feather", 0.05)
    xr, yr = xx / w, yy / h
    box = (np.clip((xr - R["x0"]) / fe, 0, 1) * np.clip((R["x1"] - xr) / fe, 0, 1)
           * np.clip((yr - R["y0"]) / fe, 0, 1) * np.clip((R["y1"] - yr) / fe, 0, 1))
    lifted = np.clip((g - R["lo"]) / (P["hi"] - R["lo"]), 0, 1) ** R["gamma"]
    t = np.maximum(t, lifted * box)
# The wok's outer bowl: almost black in the photograph, so its steel is lifted inside a soft polygon (photo pixels)
# and capped at "gain" of full ink, enough to read as a lit pan without competing with the flame.
for R in P.get("lift_polys", []):
    pts = np.array([[(x - C["x0"]) * w / pw, (y - C["y0"]) * h / ph] for x, y in R["pts"]], np.int32)
    m = np.zeros((h, w), np.float32)
    cv2.fillPoly(m, [pts], 1.0)
    m = cv2.GaussianBlur(m, (0, 0), mm(R.get("soft_mm", 6)))
    lifted = R.get("gain", 0.6) * np.clip((g - R["lo"]) / (R.get("hi", 0.3) - R["lo"]), 0, 1) ** R["gamma"]
    t = np.maximum(t, lifted * m)
# Where the picture runs off its frame (the forearm at the right, the burner at the bottom) it fades out over a
# few millimetres instead of stopping on a straight cut.
F = P.get("edge_fade_mm", {})
for side, d in (("right", w - 1 - xx), ("left", xx), ("bottom", h - 1 - yy), ("top", yy)):
    if F.get(side):
        # An irregular edge: the fade's width wanders along the side (smooth noise), so no straight line shows.
        L = (h if side in ("right", "left") else w)
        rng = np.random.default_rng(5)
        wob = cv2.GaussianBlur(rng.standard_normal((L, 1)).astype(np.float32), (0, 0), L / 40).ravel()
        wob = wob / (np.abs(wob).max() + 1e-6)
        width = mm(F[side]) * (1 + F.get("wobble", 0) * (wob[:, None] if side in ("right", "left") else wob[None, :]))
        c = np.clip(d / width, 0, 1)
        t *= c * c * (3 - 2 * c)

# The hand: past the knuckles it dies away into the dark over a long ramp (dots shrinking to nothing), so the
# wrist is lost in shadow rather than cut off at the frame.
for R in P.get("fades", []):
    fe = R.get("feather", 0.04)
    xr, yr = xx / w, yy / h
    band = np.clip((yr - R["y0"]) / fe, 0, 1) * np.clip((R["y1"] - yr) / fe, 0, 1)
    rng = np.random.default_rng(9)
    wob = cv2.GaussianBlur(rng.standard_normal((h, 1)).astype(np.float32), (0, 0), h / 60).ravel()
    wob = wob / (np.abs(wob).max() + 1e-6)
    xa = R["xa"] + R.get("wobble", 0) * wob[:, None]
    c = np.clip((R["xb"] - xr) / (R["xb"] - xa), 0, 1)
    ramp = (c * c * (3 - 2 * c)) ** R.get("power", 1.5)
    t *= 1 - band * (1 - ramp)

canvas = np.zeros((H, W), np.float32)
x0, y0 = (W - w) // 2, mm(P["top_mm"])
canvas[y0:y0 + h, x0:x0 + w] = t
ink = oneink.halftone_ink(canvas)
if P.get("min_px"):
    # Dots and holes of a pixel or two wash out of the screen or fill in on cotton: lone specks go, pinholes close.
    a = P["min_px"]
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    keep = st[:, cv2.CC_STAT_AREA] > a
    keep[0] = False
    ink = keep[lab].astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats((1 - ink).astype(np.uint8), connectivity=4)
    hole = st[:, cv2.CC_STAT_AREA] <= a
    hole[0] = False
    ink = np.maximum(ink, hole[lab].astype(np.uint8))

slug = P["slug"]
rgba = np.zeros((H, W, 4), np.uint8)
rgba[..., :3] = 255
rgba[..., 3] = ink * 255
Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, f"{slug}-black.png"), optimize=True, dpi=(300, 300))
np.save(os.path.join(OUT, "ink.npy"), ink)
ys, xs = np.nonzero(ink)
res = oneink.check(ink, {"mode": "halftone"})
print(json.dumps({"coverage": round(float(ink.mean()), 4), "sizeCm": [round((xs.max() - xs.min() + 1) / PX / 10, 1), round((ys.max() - ys.min() + 1) / PX / 10, 1)], "topMm": round(ys.min() / PX, 1)}))
print(res)
