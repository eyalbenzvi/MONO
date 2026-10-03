"""Place the drawing in the shop's print area (top-aligned) and run the one-ink check. python place.py ink.npy out-dir"""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, "../../../../../scripts/studio")
import oneink
ink = np.load(sys.argv[1]); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
W, H = oneink.AREA_W, oneink.AREA_H
PX = 300 / 25.4
canvas = np.zeros((H, W), np.uint8)
h, w = ink.shape
x0 = (W - w) // 2; y0 = round(8 * PX)
canvas[y0:y0 + h, x0:x0 + w] = ink[:H - y0]
rgba = np.zeros((H, W, 4), np.uint8); rgba[..., :3] = 255; rgba[..., 3] = canvas * 255
Image.fromarray(rgba, "RGBA").save(os.path.join(out, "eiger.png"), optimize=True, dpi=(300, 300))
np.save(os.path.join(out, "ink.npy"), canvas)
Image.fromarray(canvas * 235 + 15).resize((W // 6, H // 6), Image.LANCZOS).save(os.path.join(out, "d-black-s.png"))
ys, xs = np.nonzero(canvas)
print(json.dumps({"coverage": round(float(canvas.mean()), 4), "sizeCm": [round((xs.max() - xs.min() + 1) / PX / 10, 1), round((ys.max() - ys.min() + 1) / PX / 10, 1)]}))
print(oneink.check(canvas, {"mode": "line"}))
