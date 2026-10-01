"""
One ink from an illustration (the studio's raster path): a tonal or line
illustration on light paper becomes the two print files the MONO Design
Guidelines ask for, checked against sections 02, 04 and 05.

  python scripts/studio/oneink.py <image> <out-dir> <slug> [--crop x0,y0,x1,y1] [--size 0.9] [--mode line|tone] [--fade]

Writes, at 300 DPI on the 28 x 37 cm print area (3307 x 4370 px):
  <slug>-white.png   black ink for a white tee: the picture's dark parts are ink;
  <slug>-black.png   white ink for a black tee: the subject's light parts are ink
                     (the picture stays a positive, never a negative);
  <slug>-preview.png 1500 px wide, the design on both tees;
  <slug>-check.json  the measures and anything that fails.

--fade is for a full-bleed picture (a scene to the edges): it fades to nothing
at the edges, as the guidelines ask of a picture with its background.

Every pixel is ink or nothing (alpha 0 or 255). Tone is a clustered-dot
screen whose dots and gaps are never under 0.4 mm; lines dark enough print
as lines; a dark mass wider than 4 mm is held to an open mesh, never a slab.
"""
import json, os, sys
import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

DPI = 300
PX_MM = DPI / 25.4
AREA_W, AREA_H = round(280 * PX_MM), round(370 * PX_MM)  # 3307 x 4370
DESIGN_W, DESIGN_H = 260 * PX_MM, 350 * PX_MM
TOP = round(10 * PX_MM)
# The screen: a 45-degree clustered dot, cell 1.1 mm (about 23 lines an inch).
CELL_MM = 1.1
# The darkest tone a mass may carry: 78% ink, an open mesh.
MAX_MASS_TONE = 0.78


def load(path, crop=None):
    img = Image.open(path).convert("L")
    if crop:
        img = img.crop(crop)
    return np.asarray(img).astype(np.float32) / 255.0


def darkness(grey, full_bleed=False):
    """Ink amount 0..1 with the paper taken off: the light end of the picture is paper
    (a full-bleed picture has no paper, so only its lightest tone is taken off)."""
    k = 1.0 - grey
    lo = np.percentile(k, 2 if full_bleed else 35)  # the paper's own tone
    hi = np.percentile(k, 99.7)
    return np.clip((k - lo) / max(1e-3, hi - lo), 0, 1)


def fade(k, seed=7):
    """Fade a full-bleed picture to nothing at its edges, as an engraver's vignette: an
    oval whose edge wanders (so it never reads as a shape) with a soft fall-off, the
    bottom left a little longer than the top, so the scene sits on the tee, not in a box."""
    h, w = k.shape
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    nx, ny = (x - w / 2) / (w / 2), (y - h * 0.48) / (h / 2)
    r = np.sqrt(nx * nx + ny * ny)
    th = np.arctan2(ny, nx)
    rnd = np.random.default_rng(seed)
    wobble = sum(rnd.uniform(0.02, 0.05) / f * np.sin(f * th + rnd.uniform(0, 6.3)) for f in (3, 5, 8, 13))
    grain = cv2.GaussianBlur(rnd.random((h, w)).astype(np.float32), (0, 0), max(2, w / 120)) - 0.5
    edge = 0.92 + wobble + 0.6 * grain
    m = np.clip((edge - r) / 0.38, 0, 1)
    m = m * m * (3 - 2 * m)
    return m


def crop_box(k):
    """The paper trimmed off around the picture: its marks' bounding box, crumbs ignored."""
    m = (cv2.GaussianBlur(k, (0, 0), 2) > 0.12)
    rows, cols = np.nonzero(m.mean(1) > 0.004)[0], np.nonzero(m.mean(0) > 0.004)[0]
    if not len(rows) or not len(cols):
        return np.s_[:, :]
    return np.s_[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]


def fit(k, size):
    """Scale the picture into the design box (26 x 35 cm x size) and place it centred, top-aligned.
    Each of a stack of layers (the two positives) is trimmed and placed on its own,
    so each starts at the top: a pale sky is ink on a black tee and nothing on white."""
    if k.ndim == 3:
        return np.stack([fit_one(l[crop_box(l)], size) for l in k])
    return fit_one(k[crop_box(k)], size)


def fit_one(k, size):
    h, w = k.shape
    s = min(DESIGN_W * size / w, DESIGN_H * size / h)
    nw, nh = int(w * s), int(h * s)
    up = cv2.resize(k, (nw, nh), interpolation=cv2.INTER_CUBIC if s > 1 else cv2.INTER_AREA)
    # A little sharpening after the enlargement keeps the engraved lines crisp.
    blur = cv2.GaussianBlur(up, (0, 0), 1.2 * s / 3)
    up = np.clip(up + 0.6 * (up - blur), 0, 1)
    canvas = np.zeros((AREA_H, AREA_W), np.float32)
    x0 = (AREA_W - nw) // 2
    canvas[TOP:TOP + nh, x0:x0 + nw] = up[: AREA_H - TOP]
    return canvas


def disc(r_px):
    r = int(np.ceil(r_px))
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return (x * x + y * y <= r_px * r_px).astype(np.uint8)


def screen_map():
    """A clustered-dot threshold map at 45 degrees (0..1, dots grow from the cell centres)."""
    cell = CELL_MM * PX_MM
    y, x = np.mgrid[0:AREA_H, 0:AREA_W].astype(np.float32)
    a = np.pi / 4
    u = (x * np.cos(a) + y * np.sin(a)) / cell
    v = (-x * np.sin(a) + y * np.cos(a)) / cell
    # Spot function: Euclidean dot, switching to inverted dots past 50% (so gaps stay round too).
    fu, fv = u - np.floor(u) - 0.5, v - np.floor(v) - 0.5
    spot = 1 - (fu * fu + fv * fv) / 0.5  # 1 at the centre, 0 at the corners
    return np.clip(1 - spot, 0, 1)


def hold_masses(tone):
    """Cap the tone inside dark masses wider than about 4 mm, so they print as mesh, not slab."""
    dark = (tone > 0.6).astype(np.uint8)
    core = cv2.erode(dark, disc(2 * PX_MM))
    mass = cv2.dilate(core, disc(2 * PX_MM)).astype(bool)
    out = tone.copy()
    out[mass] = np.minimum(out[mass], MAX_MASS_TONE)
    return out


def to_ink(tone):
    """Screen a tone map to 1-bit ink, then clean what won't print. The whole picture is
    held to MAX_MASS_TONE, so its darkest parts are an even open mesh (no solid slab, and
    no seam where a capped mass meets an uncapped stroke)."""
    t = np.minimum(tone, MAX_MASS_TONE)
    ink = (t > screen_map()).astype(np.uint8)
    # Specks under 0.4 mm across go; gaps under 0.4 mm close up deliberately (they would anyway).
    r = 0.2 * PX_MM
    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disc(r))
    return ink


def line_ink(tone):
    """Line work (engraving, woodcut, pen): the lines are already the screen, so a threshold, not dots.
    Strokes under 0.4 mm are thickened to it; flat mid-grey (wash, not line) is screened."""
    ink = (tone > 0.5).astype(np.uint8)
    thick = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disc(0.2 * PX_MM))
    thin = ink & (1 - thick)
    ink = np.maximum(ink, cv2.dilate(thin, disc(1.2)))
    # Flat grey: mid tone with little local contrast.
    mean = cv2.GaussianBlur(tone, (0, 0), 0.8 * PX_MM)
    var = cv2.GaussianBlur(tone * tone, (0, 0), 0.8 * PX_MM) - mean * mean
    flat = ((mean > 0.18) & (mean < 0.75) & (var < 0.012)).astype(np.uint8)
    flat = cv2.morphologyEx(flat, cv2.MORPH_OPEN, disc(1.5 * PX_MM))
    dots = (np.minimum(tone, MAX_MASS_TONE) > screen_map()).astype(np.uint8)
    ink = np.where(flat.astype(bool), dots, ink).astype(np.uint8)
    ink = hold_slabs(ink)
    return cv2.morphologyEx(ink, cv2.MORPH_OPEN, disc(0.2 * PX_MM))


def hold_slabs(ink):
    """Any solid patch still wider than 4 mm (lines merged in the enlargement) is opened into mesh."""
    core = cv2.erode(ink, disc(2 * PX_MM))
    slab = cv2.dilate(core, disc(2 * PX_MM)).astype(bool)
    if slab.any():
        cell = round(CELL_MM * PX_MM)
        yy, xx = np.mgrid[0:ink.shape[0], 0:ink.shape[1]]
        holes = (((xx + yy) % cell) < max(5, cell * 0.45)) & (((xx - yy) % cell) < max(5, cell * 0.45))
        ink = ink.copy()
        ink[slab & holes] = 0
    return ink


def subject_mask(k):
    """Where the picture is something rather than paper: the drawing's marks closed up and filled."""
    m = (k > 0.18).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, disc(3.5 * PX_MM))
    m = ndi.binary_fill_holes(m).astype(np.uint8)
    # Drop crumbs: keep pieces bigger than 1 cm^2.
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros(n, bool)
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] > (10 * PX_MM) ** 2
    m = keep[lab].astype(np.uint8)
    return cv2.erode(m, disc(0.6 * PX_MM))


def fit_coverage(tone, mask, lo=0.06, hi=0.30, inker=None):
    """Bend the tone (a gamma) until the screened coverage falls inside the guidelines' 4–32%."""
    inker = inker or to_ink
    g = 1.0
    for _ in range(14):
        ink = inker(np.power(tone, g) * mask)
        c = ink.mean()
        if c > hi:
            g *= 1.25
        elif c < lo:
            g /= 1.25
        else:
            break
    return ink


def check(ink):
    """The guidelines' measures (sections 02, 04, 05) on a 1-bit print at 300 DPI."""
    area = ink.size
    cov = ink.mean()
    core = cv2.erode(ink, disc(2 * PX_MM))
    solid = cv2.dilate(core, disc(2 * PX_MM)) & ink
    n, lab, stats, _ = cv2.connectedComponentsWithStats(solid)
    largest = stats[1:, cv2.CC_STAT_AREA].max() / area if n > 1 else 0
    ys, xs = np.nonzero(ink)
    bw = (xs.max() - xs.min() + 1) / AREA_W if len(xs) else 0
    bh = (ys.max() - ys.min() + 1) / AREA_H if len(ys) else 0
    top_mm = ys.min() / PX_MM if len(ys) else 0
    e = round(2 * PX_MM)
    edges = [ink[:, :e].mean(), ink[:, -e:].mean(), ink[:e].mean(), ink[-e:].mean()]
    thick = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disc(0.2 * PX_MM - 0.01))
    thin = (ink & (1 - thick)).sum() / max(1, ink.sum())
    fails = []
    if not 0.04 <= cov <= 0.32: fails.append(f"coverage {cov:.1%} (4–32%)")
    if solid.mean() > 0.10: fails.append(f"solid ink {solid.mean():.1%} (≤10%)")
    if largest > 0.03: fails.append(f"largest solid patch {largest:.1%} (≤3%)")
    if all(v > 0.25 for v in edges): fails.append("ink along all four edges")
    if bw < 0.3 or bh < 0.3: fails.append(f"too small {bw:.0%} × {bh:.0%}")
    if top_mm > 25: fails.append(f"starts {top_mm:.0f} mm down")
    if thin > 0.01: fails.append(f"{thin:.1%} of the ink thinner than 0.4 mm")
    return {
        "coverage": round(float(cov), 4), "solid": round(float(solid.mean()), 4), "largestSolid": round(float(largest), 4),
        "thin": round(float(thin), 4), "sizeCm": [round(bw * 28, 1), round(bh * 37, 1)], "topMm": round(float(top_mm), 1), "fails": fails,
    }


def save_ink(ink, colour, path):
    rgba = np.zeros((*ink.shape, 4), np.uint8)
    rgba[..., :3] = colour
    rgba[..., 3] = ink * 255
    Image.fromarray(rgba, "RGBA").save(path, optimize=True, dpi=(DPI, DPI))


TEE = [(0.31, 0.0), (0.69, 0.0), (0.93, 0.07), (1.0, 0.30), (0.86, 0.36), (0.84, 0.28), (0.84, 1.0), (0.16, 1.0), (0.16, 0.28), (0.14, 0.36), (0.0, 0.30), (0.07, 0.07)]


def mockup(ink, tee, w=750):
    """The back of a tee (about 76 cm across the sleeves) with the print at its true size and place."""
    cm = w / 76
    h = int(76 * cm * 1.0)
    bg = (236, 236, 236) if tee == "black" else (40, 40, 40)
    cloth = (22, 22, 22) if tee == "black" else (246, 246, 244)
    ink_c = (240, 240, 240) if tee == "black" else (16, 16, 16)
    im = Image.new("RGB", (w, h), bg)
    dr = ImageDraw.Draw(im)
    dr.polygon([(x * w, y * h + 0.02 * h) for x, y in TEE], fill=cloth)
    dr.ellipse([0.36 * w, -0.03 * h, 0.64 * w, 0.06 * h], fill=bg)
    pw, ph = int(28 * cm), int(37 * cm)
    small = cv2.resize(ink.astype(np.float32), (pw, ph), interpolation=cv2.INTER_AREA)
    layer = Image.new("RGB", (pw, ph), ink_c)
    alpha = Image.fromarray((small * 255).astype(np.uint8), "L")
    im.paste(layer, ((w - pw) // 2, int(0.11 * h)), alpha)
    return im


def main():
    args = sys.argv[1:]
    src, out, slug = args[0], args[1], args[2]
    crop = None
    size = 1.0
    mode = args[args.index("--mode") + 1] if "--mode" in args else "line"
    bleed = "--fade" in args
    if "--crop" in args:
        crop = tuple(int(v) for v in args[args.index("--crop") + 1].split(","))
    if "--size" in args:
        size = float(args[args.index("--size") + 1])
    os.makedirs(out, exist_ok=True)
    k = darkness(load(src, crop), bleed)
    m = fade(k) if bleed else None
    if bleed:
        # The vignette fades both positives: the dark parts on white, the light parts on black.
        both = fit(np.stack([k * m, (1 - k) * m]), size)
        k, light = both[0], both[1]
    else:
        k = fit(k, size)
    if mode == "line":
        # Line art: one file; the same lines print white on black and black on white (guidelines, 03).
        white = fit_coverage(k, 1.0, inker=line_ink)
        black = white
    else:
        # Tonal work: two positives; on a black tee the subject's light parts are the ink.
        white = fit_coverage(k, 1.0)
        if bleed:
            black = fit_coverage(light, 1.0)
        else:
            mask = subject_mask(k)
            black = fit_coverage(np.clip(1 - k, 0, 1), mask.astype(np.float32))
    save_ink(white, (0, 0, 0), os.path.join(out, f"{slug}-white.png"))
    save_ink(black, (255, 255, 255), os.path.join(out, f"{slug}-black.png"))
    a, b = mockup(black, "black"), mockup(white, "white")
    prev = Image.new("RGB", (a.width * 2, a.height))
    prev.paste(a, (0, 0))
    prev.paste(b, (a.width, 0))
    prev.save(os.path.join(out, f"{slug}-preview.png"))
    rep = {"white": check(white), "black": check(black)}
    with open(os.path.join(out, f"{slug}-check.json"), "w") as f:
        json.dump(rep, f, indent=1, ensure_ascii=False)
    print(slug, json.dumps(rep, ensure_ascii=False))


if __name__ == "__main__":
    main()
