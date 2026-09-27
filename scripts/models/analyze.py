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
from PIL import Image, ImageFilter
from rembg import new_session, remove

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
SRC, JOBS = sys.argv[1], json.load(open(sys.argv[2]))
OUT = os.path.join(ROOT, "public", "models"); DATA = os.path.join(ROOT, "data", "models")
os.makedirs(OUT, exist_ok=True); os.makedirs(DATA, exist_ok=True)
session = new_session("isnet-general-use")
cloth_session = new_session("u2net_cloth_seg")

OUT_W, OUT_H = 512, 704
SHOULDERS, COLLAR = 0.56, 0.24
# The print: 46% of the shoulders wide (3:4), its top 0.34 shoulder-widths below the collar.
def print_box(sh, collar=COLLAR):
    """The print for shoulders spanning `sh` of the width, the collar at `collar` of the height: 46% of them wide (3:4), its top 0.34 shoulder-widths below the collar."""
    pw = sh * 0.46; ph = pw * OUT_W / OUT_H * 4 / 3
    return [round(0.5 - pw / 2, 4), round(collar + sh * 0.34 * OUT_W / OUT_H, 4), round(pw, 4), round(ph, 4)]
PRINT_BOX = print_box(SHOULDERS)
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
    # (A looser tee sits in more shade: its jobs may set a lower bar.)
    if (j["color"] == "white" and tone < j.get("min_tone", 0.6)) or (j["color"] == "black" and tone > 0.22):
        print("reject", j["id"], "tee tone", round(tone, 2)); continue
    # The centre from the tee itself, at chest height below the armpits (where
    # the arms hang apart from it): each row's run of tee colour through the
    # silhouette's centre, left and right edges — its median midpoint is the
    # middle of the back, even when the body is a little turned.
    cloth = (lum > 0.5) if j["color"] == "white" else (lum < 0.2)
    cloth &= person
    mids = []
    for r in range(int(neck + shoulders * 0.75), int(neck + shoulders * 1.0)):
        c = int(cx)
        if r >= h or not cloth[r, c]: continue
        L = c; R = c
        while L > 0 and cloth[r, L - 1]: L -= 1
        while R < w - 1 and cloth[r, R + 1]: R += 1
        if R - L > shoulders * 0.4: mids.append((L + R) / 2)
    if len(mids) >= 5: cx = float(np.median(mids))
    # The tee: the clothing model's upper-body mask (clean on a white tee,
    # shadows and folds included, neck and arms left out), holes closed.
    upper = np.asarray(cloth_session.predict(img)[0].convert("L")) > 128
    upper &= person
    filled = np.asarray(Image.fromarray((upper * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))) > 128
    tee = filled & person
    # Only between the collar and the hem (the model can stray into hair or jeans).
    rows_w = tee.sum(1)
    hem = max((r for r in range(h) if rows_w[r] >= shoulders * 0.6), default=h - 1)
    tee[: max(0, neck - 2)] = False
    tee[hem + 1 :] = False
    # The clothing model stops short of a loose tee's hem: the white cloth just
    # below it, within the tee's width, is tee too (left out, the black twin
    # showed a white band at the waist).
    span = np.nonzero(tee[hem])[0]
    if len(span) and j["color"] == "white":
        lo_c, hi_c = span.min(), span.max()
        for r in range(hem + 1, min(h, hem + int(shoulders * 0.4))):
            row = (lum[r, lo_c : hi_c + 1] > 0.5) & person[r, lo_c : hi_c + 1]
            if row.sum() < (hi_c - lo_c) * 0.15: break
            tee[r, lo_c : hi_c + 1] |= row
    # The centre of the back from the tee itself (clean mask): the midpoint of
    # its edges over the chest, below the sleeves.
    mids = []
    for r in range(int(neck + shoulders * 0.55), int(neck + shoulders * 0.95)):
        c = np.nonzero(tee[r])[0] if r < h else []
        if len(c) > shoulders * 0.5: mids.append((c.min() + c.max()) / 2)
    if len(mids) >= 5: cx = float(np.median(mids))
    # One framing for every photo: scaled and cropped so the shoulders span
    # SHOULDERS of the width, the spine is the centre line and the collar
    # sits at COLLAR of the height. The print box is then the same on every
    # photo (PRINT_BOX): centred, its top ~10 cm below the collar.
    # A broad man (or a loose tee) would need more than the generated picture
    # at that scale — the rest filled with a mirror image (a second head, a
    # kaleidoscope street) — so his shoulders take more of the width instead,
    # and his print box follows (print_box).
    sh = max(SHOULDERS, shoulders / (w * 0.98), OUT_H * shoulders / (OUT_W * h * 0.98))
    f = OUT_W * sh / shoulders
    cw, ch = OUT_W / f, OUT_H / f
    left, top_ = cx - cw / 2, neck - OUT_H * COLLAR / f
    # Never above the picture: the frame comes down to its top edge, and the collar (and print) sit that much lower.
    top_ = max(0.0, min(top_, h - ch)) if ch <= h else top_
    box = print_box(sh, (neck - top_) / ch)
    arr = np.asarray(img.convert("L"))
    pad = int(max(cw, ch))
    padded = np.pad(arr, pad, mode="symmetric")  # mirrored, never streaked edges (see unsmear.py)
    crop = Image.fromarray(padded).crop((int(left + pad), int(top_ + pad), int(left + pad + cw), int(top_ + pad + ch))).resize((OUT_W, OUT_H), Image.LANCZOS)
    # Its black-tee twin: the tee (the white cloth on the person, the part
    # joined to the back) darkened, keeping its folds and shading.
    if tee.sum() < shoulders * shoulders * 0.5:
        print("skip", j["id"], "(tee not found)"); continue
    soft = np.asarray(Image.fromarray((tee * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))) / 255.0
    g = np.asarray(img.convert("L")).astype(np.float32) / 255
    def framed(arr, name):
        a8 = np.pad((np.clip(arr, 0, 1) * 255).astype(np.uint8), pad, mode="symmetric")
        Image.fromarray(a8).crop((int(left + pad), int(top_ + pad), int(left + pad + cw), int(top_ + pad + ch))).resize((OUT_W, OUT_H), Image.LANCZOS).save(os.path.join(OUT, name + ".webp"), quality=82, method=6)
    # Full white: the tee's greys lifted towards white, its folds kept faint.
    lo = float(np.percentile(g[tee], 5))
    # How much of the tee's folds stay (a relaxed tee keeps more of them: a flattened one looks painted on).
    white = 1 - j.get("folds", 0.3) * np.clip((1 - g) / max(1e-3, 1 - lo), 0, 1) ** 1.4
    framed(g * (1 - soft) + white * soft, j["id"] + "-white")
    out.append({"id": j["id"] + "-white", "color": "white", "box": box})
    # Full black twin: the tee darkened, its folds keeping a faint sheen.
    if True:
        dark = 0.012 + 0.09 * np.clip((g - lo) / max(1e-3, 1 - lo), 0, 1) ** 2
        twin = g * (1 - soft) + dark * soft
        framed(twin, j["id"] + "-black")
        out.append({"id": j["id"] + "-black", "color": "black", "box": box})
    print(j["id"], "framed", round(f, 2), "shoulders", round(sh, 3), "pad", {"left": round(-min(0, left)), "top": round(-min(0, top_)), "right": round(max(0, left + cw - w)), "bottom": round(max(0, top_ + ch - h))}, flush=True)
# Added to the photos already there (a photo analysed again replaces its entry).
known = json.load(open(os.path.join(DATA, "models.json"))) if os.path.exists(os.path.join(DATA, "models.json")) else []
# The order stays (designs are dealt to photos by position): an entry keeps its place, new ones go last.
fresh = {m["id"]: m for m in out}
merged = [fresh.pop(m["id"], m) for m in known] + list(fresh.values())
json.dump(merged, open(os.path.join(DATA, "models.json"), "w"), indent=1)
print(len(out), "photos analysed,", len(merged), "in all")
