"""G-buffer of the swissALTI3D terrain by heightfield ray marching, one screen column at a time (the camera
looks level; a lens shift frames the face, so verticals stay vertical). Each pixel row in a column is covered by
the first sample, near to far, that rises above it; the hit point is interpolated between samples, so there are no
gaps however steep the face. python vox.py params.json out.npz"""
import json, sys
import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates

P = json.load(open(sys.argv[1]))
M = np.load(P["dem"]).astype(np.float32)
# vertical exaggeration about a base level, as the panorama painters did (1.0 = true)
if P.get("vexag", 1.0) != 1.0:
    M = P.get("vbase", 1500.0) + (M - P.get("vbase", 1500.0)) * P["vexag"]
E0, N_TOP = 2640000.0, 1164000.0
Ms = gaussian_filter(M, P.get("nsmooth", 1.2))
gy, gx = np.gradient(Ms, 2.0)

def sample(a, E, N):
    col = (E - E0 - 1) / 2.0; row = (N_TOP - N - 1) / 2.0
    return map_coordinates(a, [row, col], order=1, mode="nearest")

C = np.array(P["cam"], float)
az = np.radians(P["azimuth"])                 # compass bearing of the view, degrees from north
fwd = np.array([np.sin(az), np.cos(az)]); rgt = np.array([np.cos(az), -np.sin(az)])
w, h = P["size"]
foc = (h / 2) / np.tan(np.radians(P["vfov"]) / 2)
cy = h / 2 + P.get("shift_px", 0)            # lens shift: the horizon row
ts = np.arange(P["t0"], P["t1"], P["dt"], dtype=np.float32)
u = np.arange(w) + 0.5 - w / 2
dirs = fwd[None, :] + (u / foc)[:, None] * rgt[None, :]      # horizontal ray per column (unnormalised: zc = t)
YS = np.empty((len(ts), w), np.float32)
for i in range(0, len(ts), 256):
    t = ts[i:i + 256, None]
    E = C[0] + t * dirs[None, :, 0]; N = C[1] + t * dirs[None, :, 1]
    Z = sample(M, E.ravel(), N.ravel()).reshape(E.shape)
    YS[i:i + 256] = cy - foc * (Z - C[2]) / t
RM = np.minimum.accumulate(YS, axis=0)
ty = np.full((h, w), np.nan, np.float32)
rows = np.arange(h, dtype=np.float32) + 0.5
for c in range(w):
    rm = -RM[:, c]                                # increasing
    k = np.searchsorted(rm, -rows, side="left")   # first sample whose running min <= row
    ok = (k < len(ts)) & (k > 0)
    kk = np.clip(k, 1, len(ts) - 1)
    y1 = YS[kk, c]; y0 = RM[kk - 1, c]
    fr = np.clip((y0 - rows) / np.maximum(y0 - y1, 1e-3), 0, 1)
    t = ts[kk - 1] + fr * (ts[kk] - ts[kk - 1])
    t[k == 0] = ts[0]
    ty[:, c] = np.where((k < len(ts)), t, np.nan)
E = C[0] + ty * dirs[None, :, 0]; N = C[1] + ty * dirs[None, :, 1]
sky = np.isnan(ty)
Ef, Nf = np.nan_to_num(E), np.nan_to_num(N)
Z = sample(M, Ef.ravel(), Nf.ravel()).reshape(h, w)
dzdE = sample(gx, Ef.ravel(), Nf.ravel()).reshape(h, w); dzdN = -sample(gy, Ef.ravel(), Nf.ravel()).reshape(h, w)
nl = np.sqrt(dzdE ** 2 + dzdN ** 2 + 1)
out = dict(z=Z, depth=ty, nx=-dzdE / nl, ny=-dzdN / nl, nz=1 / nl, slope=np.degrees(np.arccos(1 / nl)), e=E, n=N)
for k in out:
    out[k] = np.where(sky, np.nan, out[k]).astype(np.float32)
np.savez_compressed(sys.argv[2], **out)
print("terrain", float(np.mean(~sky)), "foc", foc)
