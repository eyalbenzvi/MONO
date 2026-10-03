"""FOUR BLOWS: a blacksmith at night in four frames of a 35 mm contact strip (out of the fire, hammer up, the
blow, the quench), white ink on a black tee: only what the forge lights prints. The four photographs are cut
from P["src"] (Gemini, from the owner) into equal windows; the film itself is drawn here: a tinted rebate down
each side with clean knocked-out perforations at 35 mm proportions, black frame gaps, numbers in the gaps.
python build2.py params.json out-dir"""
import json, os, sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

P = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, P["oneink_dir"])
import oneink

PX = 300 / 25.4
W, H = oneink.AREA_W, oneink.AREA_H
mm = lambda v: int(round(v * PX))

src = cv2.imread(P["src"], cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
ww = mm(P["window_w_mm"])
x0f, x1f, y0f, y1f = P["frames"][0][:4]
wh = round(ww * (y1f - y0f) / (x1f - x0f))
gap, end, reb = mm(P["gap_mm"]), mm(P["end_mm"]), mm(P["rebate_mm"])
sw = ww + 2 * reb
sh = 2 * end + 4 * wh + 3 * gap
sx, sy = (W - sw) // 2, mm(P["top_mm"])
assert sy + sh <= H, (sy + sh) / PX

tone = np.zeros((H, W), np.float32)
wins = []
for i, fr in enumerate(P["frames"]):
    a, b, c, d = fr[:4]
    # A frame may come from its own picture (a fifth entry: a later Gemini frame swapped in).
    im = cv2.imread(fr[4], cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255 if len(fr) > 4 else src
    g = cv2.resize(im[c:d, a:b], (ww, wh), interpolation=cv2.INTER_LANCZOS4)
    g = cv2.GaussianBlur(g, (0, 0), P["soften_px"])
    g = np.clip(g + P["local_amount"] * (g - cv2.GaussianBlur(g, (0, 0), mm(P["local_mm"]))), 0, 1)
    A = P.get("adjust", {}).get(str(i + 1), {})
    if A.get("local_amount"):
        # More local contrast (a wide unsharp mask): the steam's billows separate inside the bright mass.
        g = np.clip(g + A["local_amount"] * (g - cv2.GaussianBlur(g, (0, 0), mm(A["local_mm"]))), 0, 1)
    t = np.clip((g - P["lo"]) / (P["hi"] - P["lo"]), 0, 1) ** A.get("gamma", P["gamma"])
    if A.get("shoulder"):
        # The lights compressed above a knee: the steam keeps its folds as open dots instead of a white mass.
        k, r = A["shoulder"]["knee"], A["shoulder"]["rate"]
        t = np.where(t > k, k + (t - k) * r, t)
    if A.get("top_fade"):
        # The steam rises and thins to nothing before the top of the frame (no straight cut).
        T = A["top_fade"]
        yy = np.arange(wh, dtype=np.float32)[:, None] / wh
        xx = np.arange(ww, dtype=np.float32)[None, :] / ww
        f = np.clip((yy - T["y0"]) / (T["y1"] - T["y0"]), 0, 1)
        f = f * f * (3 - 2 * f)
        side = np.clip((T["x1"] - xx) / 0.06, 0, 1)
        t = t * (1 - side * (1 - f))
    for R in A.get("threads", []):
        # Thin threads (steam): only what is lighter than its own surroundings (a ridge), not the haze round
        # it, drawn as a line of dots; the speckled background in the box prints nothing.
        yy = np.arange(wh, dtype=np.float32)[:, None] / wh
        xx = np.arange(ww, dtype=np.float32)[None, :] / ww
        fe = R.get("feather", 0.05)
        box = (np.clip((xx - R["x0"]) / fe, 0, 1) * np.clip((R["x1"] - xx) / fe, 0, 1)
               * np.clip((yy - R["y0"]) / fe, 0, 1) * np.clip((R["y1"] - yy) / fe, 0, 1))
        gs = cv2.GaussianBlur(g, (0, 0), R.get("smooth_px", 2.0))
        ridge = gs - cv2.GaussianBlur(gs, (0, 0), mm(R["bg_mm"]))
        th = np.clip((ridge - R["lo"]) / (R["hi"] - R["lo"]), 0, 1) * R["max"]
        t = np.where(box > 0, t * (1 - box) + np.maximum(t * (1 - box), th * box), t)
    for R in A.get("lifts", [A["region_lift"]] if A.get("region_lift") else []):
        # Dark grey lifted inside a soft box (the steam over the barrel, the barrel's rim, the tongs and the
        # anvil), kept to open dots (<= max); "ramp" thins it upward (steam fading as it rises).
        yy = np.arange(wh, dtype=np.float32)[:, None] / wh
        xx = np.arange(ww, dtype=np.float32)[None, :] / ww
        fe = R.get("feather", 0.06)
        box = (np.clip((xx - R["x0"]) / fe, 0, 1) * np.clip((R["x1"] - xx) / fe, 0, 1)
               * np.clip((yy - R["y0"]) / fe, 0, 1) * np.clip((R["y1"] - yy) / fe, 0, 1))
        if R.get("ramp"):
            box = box * np.clip((yy - R["ramp"][0]) / (R["ramp"][1] - R["ramp"][0]), 0, 1) ** 1.5
        lifted = np.clip((g - R["lo"]) / (R["hi"] - R["lo"]), 0, 1) ** R["gamma"] * R["max"]
        t = np.maximum(t, lifted * box)
    if A.get("lift"):
        # The barrel at the bottom of the frame, lifted out of the dark (only there).
        L = A["lift"]
        yy = np.arange(wh, dtype=np.float32)[:, None] / wh
        band = np.clip((yy - L["from"]) / 0.08, 0, 1)
        xx = np.arange(ww, dtype=np.float32)[None, :] / ww
        band = band * np.clip((L["x1"] - xx) / 0.05, 0, 1)
        lifted = np.clip((g - L["lo"]) / (P["hi"] - L["lo"]), 0, 1) ** L["gamma"]
        t = np.maximum(t, lifted * band)
    wx, wy = sx + reb, sy + end + i * (wh + gap)
    tone[wy:wy + wh, wx:wx + ww] = t
    wins.append((wx, wy))

# The rebates: an even tint (the film base), the perforations knocked out of it.
holes = np.zeros((H, W), np.uint8)
rebate = np.zeros((H, W), np.uint8)
hw, hh, pitch, hr = mm(P["hole_w_mm"]), mm(P["hole_h_mm"]), mm(P["hole_pitch_mm"]), mm(P["hole_r_mm"])
n = int((sh - hh) // pitch) + 1
y_start = sy + (sh - ((n - 1) * pitch + hh)) // 2
for side in (sx + (reb - hw) // 2, sx + sw - reb + (reb - hw) // 2):
    rebate[sy:sy + sh, side - (reb - hw) // 2: side - (reb - hw) // 2 + reb] = 1
    for k in range(n):
        y = y_start + k * pitch
        cv2.rectangle(holes, (side + hr, y), (side + hw - hr, y + hh), 1, -1)
        cv2.rectangle(holes, (side, y + hr), (side + hw, y + hh - hr), 1, -1)
        for cx, cy in ((side + hr, y + hr), (side + hw - hr, y + hr), (side + hr, y + hh - hr), (side + hw - hr, y + hh - hr)):
            cv2.circle(holes, (cx, cy), hr, 1, -1)
rebate[holes > 0] = 0

ink = oneink.halftone_ink(tone)
# Specks: single dots of a few pixels alone in the photos' shadows (they plug or drop out on press).
nl, lab, st, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
keep = st[:, cv2.CC_STAT_AREA] > P["speck_px"]
keep[0] = False
ink = keep[lab].astype(np.uint8)

# The film base: its own open screen of round dots that never touch (an even grey on press; the photo screen
# at a light tint breaks into crumbs), knocked out at the perforations.
pitch_d, r_d = P["base_pitch_mm"] * PX, P["base_dot_mm"] * PX / 2
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
u = (xx + yy) / np.sqrt(2) / pitch_d
v = (yy - xx) / np.sqrt(2) / pitch_d
dist = np.hypot(u - np.round(u), v - np.round(v)) * pitch_d
ink |= ((dist <= r_d) & (rebate > 0)).astype(np.uint8)

# The drawn film: outer edges, perforation outlines, window lines (solid, at least 0.6 mm).
line = np.zeros((H, W), np.uint8)
e = mm(P["edge_mm"])
if e:
    line[sy:sy + sh, sx:sx + e] = 1
    line[sy:sy + sh, sx + sw - e:sx + sw] = 1
hl = mm(P["hole_line_mm"])
if hl:
    line |= cv2.dilate(holes, np.ones((2 * hl + 1, 2 * hl + 1), np.uint8)) - holes
wl = mm(P["window_line_mm"])
for wx, wy in (wins if wl else []):
    cv2.rectangle(line, (wx, wy), (wx + ww - 1, wy + wh - 1), 1, wl)
ink |= line

# The frame numbers, in the gaps under each window.
fp = os.path.join(P["fonts_dir"], P["num_font"])
f = ImageFont.truetype(fp, 200)
hb = f.getbbox("4")
f = ImageFont.truetype(fp, round(200 * mm(P["num_cap_mm"]) / (hb[3] - hb[1])))
im = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(im)
for i, (wx, wy) in enumerate(wins):
    s = str(i + 1)
    bb = d.textbbox((0, 0), s, font=f)
    gy = wy + wh + ((gap if i < 3 else end) - (bb[3] - bb[1])) // 2 - bb[1]
    d.text((wx + ww // 2 - (bb[2] - bb[0]) // 2 - bb[0], gy), s, font=f, fill=255)
ink |= (np.array(im) > 127).astype(np.uint8)

slug = P["slug"]
rgba = np.zeros((H, W, 4), np.uint8)
rgba[..., :3] = 255
rgba[..., 3] = ink * 255
Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, f"{slug}-black.png"), optimize=True, dpi=(300, 300))
np.save(os.path.join(OUT, "ink.npy"), ink)
ys, xs = np.nonzero(ink)
print(json.dumps({"coverage": round(float(ink.mean()), 4), "sizeCm": [round((xs.max() - xs.min() + 1) / PX / 10, 1), round((ys.max() - ys.min() + 1) / PX / 10, 1)], "topMm": round(ys.min() / PX, 1)}))
print(oneink.check(ink, {"mode": "halftone"}))
