"""EIGER: the Eiger at night from the west-north-west, a white-ink engraving drawn from the real terrain
(swissALTI3D, see fetch.py and vox.py). Engraved rows bent part-way to the terrain's contours, as thick as the
moonlight on the rock; in shadow they keep the press minimum and break into dashes; the picture fades out in an oval
vignette by line spacing; stars, the skyline, and the headlamps of rope teams on the north face.
python style.py params-style.json gbuf.npz out-dir"""
import json, os, sys
import cv2
import numpy as np
from scipy.ndimage import distance_transform_edt, gaussian_filter

P = json.load(open(sys.argv[1]))
G = np.load(sys.argv[2])
OUT = sys.argv[3]; os.makedirs(OUT, exist_ok=True)
z = G["z"].astype(np.float64); dep = G["depth"]; slope = G["slope"]
nx, ny, nz = G["nx"], G["ny"], G["nz"]
h, w = z.shape
terr = ~np.isnan(z)
# fill pinholes (nearest valid)
if (~terr).any():
    idx = distance_transform_edt(~terr, return_distances=False, return_indices=True)
    holes = ~terr & (distance_transform_edt(~terr) < 3)
    for a in (z, dep, slope, nx, ny, nz):
        a[holes] = a[tuple(i[holes] for i in idx)]
    terr = terr | holes
zs = gaussian_filter(np.nan_to_num(z), P.get("zsmooth", 1.0))
L = np.array(P["light"], float); L /= np.linalg.norm(L)
lit = np.clip(np.nan_to_num(nx * L[0] + ny * L[1] + nz * L[2]), 0, 1)
# the cliffs' normals come from a 2 m grid seen side-on: smooth across the streaks (screen x) more than down them
lit = cv2.GaussianBlur(lit.astype(np.float32), (0, 0), sigmaX=P.get("lit_sx", 5), sigmaY=P.get("lit_sy", 1.5))
rock = np.clip((lit - P["t_lo"]) / (P["t_hi"] - P["t_lo"]), 0, 1) ** P.get("t_gamma", 1.0)
sl = cv2.GaussianBlur(np.nan_to_num(slope, nan=90).astype(np.float32), (0, 0), 2)
zz = np.nan_to_num(z)
# winter: snow lies where the face eases off (ledges, the ice fields), above the meadows
snowy = np.clip((P["snow_hi"] - sl) / (P["snow_hi"] - P["snow_lo"]), 0, 1) * np.clip((zz - P["snow_z0"]) / 200, 0, 1)
snow_t = snowy * (P["snow_base"] + (1 - P["snow_base"]) * np.clip(lit / 0.6, 0, 1))
tone = np.maximum(rock * P.get("rock_gain", 0.8), snow_t)
# the foot of the face (pasture, forest) sinks into the night
tone *= np.clip((zz - P["foot_z0"]) / P["foot_dz"], 0, 1) ** 1.3

# the picture dies away at the bottom and the sides as an engraver's vignette: the lines thin out and stop
yy_f = np.arange(h)[:, None] / h; xx_f = np.arange(w)[None, :] / w
wob = cv2.GaussianBlur(np.random.default_rng(7).standard_normal((1, w)).astype(np.float32), (0, 0), w / 30)
wob = wob / (np.abs(wob).max() + 1e-6)
fb = np.clip((P["fade_end"] + 0.03 * wob - yy_f) / (P["fade_end"] - P["fade_start"]), 0, 1)
wobv = cv2.GaussianBlur(np.random.default_rng(8).standard_normal((h, 1)).astype(np.float32), (0, 0), h / 30)
wobv = wobv / (np.abs(wobv).max() + 1e-6)
fs = np.clip((xx_f - 0.0 + 0.02 * wobv) / P["side_fade"], 0, 1) * np.clip((1.0 - xx_f + 0.02 * wobv) / P["side_fade"], 0, 1)
fade = (fb * fs) ** 1.2
if P.get("oval"):
    # one soft oval: the engraving ends inside it whatever the terrain does
    ox, oy, rx, ry = P["oval"]
    rr = np.sqrt(((xx_f - ox) / rx) ** 2 + ((yy_f - oy) / ry) ** 2)
    rr = rr + 0.025 * wob + 0.025 * wobv
    fo = np.clip((1.0 - rr) / P.get("oval_soft", 0.18), 0, 1)
    fade = fade * fo
    fs = fs * fo
fade = np.where(np.arange(h)[:, None] < P.get("side_from", 0) * h, fb, fade)
tone_nf = tone.copy()
tone = tone * fade

# engraved line screen: rows a fixed period apart, bent part-way to the face's contours (warp), as thick as the
# moonlight; where the cliffs crowd the contours the screen rows keep the lines apart
yy0 = np.mgrid[0:h, 0:w][0].astype(np.float64)
zw = gaussian_filter(zz, P["warp_sigma"])
gyz, gxz = np.gradient(zw)
gmed = np.median(np.hypot(gxz, gyz)[terr]) + 1e-6
phi = (1 - P["warp"]) * yy0 + P["warp"] * (-zw / gmed)
gp_y, gp_x = np.gradient(phi)
gp = np.hypot(gp_x, gp_y) + 1e-6
per = P["period"]
d = np.abs(phi / per - np.round(phi / per)) * per / gp
spacing = per / gp
width = P["w_min"] + tone * (P["w_max"] - P["w_min"])
width = np.minimum(width, spacing * P.get("w_frac", 0.72))
# below the tone where a line reaches the press minimum it keeps that width but breaks into dashes, shorter as the
# rock darkens, so a shadow is broken line, never a hole
w_fl = P["w_floor"]
t_full = (w_fl - P["w_min"]) / (P["w_max"] - P["w_min"])
width = np.maximum(width, w_fl)
line_id = np.round(phi / per)
jit = np.sin(line_id * 12.9898) * 43758.5453; jit = jit - np.floor(jit)
xx_d = np.mgrid[0:h, 0:w][1].astype(np.float64)
if P.get("fade_by_spacing"):
    # the vignette fades by spacing, as an engraver's does: lines stay whole and at full width where the
    # picture fades out, but only every 2nd, then every 4th, then 8th line is cut, until none are
    width = P["w_min"] + tone_nf * (P["w_max"] - P["w_min"])
    width = np.maximum(np.minimum(width, spacing * P.get("w_frac", 0.72)), w_fl)
    kf = np.clip(np.floor(-np.log2(np.maximum(fade, 1e-3)) * P.get("fade_steps", 1.6)), 0, 4)
    keep_line = (np.mod(line_id, 2 ** kf) == 0) & (fade > P.get("fade_cut", 0.06))
    fz = fade < P.get("fade_solid", 0.85)          # in the fading zone shadows don't break into dashes
    duty = np.where(fz, 1.0, np.clip(tone_nf / t_full, 0, 1) ** P.get("dash_gamma", 1.0))
    dash = ((xx_d / P["dash_len"] + jit) % 1.0) < duty
    ink = (d < width / 2) & terr & keep_line & dash & ((tone_nf > P.get("t_cut", 0.03)) | fz)
    # the sides: each line ends at its own point as it nears the edge (a per-line threshold on the side fade)
    jit2 = np.sin(line_id * 78.233) * 12543.123; jit2 = jit2 - np.floor(jit2)
    ink &= fs > (P.get("side_end_lo", 0.15) + P.get("side_end_span", 0.8) * jit2)
else:
    duty = np.clip(tone / t_full, 0, 1) ** P.get("dash_gamma", 1.0)
    dash = ((xx_d / P["dash_len"] + jit) % 1.0) < duty
    ink = (d < width / 2) & terr & (tone > P.get("t_cut", 0.03)) & dash

# outline: the skyline
skyline = cv2.morphologyEx((~terr).astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((P["edge_px"], P["edge_px"]), np.uint8)).astype(bool)
ink |= skyline & (fs > P.get("sky_fs", 0.35)) & (np.arange(w)[None, :] < P.get("sky_xmax", 1.0) * w)

rng = np.random.default_rng(3)

# stars
sky = ~terr
sky_far = distance_transform_edt(sky) > 25
for i in range(P["stars"]):
    x, y = rng.integers(0, w), int(rng.integers(0, h) * 0.5)
    if 0 <= y < h and sky_far[y, x]:
        r = rng.choice(P.get("star_r", [4, 4, 5, 5, 6, 8]))
        cv2.circle(ink_u8 := ink.view(np.uint8), (int(x), int(y)), int(r), 1, -1)

# press rules: no stroke under 0.4 mm (thin tips are grown, as the shop's line_ink does), no speck under 0.5 mm
def disc(r):
    k = int(np.ceil(r)); yy_, xx_ = np.ogrid[-k:k + 1, -k:k + 1]
    return (xx_ * xx_ + yy_ * yy_ <= r * r).astype(np.uint8)
ink = ink.astype(np.uint8)
thick = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disc(2.35))
thin = ink & (1 - thick)
ink = np.maximum(ink, cv2.dilate(thin, disc(P.get("thin_grow", 2.2))))
n, lab, st, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
keep = st[:, cv2.CC_STAT_AREA] >= P.get("min_area", 70); keep[0] = False
ink = keep[lab].astype(np.uint8)

ink = ink.astype(np.uint8)
# last: trim every tip under 0.4 mm (an opening with the checker's own disc), then drop what is left as specks
ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disc(2.36))
n, lab, st, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
keep = st[:, cv2.CC_STAT_AREA] >= P.get("min_area", 70); keep[0] = False
# on the rock, a dash shorter than a few millimetres reads as noise: those go (stars in the sky stay)
cy_ = st[:, cv2.CC_STAT_TOP] + st[:, cv2.CC_STAT_HEIGHT] // 2; cx_ = st[:, cv2.CC_STAT_LEFT] + st[:, cv2.CC_STAT_WIDTH] // 2
on_rock = terr[np.clip(cy_, 0, h - 1), np.clip(cx_, 0, w - 1)] & (fade[np.clip(cy_, 0, h - 1), np.clip(cx_, 0, w - 1)] < P.get("clean_below_fade", 1.01))
keep &= ~on_rock | (st[:, cv2.CC_STAT_AREA] >= P.get("rock_min_area", 70))
ink = keep[lab].astype(np.uint8)
# the climbers: headlamps strung up the Heckmair line, each a dot in its own black halo. Control points are given as
# (screen x, real elevation); the row is where that elevation lies in that column.
if P.get("route"):
    pts = []
    for x, zt in P["route"]:
        col = zz[:, int(x)]
        y = int(np.argmin(np.abs(col - zt) + (col == 0) * 1e6))
        pts.append((float(x), float(y)))
    pts = np.array(pts)
    seg = np.hypot(*np.diff(pts, axis=0).T); cum = np.r_[0, np.cumsum(seg)]
    # rope teams, not a dotted line: small groups of lamps a rope-length apart, long dark gaps between teams
    at = [cum[-1] * f + g for f in P["teams"] for g in (0, P["dot_gap"], 2 * P["dot_gap"])[:P.get("per_team", 2)]]
    dots = [np.array([np.interp(s, cum, pts[:, 0]), np.interp(s, cum, pts[:, 1])]) for s in at if s <= cum[-1]]
    ink = ink.astype(np.uint8)
    for p in dots:
        cv2.circle(ink, (int(p[0]), int(p[1])), P["dot_halo"], 0, -1)
    for p in dots:
        cv2.circle(ink, (int(p[0]), int(p[1])), P["dot_r"], 1, -1)
ink = ink.astype(np.uint8)
np.save(os.path.join(OUT, "ink.npy"), ink)
Image = __import__("PIL.Image", fromlist=["Image"])
Image.fromarray(ink * 255).save(os.path.join(OUT, "ink.png"))
Image.fromarray(cv2.resize(ink * 255, (w // 4, h // 4), interpolation=cv2.INTER_AREA)).save(os.path.join(OUT, "small.png"))
print("coverage", ink.mean())
