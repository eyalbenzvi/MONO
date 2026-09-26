"""
Model photos (T2): finds the tee on each generated photo and where the
print goes on its back. Run by hand after generate.py (needs rembg, numpy,
pillow):

  python scripts/models/analyze.py <photos-dir> <jobs.json>

Writes public/models/<id>.webp (the photo, in greyscale) and data/models/models.json: each photo's category,
tee colour and print box (fractions of the photo: x, y, width, height).
"""
import json, os, sys
import numpy as np
from PIL import Image
from rembg import new_session, remove

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
SRC, JOBS = sys.argv[1], json.load(open(sys.argv[2]))
OUT = os.path.join(ROOT, "public", "models"); DATA = os.path.join(ROOT, "data", "models")
os.makedirs(OUT, exist_ok=True); os.makedirs(DATA, exist_ok=True)
session = new_session("isnet-general-use")

out = []
for j in JOBS:
    f = os.path.join(SRC, j["id"] + ".png")
    if not os.path.exists(f): continue
    img = Image.open(f).convert("RGB"); w, h = img.size
    person = np.array(remove(img, session=session, only_mask=True)) > 128
    a = np.asarray(img).astype(np.float32) / 255
    lum = a @ [0.2126, 0.7152, 0.0722]
    # Placement from the silhouette (a colour mask catches hair, jeans and
    # shadows on a black tee): the neck is the narrowest row below the head,
    # the shoulders the widest row just under it; the spine runs from the
    # neck's centre to the centre of the body at the waist (the arms hang
    # either side, so that centre is the body's). The print sits on that
    # line, a hand below the collar, 46% of the shoulders wide.
    rows = [np.nonzero(person[r])[0] for r in range(h)]
    span = [(c.min(), c.max()) if len(c) else None for c in rows]
    head = next((r for r in range(h) if span[r]), None)
    if head is None:
        print("skip", j["id"], "no person"); continue
    width = lambda r: span[r][1] - span[r][0] if span[r] else 0
    cen = lambda r: (span[r][0] + span[r][1]) / 2 if span[r] else None
    search = range(head + int(h * 0.05), min(h - 1, head + int(h * 0.3)))
    neck = min(search, key=lambda r: width(r) if width(r) > 5 else 1e9)
    sh_rows = range(neck, min(h - 1, neck + int(h * 0.15)))
    shoulder_row = max(sh_rows, key=width); shoulders = width(shoulder_row)
    waist = min(h - 1, neck + int(shoulders * 1.25))
    cx = (cen(neck) + cen(waist)) / 2 if cen(waist) is not None else cen(neck)
    # Is the tee the colour asked for? Sample the middle of the back.
    patch = lum[int(neck + shoulders * 0.3):int(neck + shoulders * 0.7), int(cx - shoulders * 0.12):int(cx + shoulders * 0.12)]
    tone = float(patch.mean()) if patch.size else 0.5
    if (j["color"] == "white" and tone < 0.6) or (j["color"] == "black" and tone > 0.22):
        print("reject", j["id"], "tee tone", round(tone, 2)); continue
    pw = shoulders * 0.46; ph = pw * 4 / 3
    py = neck + shoulders * 0.22
    box = [round(float((cx - pw / 2) / w), 4), round(float(py / h), 4), round(float(pw / w), 4), round(float(ph / h), 4)]
    # Black and white, like the prints: the photo goes out in greyscale.
    img.convert("L").save(os.path.join(OUT, j["id"] + ".webp"), quality=82, method=6)
    out.append({"id": j["id"], "color": j["color"], "box": box})
    print(j["id"], box, flush=True)
json.dump(out, open(os.path.join(DATA, "models.json"), "w"), indent=1)
print(len(out), "photos")
