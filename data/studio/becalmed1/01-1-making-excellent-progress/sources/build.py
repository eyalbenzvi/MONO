"""MAKING EXCELLENT PROGRESS: a becalmed sloop at sunset, its reflection exact in glassy water, the sky and
the sun in risograph-style grain. The boat is a line drawing (P["boat_src"], traced); everything else in code.
  python build.py params.json out-dir
"""
import json, math, os, sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

P = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
PX = 300 / 25.4
W, H = round(280 * PX), round(370 * PX)
FONTS = P["fonts_dir"]
mm = lambda v: int(round(v * PX))
rng = np.random.default_rng(P.get("seed", 3))
ink = np.zeros((H, W), np.uint8)

S = P["scene"]
cx, hz, half = S["cx"], S["horizon"], S["width"] / 2  # mm: centre, horizon line, half the scene's width
x0, x1 = cx - half, cx + half


def grain(tone, cell_mm):
    """Risograph-style grain: a stochastic dot screen. Dots of one size (cell_mm) scattered at random, as many
    as the tone asks for, never touching closer than the minimum gap (a jittered grid, one dot per cell at most)."""
    h, w = tone.shape
    c = cell_mm * PX
    out = np.zeros((h, w), np.uint8)
    r = max(1, int(round(P["grain"]["dot_mm"] * PX / 2)))
    gy, gx = np.mgrid[0:h:c, 0:w:c]
    gy, gx = gy.ravel(), gx.ravel()
    jx = gx + rng.uniform(0.2, 0.8, gx.shape) * c
    jy = gy + rng.uniform(0.2, 0.8, gy.shape) * c
    ok = (jx < w) & (jy < h)
    jx, jy = jx[ok], jy[ok]
    t = tone[jy.astype(int), jx.astype(int)]
    keep = rng.random(t.shape) < t
    for x, y in zip(jx[keep].astype(int), jy[keep].astype(int)):
        cv2.circle(out, (x, y), r, 1, -1)
    return out


# The sun: a half disc on the horizon cut into horizontal stripes, thick at the horizon and thinning upward
# (a seventies sunset). Nothing else in the sky.
sx = cx + S.get("sun_dx", 0)
sun_r = S["sun_r"]
U = P["sun"]
y = hz - U["gap_mm"]
k = 0
while y > hz - sun_r:
    t = (hz - y) / sun_r  # 0 at the horizon, 1 at the top
    th = max(U["min_mm"], U["pitch_mm"] * (U["duty_low"] + (U["duty_high"] - U["duty_low"]) * t))
    yt = y - th
    if yt < hz - sun_r:
        break
    # the chord at the stripe's middle
    ym = (y + yt) / 2
    hw = math.sqrt(max(0.0, sun_r ** 2 - (hz - ym) ** 2))
    if hw > 1.5:
        cv2.rectangle(ink, (mm(sx - hw), mm(yt)), (mm(sx + hw), mm(y) - 1), 1, -1)
    y -= U["pitch_mm"]
# The sun's reflection: short broken dashes in a column under it, narrowing and thinning out with depth,
# the same dashes as the boat's reflection.
Rf = P["sun_reflection"]
y = hz + Rf["gap_mm"]
k = 0
while y < hz + Rf["depth_mm"]:
    depth = (y - hz) / Rf["depth_mm"]
    keep = 1.0 if depth <= Rf["fade_from"] else 1 - (depth - Rf["fade_from"]) / (1 - Rf["fade_from"])
    if (k * 0.618) % 1 <= keep:
        hw = sun_r * (Rf["width_top"] + (Rf["width_bottom"] - Rf["width_top"]) * depth)
        x = sx - hw + rng.uniform(0, Rf["gap_mm"] * 3)
        while x < sx + hw:
            ln = rng.uniform(Rf["dash_min"], Rf["dash_max"]) * (1 - 0.5 * depth)
            x2 = min(x + ln, sx + hw)
            if x2 - x >= 1.2:
                cv2.rectangle(ink, (mm(x), mm(y)), (mm(x2), mm(y + Rf["stroke_mm"]) - 1), 1, -1)
            x = x2 + rng.uniform(Rf["space_min"], Rf["space_max"]) * (1 + depth)
    y += Rf["pitch_mm"]
    k += 1
# The horizon: a fine line across the scene, broken where the boat sits.
hl = np.zeros_like(ink)
cv2.line(hl, (mm(x0 + S["side_fade_mm"] * 0.4), mm(hz)), (mm(x1 - S["side_fade_mm"] * 0.4), mm(hz)), 1, mm(S["horizon_w"]))
ink |= hl

# The boat: traced from the drawing, set on the horizon (its waterline on it), and its reflection mirrored below,
# broken into horizontal slices with small gaps (glassy water, not a mirror).
B = P.get("boat")
if P.get("boat_src"):
    g = cv2.imread(P["boat_src"], cv2.IMREAD_GRAYSCALE)
    on = (g < P.get("boat_threshold", 128)).astype(np.uint8)
    if P.get("boat_crop_bottom"):
        on[P["boat_crop_bottom"]:] = 0  # the drawing's own ground line goes: the horizon is ours
    ys, xs = np.nonzero(on)
    on = on[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    w = mm(B["width_mm"])
    h = round(w * on.shape[0] / on.shape[1])
    d_ = (cv2.resize(cv2.resize(on.astype(np.float32), (w * 2, h * 2), interpolation=cv2.INTER_LANCZOS4), (w, h), interpolation=cv2.INTER_AREA) > 0.5).astype(np.uint8)
    n0, lab0, st0, _ = cv2.connectedComponentsWithStats(d_)
    k0 = np.zeros(n0, bool)
    k0[1:] = st0[1:, cv2.CC_STAT_AREA] >= (B.get("speck_mm", 0) * PX) ** 2
    d_ = k0[lab0].astype(np.uint8)  # the drawing's stipple and scratches under the press's grain go
    r_ = 0.2 * PX - 0.01
    rr = int(np.ceil(r_))
    a, b = np.ogrid[-rr:rr + 1, -rr:rr + 1]
    disc = (a * a + b * b <= r_ * r_).astype(np.uint8)
    for _ in range(10):
        thick = cv2.morphologyEx(d_, cv2.MORPH_OPEN, disc)
        thin = d_ & (1 - thick)
        if thin.sum() < 0.0005 * d_.sum():
            break
        d_ = d_ | cv2.dilate(thin, disc)
    bx = mm(cx + B.get("dx", 0)) - w // 2
    by = mm(hz + B.get("waterline_dy", 0)) - h  # the drawing's bottom edge is the waterline
    # Clear the sky's grain behind the boat (the boat's silhouette, closed, filled), then the boat.
    # Clear the grain round the lines (not the whole rig's outline: the sky shows between the stays), and
    # behind the hull and the furled sails, which are solid things.
    from scipy import ndimage as ndi
    halo = cv2.dilate(d_, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (mm(1.4) | 1,) * 2))
    hull = np.zeros_like(d_)
    hull[int(h * P["boat"].get("solid_from", 0.62)):] = 1
    solid = ndi.binary_fill_holes(cv2.morphologyEx(d_ & hull, cv2.MORPH_CLOSE, np.ones((mm(2), mm(2)), np.uint8))).astype(np.uint8)
    halo |= cv2.dilate(solid, np.ones((mm(1.0), mm(1.0)), np.uint8))
    region = ink[by:by + h, bx:bx + w]
    region[halo > 0] = 0
    region |= d_
    # Reflection: the drawing itself flipped on the waterline (the same lines, not a filled shape), seen through
    # horizontal bands, cut square (no round ends). Still water smears it a little sideways; with depth the bands
    # thin out and drop away until it fades.
    ref = d_[::-1].copy()
    rh, rw = ref.shape
    pitch, stroke = mm(B["pitch_mm"]), max(mm(B["stroke_mm"]), 7)
    out = np.zeros_like(ref)
    fade_from, fade_to = B.get("fade_from", 0.35), B.get("fade_to", 0.75)
    rows, y_ = [], 0
    while y_ < rh:
        rows.append(y_)
        y_ += mm(B.get("pitch_near_mm", 1.5)) if y_ / rh < B.get("hull_depth", 0) else pitch
    for k, y0 in enumerate(rows):
        depth = y0 / rh
        if depth > fade_to:
            break
        keep = 1.0 if depth <= fade_from else 1 - (depth - fade_from) / (fade_to - fade_from)
        if (k * 0.618) % 1 > keep:
            continue
        # under the hull the whole band is sampled (the hull reads as a mass); below it, a thin slice (lines)
        if depth < B.get("hull_skip_depth", 0) and k % 2:
            continue  # (option) the hull's reflection, every other band
        near = depth < B.get("hull_depth", 0)
        band = ref[y0:y0 + (mm(B.get("pitch_near_mm", 1.5)) if near else mm(B.get("sample_mm", 0.3)))].any(0).astype(np.uint8)[None, :]
        widen = mm(B.get("widen_mm", 0.6) * (1 + depth))
        if widen:
            band = cv2.dilate(band, np.ones((1, 2 * widen + 1), np.uint8))
        out[y0:y0 + stroke] = np.repeat(band, stroke, axis=0)[: max(0, min(stroke, rh - y0))]
    # Dashes too short to hold go, and the corners the press can't hold are shaved with the check's own disc
    # (shaved, not grown: growing them puts a blob on every end).
    n3, lab3, st3, _ = cv2.connectedComponentsWithStats(out)
    k3 = np.zeros(n3, bool)
    k3[1:] = st3[1:, cv2.CC_STAT_WIDTH] >= mm(0.6)
    out = cv2.morphologyEx(k3[lab3].astype(np.uint8), cv2.MORPH_OPEN, disc)
    ry = mm(hz) + mm(B.get("reflect_gap", 0.8))
    rr2 = ink[ry:ry + rh, bx:bx + w]
    rr2[:out.shape[0]] |= out[:rr2.shape[0]]
    # Specks smaller than the press can hold go.
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink)
    keep = np.zeros(n, bool)
    # (a grain dot cut by the halo round the boat is a crescent: anything under 70% of a whole dot goes)
    keep[1:] = st[1:, cv2.CC_STAT_AREA] >= 0.7 * math.pi * (P["grain"]["dot_mm"] * PX / 2) ** 2
    ink = keep[lab].astype(np.uint8)

# The caption: typewriter capitals, letter-spaced, centred under the scene.
T = P["caption"]
path = os.path.join(FONTS, T["font"])
f = ImageFont.truetype(path, 200)
hb = f.getbbox("H")
f = ImageFont.truetype(path, round(200 * mm(T["cap_mm"]) / (hb[3] - hb[1])))
txt = T["text"]
track = mm(T["track_mm"])
widths = [f.getlength(ch) for ch in txt]
total = sum(widths) + track * (len(txt) - 1)
im = Image.new("L", (W, H), 0)
dr = ImageDraw.Draw(im)
x = mm(cx) - total / 2
top = mm(T["y"])
for ch, wch in zip(txt, widths):
    dr.text((x, top - f.getbbox("H")[1]), ch, font=f, fill=255)
    x += wch + track
ink[np.array(im) > 127] = 1

slug = P["slug"]
rgba = np.zeros((H, W, 4), np.uint8)
rgba[..., 3] = ink * 255
Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, f"{slug}.png"), optimize=True, dpi=(300, 300))
np.save(os.path.join(OUT, "ink.npy"), ink)
small = cv2.resize(ink.astype(np.float32), (1500, round(1500 * H / W)), interpolation=cv2.INTER_AREA)
Image.fromarray(((1 - small) * 255).astype(np.uint8), "L").save(os.path.join(OUT, f"{slug}-preview.png"))
ys, xs = np.nonzero(ink)
print(json.dumps({"coverage": round(float(ink.mean()), 4), "sizeCm": [round((xs.max() - xs.min() + 1) / PX / 10, 1), round((ys.max() - ys.min() + 1) / PX / 10, 1)], "topMm": round(ys.min() / PX, 1)}))
