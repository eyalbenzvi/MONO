"""
Model photos (T2): finds the tee on each generated photo and where the
print goes on its back. Run by hand after generate.py (needs rembg, numpy,
pillow):

  python scripts/models/analyze.py <photos-dir> <jobs.json>

Writes public/models/<id>.webp (the photo), public/models/<id>-mask.png
(the tee, as alpha) and data/models/models.json: each photo's category,
tee colour and print box (fractions of the photo: x, y, width, height).
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
SRC, JOBS = sys.argv[1], json.load(open(sys.argv[2]))
OUT = os.path.join(ROOT, "public", "models"); DATA = os.path.join(ROOT, "data", "models")
os.makedirs(OUT, exist_ok=True); os.makedirs(DATA, exist_ok=True)
session = new_session("isnet-general-use")

def largest_component(mask, seed_box):
    """The connected region of `mask` with the most pixels inside seed_box (4-connected flood fill)."""
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32); best, best_n, cur = 0, 0, 0
    x0, y0, x1, y1 = seed_box
    for sy in range(y0, y1, 4):
        for sx in range(x0, x1, 4):
            if not mask[sy, sx] or lab[sy, sx]: continue
            cur += 1; stack = [(sy, sx)]; lab[sy, sx] = cur; n = 0
            while stack:
                y, x = stack.pop(); n += 1
                for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = cur; stack.append((yy, xx))
            if n > best_n: best, best_n = cur, n
    return lab == best if best else np.zeros_like(mask)

out = []
for j in JOBS:
    f = os.path.join(SRC, j["id"] + ".png")
    if not os.path.exists(f): continue
    img = Image.open(f).convert("RGB"); w, h = img.size
    person = np.array(remove(img, session=session, only_mask=True)) > 128
    a = np.asarray(img).astype(np.float32) / 255
    lum = a @ [0.2126, 0.7152, 0.0722]; sat = a.max(2) - a.min(2)
    # The tee: its colour, on the person. Lit white fabric is bright and grey; black is dark.
    cloth = person & ((lum > 0.45) & (sat < 0.22) if j["color"] == "white" else (lum < 0.3))
    tee = largest_component(cloth, (int(w * 0.3), int(h * 0.3), int(w * 0.7), int(h * 0.55)))
    ys, xs = np.nonzero(tee)
    if len(ys) < w * h * 0.04:
        print("skip", j["id"], "no tee found"); continue
    # The tee's own top and bottom: where the region is shoulder-wide (dark hair or a
    # light wall touching the tee never is), then the back's width below the shoulders.
    widths = tee.sum(1); maxw = widths.max()
    rows = np.nonzero(widths >= maxw * 0.55)[0]
    top, bot = rows.min(), rows.max()
    # Placed the same way on every photo, from the shoulders (the hem varies:
    # tucked, loose, cropped by the frame): centred on the back, its top a
    # little below the collar, about 40% of the back's width — a real back
    # print (28 cm on a ~60 cm back), not a panel.
    shoulder = int(top + (bot - top) * 0.12)
    cols = np.nonzero(tee[shoulder])[0]
    left, right = cols.min(), cols.max(); cx = (left + right) / 2; back = right - left
    pw = back * 0.4; ph = pw * 4 / 3
    py = top + back * 0.14
    box = [round(float((cx - pw / 2) / w), 4), round(float(py / h), 4), round(float(pw / w), 4), round(float(ph / h), 4)]
    Image.fromarray((tee * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)).save(os.path.join(OUT, j["id"] + "-mask.png"), optimize=True)
    img.save(os.path.join(OUT, j["id"] + ".webp"), quality=82, method=6)
    cat, color, _ = j["id"].rsplit("-", 2)
    out.append({"id": j["id"], "category": cat, "color": color, "box": box})
    print(j["id"], box, flush=True)
json.dump(out, open(os.path.join(DATA, "models.json"), "w"), indent=1)
print(len(out), "photos")
