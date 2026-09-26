"""
Background removal for studio object photographs (Air and Space), run by
hand as part of scripts/photos (needs: pip install "rembg[cpu]" pillow).

  python scripts/photos/cutout.py <keys-file> [cache-dir]

Reads <cache>/jpg/<key>.jpg, writes the cut-out (RGBA, alpha = object) to
<cache>/cut/<key>.png. The cache is node_modules/.cache/mono-photos unless
given (scripts/archive uses node_modules/.cache/mono-archive).
Model: isnet-general-use (rembg). Already cut keys are skipped.
"""
import os
import sys

from PIL import Image
from rembg import new_session, remove

CACHE = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "..", "node_modules", ".cache", "mono-photos")
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
