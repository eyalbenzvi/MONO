"""
One ink (content overhaul, Part 2): every WebP print — photographs, patent
models, archive scans — becomes strictly two-tone. Run by hand after the
fetch tools have written their prints (pip install pillow numpy):

  python scripts/photos/halftone.py            # every WebP print in public/prints
  python scripts/photos/halftone.py 2803 3845  # just these

- Tonal work (photographs, patent models; brush paintings, woodblock
  prints and botanical watercolours) gets an AM
  round-dot screen: 30 lpi at 45°, sized for the 28 × 37 cm print area,
  written at 1500 × 2000 (about 4.5 px a cell).
- Line work (etchings, woodcuts, prints, ornament, stencils) is screened
  too, its range stretched first so strokes reach full ink and print solid
  (a plain threshold turns a lithograph's tone into blots).
- The paper's residual tone is measured at the picture's edges and taken
  off first, so no paper rectangle turns into a field of dots.
- A photograph goes on the tee where its subject carries more ink (a dark
  instrument on white, bright metal on black) and is never inverted: its
  print is baked in that ink (white dots for a black tee, black for white).
  Ink prints stay black ink (the app inverts line work for a black tee).

The output's alpha is 0 or 255, nothing between. data/curation/halftone.json
records per print its mode, the photograph's tee and the output's hash, so
a print already screened is left alone (re-run after a fetch tool rewrites one).
"""
import hashlib, json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
MANIFEST = os.path.join(ROOT, "data", "curation", "halftone.json")
OUT_W, OUT_H = 1500, 2000
LPI, ANGLE, PRINT_CM = 30, 45, 28.0


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()[:16]


def upsample(d):
    return np.asarray(Image.fromarray((np.clip(d, 0, 1) * 255).astype(np.uint8)).resize((OUT_W, OUT_H), Image.LANCZOS)).astype(np.float32) / 255


_screen = None
def screen():
    """The AM threshold map: 0 at each dot's centre rising to 1 at the cell's corners (round dots that join past 50%)."""
    global _screen
    if _screen is None:
        cell = OUT_W / (PRINT_CM / 2.54) / LPI
        y, x = np.mgrid[0:OUT_H, 0:OUT_W].astype(np.float32) + 0.5
        t = np.deg2rad(ANGLE)
        u = (x * np.cos(t) + y * np.sin(t)) / cell
        v = (-x * np.sin(t) + y * np.cos(t)) / cell
        _screen = 0.5 - (np.cos(2 * np.pi * u) + np.cos(2 * np.pi * v)) / 4
    return _screen


def paper_level(d):
    """Residual paper tone: the median ink along the outer edge of the picture's box (0 when the edge is clean)."""
    on = d > 0.02
    if not on.any():
        return 0.0
    ys, xs = np.nonzero(on)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    r = max(3, int(min(y1 - y0, x1 - x0) * 0.03))
    ring = np.concatenate([d[y0:y0 + r, x0:x1 + 1].ravel(), d[y1 - r + 1:y1 + 1, x0:x1 + 1].ravel(), d[y0:y1 + 1, x0:x0 + r].ravel(), d[y0:y1 + 1, x1 - r + 1:x1 + 1].ravel()])
    return float(np.median(ring))


def process(n, medium):
    path = os.path.join(ROOT, "public", "prints", f"print_{n}.webp")
    im = np.asarray(Image.open(path).convert("RGBA")).astype(np.float32) / 255
    lum = im[..., 0] * 0.2126 + im[..., 1] * 0.7152 + im[..., 2] * 0.0722
    a = im[..., 3]
    entry = {}
    if medium == "photo":
        foot = a > 0.5
        ink_black = float((lum * a)[foot].mean()) if foot.any() else 0
        ink_white = float(((1 - lum) * a)[foot].mean()) if foot.any() else 0
        tee = "black" if ink_black > ink_white else "white"
        d = lum * a if tee == "black" else (1 - lum) * a
        # Stretch the subject's own tonal range, so the screen uses the full dot range.
        if foot.any():
            lo, hi = np.percentile(d[foot], [2, 98])
            d = np.where(foot, np.clip((d - lo) / max(1e-3, hi - lo), 0, 1), 0) * np.clip(a * 1.2, 0, 1)
        mode = "halftone"
        entry["tee"] = tee
        ink = 255 if tee == "black" else 0
    else:
        d = a * (1 - lum)
        p = paper_level(d)
        d = np.clip((d - p * 1.25) / max(1e-3, 1 - p * 1.25), 0, 1)
        # Every scan is screened: a threshold turns a lithograph's or engraving's tone into blots.
        # Line work is stretched first, so its strokes reach full ink and print as solid lines.
        mode = "halftone"
        if medium == "line" and (d > 0.05).any():
            d = np.clip(d / max(0.2, float(np.percentile(d[d > 0.05], 98))), 0, 1)
        entry["paper"] = round(p, 3)
        ink = 0
    D = upsample(d)
    D = np.clip((D - 0.04) / 0.92, 0, 1)  # clean highlights, full solids
    mask = D > screen()
    rgba = np.zeros((OUT_H, OUT_W, 4), np.uint8)
    rgba[..., :3] = ink
    rgba[..., 3] = mask.astype(np.uint8) * 255
    Image.fromarray(rgba, "RGBA").save(path, "WEBP", lossless=True, quality=100, method=4)
    entry.update(mode=mode, sha=sha(path))
    return entry


# Every WebP print's medium, from the sources the generator builds them from (retired ones too, so a
# re-run of the generator measures the same prints whichever designs it keeps).
MEDIA = """
import { existsSync, readFileSync } from "node:fs";
import { PER_CATEGORY } from "./scripts/gen/constants";
import { photoOrder } from "./scripts/photos/source";
import { archiveOrder } from "./scripts/archive/curation";
import { ARCHIVE_GROUPS } from "./scripts/archive/source";
import { TONAL_INK } from "./scripts/gen/colors";
const photos = JSON.parse(readFileSync("data/photos/photos.json", "utf8"));
const archive = JSON.parse(readFileSync("data/archive/archive.json", "utf8"));
const out: Record<number, string> = {};
for (const { n } of photoOrder(photos, PER_CATEGORY)) out[n] = "photo";
const additions = existsSync("data/archive/additions.json") ? JSON.parse(readFileSync("data/archive/additions.json", "utf8")) : [];
for (const { n, source } of [...archiveOrder(archive), ...additions.map((source: { n: number }) => ({ n: source.n, source }))]) out[n] = ARCHIVE_GROUPS[source.group as keyof typeof ARCHIVE_GROUPS].mode !== "ink" ? "photo" : TONAL_INK.includes(source.group) ? "tonal" : "line";
console.log(JSON.stringify(out));
"""


def main():
    from subprocess import check_output
    media = json.loads(check_output(["npx", "tsx", "-e", MEDIA], cwd=ROOT))
    want = set(sys.argv[1:])
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    todo = sorted((int(n), m) for n, m in media.items() if os.path.exists(os.path.join(ROOT, "public", "prints", f"print_{n}.webp")) and (not want or n in want))
    done = 0
    for n, medium in todo:
        path = os.path.join(ROOT, "public", "prints", f"print_{n}.webp")
        key = str(n)
        if key in manifest and manifest[key]["sha"] == sha(path):
            continue
        manifest[key] = process(n, medium)
        done += 1
        # Written after every print, so an interrupted run never screens a print twice.
        json.dump(manifest, open(MANIFEST, "w"), indent=0, sort_keys=True)
        if done % 100 == 0:
            print(done, flush=True)
    json.dump(manifest, open(MANIFEST, "w"), indent=0, sort_keys=True)
    print(f"screened {done}, {len(manifest)} in the manifest")


if __name__ == "__main__":
    main()
