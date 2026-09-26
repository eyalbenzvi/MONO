"""
Background removal for studio object photographs (Air and Space), run by
hand as part of scripts/photos (needs: pip install "rembg[cpu]" pillow).

  python scripts/photos/cutout.py <keys-file>

Reads node_modules/.cache/mono-photos/jpg/<key>.jpg, writes the cut-out
(RGBA, alpha = object) to node_modules/.cache/mono-photos/cut/<key>.png.
Model: isnet-general-use (rembg). Already cut keys are skipped.
"""
import os
import sys

from PIL import Image
from rembg import new_session, remove

CACHE = os.path.join(os.path.dirname(__file__), "..", "..", "node_modules", ".cache", "mono-photos")
session = new_session("isnet-general-use")
os.makedirs(os.path.join(CACHE, "cut"), exist_ok=True)
keys = open(sys.argv[1]).read().split()
for i, key in enumerate(keys):
    out = os.path.join(CACHE, "cut", key + ".png")
    src = os.path.join(CACHE, "jpg", key + ".jpg")
    if os.path.exists(out) or not os.path.exists(src):
        continue
    im = Image.open(src).convert("RGB")
    im.thumbnail((1600, 1600))
    remove(im, session=session).save(out)
    if i % 25 == 0:
        print(f"{i}/{len(keys)}", flush=True)
