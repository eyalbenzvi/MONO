"""
One ink from an illustration (the studio's raster path): a tonal or line
illustration on light paper becomes the two print files the MONO Design
Guidelines ask for, checked against sections 02, 04 and 05.

  python scripts/studio/oneink.py <image> <out-dir> <slug> [--crop x0,y0,x1,y1] [--size 0.9]
      [--mode engrave|halftone|line|pen|tone] [--edge horizon|dissolve|circle|arch|oval] [--title "OCTOPUS"] [--sub "Octopus vulgaris"]
      [--plate "Pl. IV"] [--view "Side elevation"] [--views 1] [--outline] [--ground] [--anchor 0.4]

Writes the files of the guidelines' delivery folder (section 09), at 300 DPI on
the 28 x 37 cm print area (3307 x 4370 px):
  <slug>.png         line art: one file, black ink (printed white on black tees);
  <slug>-black.png   tonal work: white ink for a black tee, the subject's light parts
  <slug>-white.png   and black ink for a white tee, its dark parts (two positives);
  <slug>-preview.png 1500 px wide, the design on a black background;
  <slug>-check.json  the measures and anything that fails (not delivered);
  print.json         the same measures, delivered with the design: the shop reads its size,
                     its coverage and whether it may print in white ink on a black tee.

--title and --sub set a heading above the picture, letter-spaced, in Space
Grotesk (SIL OFL 1.1): its capitals 8.5 mm (a heavier stroke) and 5 mm high, with a
0.5 mm rule under it. --plate adds a plate number at the rule's right ("Pl. IV"), --view
names the view after the subtitle ("Side elevation"). A title or subtitle that says
"study" claims several views: --views (how many the picture really shows) must be 2 or
more, or the check fails.

--mode engrave (the default for generated drawings) is line and solid only: no dot
screen anywhere. Lines are found by local contrast (a generated engraving's hatching is
finer than a pixel and reads as grey tone), only the truly dark parts print solid, a flat
grey with no line in it is left as tee; specks under 0.5 mm go. line, pen and tone are the older conversions (line and pen screen a
flat grey; tone is a dot screen throughout); in every mode but tone, more than 3% of the
ink in screen dots fails the check.

--mode halftone is for a shaded picture (tone that carries the drawing: a lit tower, a
feathered breast). It is the screen the shop's own photographs and uploads print with
(scripts/photos/halftone.py, lib/upload/convert.ts), but finer: round dots at 55 lpi (the textile
standard for photographic detail; the catalogue's 1500 px prints and uploads stay at 30) and 45 degrees, the
lightest dot 8% of a cell, the darkest tone 80% (a dark mass wider than 3.5 mm is scaled down to
that open mesh, its texture kept, a narrower stroke stays solid), highlights under 4% left as tee. It is
delivered for the white tee alone (<slug>-white.png: dark dots on a light tee); the dots are
the screen, so the screen, thin-ink and speck measures don't apply to it.

--outline says the picture is drawn as outline, with no cast shadows or shading masses
(asked for in the prompt). Only such a drawing may print in white ink on a black tee: a
shaded drawing printed white is a photographic negative (shadows glow). print.json's
blackTee is --outline and under 10% of the ink in solid fills.

The picture sits at the optical centre of the space under the heading (a little above
the middle), never pinned to the top. A wide subject (over 1.6 times as wide as tall) or
--ground gets a ground line under it and a dimension line below that, so a side
elevation builds height instead of floating as a strip.

--edge is for a full-bleed picture (a scene to the edges), which must not land on
the tee as a rectangle. It says how the scene ends, chosen per design:
  horizon  the ground ends in a straight cut with a thin rule under it; the sides and
           the top fall away, an empty sky is left as tee (the default for a scene);
  dissolve the scene dissolves into the tee on every side, its edge wandering (the scene's
           edge for generated work: no hard rectangle);
  rect     (or plate) cut to a rectangle with a thin keyline round it: fails the check (a hard
           rectangle reads as a photo printed on a shirt);
  circle   cut to a circle with a thin ring (a lens, a seal: a moon, an island);
  arch     a rectangle with a round top and a keyline (a window: falls, towers);
  oval     (or vignette) an engraver's vignette fading to nothing (sparingly: at most one in ten).
--fade is the old name for --edge oval. The keylines are 0.7 mm, 2.5 mm off the picture;
on a black tee only the light parts that carry drawing print, never a plain light area.

Every pixel is ink or nothing (alpha 0 or 255). Tone is a clustered-dot
screen whose dots and gaps are never under 0.4 mm; lines dark enough print
as lines; a dark mass wider than 4 mm is held to an open mesh, never a slab.
"""
import json, os, sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

DPI = 300
PX_MM = DPI / 25.4
AREA_W, AREA_H = round(280 * PX_MM), round(370 * PX_MM)  # 3307 x 4370
DESIGN_W, DESIGN_H = 260 * PX_MM, 350 * PX_MM
TOP = round(10 * PX_MM)
# The share of the spare height left above the picture (the optical centre: 40% above, 60% below). A
# picture as wide as it is tall (a round badge) placed so leaves the back empty for 4.6 cm and fails
# the 25 mm start: --anchor 0.15 sets it higher, still clear of the top.
ANCHOR = 0.4
# The heading's height and the space under it (px), when there is one (set in main).
HEAD = 0
# The screen: a 45-degree clustered dot, cell 1.1 mm (about 23 lines an inch).
CELL_MM = 1.1
# The darkest tone a mass may carry: 78% ink, an open mesh.
MAX_MASS_TONE = 0.78
# Where the picture was placed by the last fit (x0, top, width, height in px), for the ground line and the checks.
LAST_BOX = None
# The share of the ink the conversion put down as screen dots (line/pen screen a flat grey; tone is all dots).
SCREENED = 0.0


def load(path, crop=None):
    img = Image.open(path).convert("L")
    if crop:
        img = img.crop(crop)
    return np.asarray(img).astype(np.float32) / 255.0


def flatten_paper(grey):
    """The paper made white (halftone): a generated sheet's paper is grey and shaded (a vignette, a cast
    shadow), and every grey on it would print as dots. The paper's own tone is estimated round the
    picture (the lightest tone within about 7 mm, smoothed) and divided out."""
    r = max(15, round(min(grey.shape) * 0.07)) | 1
    paper = cv2.dilate(grey, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (r, r)))
    paper = cv2.GaussianBlur(paper, (0, 0), r / 2)
    return np.clip(grey / np.maximum(paper, 1e-3), 0, 1)


# How much of the source's drawing sits by a sharp line (set in main; of 14 reviewed studio sources under 0.35, one reached 7).
CRISP = None
CRISP_WARN = 0.35


def crispness(k):
    """The share of the drawn pixels (darker than 10%) next to a sharp edge in the source: a crisp ink drawing
    is mostly line; a soft pencil or airbrush picture is mostly grey slope, which the review marked down."""
    drawn = k > 0.10
    if not drawn.any():
        return 0.0
    lap = np.abs(cv2.Laplacian(cv2.GaussianBlur(k, (0, 0), 1.0), cv2.CV_32F))
    return float((lap[drawn] > 0.03).mean())


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


def dissolve(k, seed=11):
    """A scene dissolving into the tee on every side: a rounded rectangle (not an oval, so the
    scene keeps its width) whose edge wanders and frays, with a soft fall-off."""
    h, w = k.shape
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    nx, ny = np.abs(x - w / 2) / (w / 2), np.abs(y - h * 0.5) / (h / 2)
    r = (nx ** 6 + ny ** 6) ** (1 / 6)
    th = np.arctan2(y - h / 2, x - w / 2)
    rnd = np.random.default_rng(seed)
    wobble = sum(rnd.uniform(0.015, 0.035) / f * np.sin(f * th + rnd.uniform(0, 6.3)) for f in (3, 5, 9, 15))
    grain = cv2.GaussianBlur(rnd.random((h, w)).astype(np.float32), (0, 0), max(2, w / 150)) - 0.5
    edge = 0.9 + wobble + 0.5 * grain
    m = np.clip((edge - r) / 0.22, 0, 1)
    return m * m * (3 - 2 * m)


EDGES = ("horizon", "dissolve", "rect", "circle", "arch", "oval")
RULE_MM, GAP_MM = 0.7, 2.5


def edge_shape(h, w, edge):
    """Where a scene is kept (0..1, in picture pixels) for a cut edge. A small inset drops any
    border the picture drew itself."""
    i = max(2, round(0.02 * min(h, w)))
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    m = np.zeros((h, w), np.float32)
    if edge == "rect":
        m[i:h - i, i:w - i] = 1
    elif edge == "circle":
        r = min(h, w) / 2 - i
        m[(x - w / 2) ** 2 + (y - h / 2) ** 2 <= r * r] = 1
    elif edge == "arch":
        r = (w - 2 * i) / 2
        m[i:h - i, i:w - i] = 1
        top = y < i + r
        m[top & ((x - w / 2) ** 2 + (y - (i + r)) ** 2 > r * r)] = 0
    elif edge == "horizon":
        # A hard ground line at the bottom; the sides and the top fall away softly.
        sm = lambda v: np.clip(v, 0, 1) ** 2 * (3 - 2 * np.clip(v, 0, 1))
        side = sm(np.minimum(x, w - 1 - x) / (0.12 * w))
        top = sm(y / (0.12 * h))
        m = side * top
        m[h - i:] = 0
    return m


def edge_rule(M, edge):
    """The keyline (1-bit, print size) round a cut scene M: a ring 2.5 mm off it, or for a
    horizon one rule under the ground line, as wide as the ground."""
    g, r = round(GAP_MM * PX_MM), max(round(RULE_MM * PX_MM), 9)
    rule = np.zeros(M.shape, np.uint8)
    if edge == "horizon":
        rows = np.nonzero((M > 0.5).any(1))[0]
        if not len(rows):
            return rule
        y = rows[-1]
        xs = np.nonzero(M[y] > 0.5)[0]
        rule[y + g:y + g + r, xs[0]:xs[-1] + 1] = 1
        return rule
    inside = (M > 0.5).astype(np.uint8)
    near = cv2.dilate(inside, disc(g))
    return cv2.dilate(inside, disc(g + r)) & (1 - near)


def crop_box(k):
    """The paper trimmed off around the picture: its marks' bounding box, crumbs ignored."""
    m = (cv2.GaussianBlur(k, (0, 0), 2) > 0.12)
    rows, cols = np.nonzero(m.mean(1) > 0.004)[0], np.nonzero(m.mean(0) > 0.004)[0]
    if not len(rows) or not len(cols):
        return np.s_[:, :]
    return np.s_[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]


FONT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fonts", "space-grotesk.ttf")


def heading(title, sub, plate=None):
    """The heading as ink (1-bit), centred on the print area's width, with a 0.5 mm rule under it
    (and the plate number at the rule's right); and its height in px."""
    lines = [(title, 8.5, 0.3, 0.32), (sub, 5.0, 0.16, 0)] if sub else [(title, 8.5, 0.3, 0.32)]
    rows, gap = [], round(3.5 * PX_MM)
    for text, cap_mm, track, stroke_mm in lines:
        if not text:
            continue
        probe = ImageFont.truetype(FONT, 1000)
        cap = probe.getbbox("H")[3] - probe.getbbox("H")[1]
        size = round(cap_mm * PX_MM * 1000 / cap)
        f = ImageFont.truetype(FONT, size)
        sp = track * size
        sw = round(stroke_mm * PX_MM)
        widths = [f.getlength(c) for c in text]
        w = int(sum(widths) + sp * (len(text) - 1)) + 4 + 2 * sw
        asc, desc = f.getmetrics()
        im = Image.new("L", (w, asc + desc + 2 * sw), 0)
        dr = ImageDraw.Draw(im)
        x = float(sw)
        for c, cw in zip(text, widths):
            dr.text((x, sw), c, font=f, fill=255, stroke_width=sw, stroke_fill=255)
            x += cw + sp
        a = np.asarray(im) > 127
        ys = np.nonzero(a.any(1))[0]
        rows.append(a[ys[0]:ys[-1] + 1])
    rule_h, rule_gap = max(round(0.5 * PX_MM), 6), round(3 * PX_MM)
    hgt = sum(r.shape[0] for r in rows) + gap * (len(rows) - 1) + rule_gap + rule_h
    out = np.zeros((hgt, AREA_W), np.uint8)
    y = 0
    for r in rows:
        x0 = (AREA_W - r.shape[1]) // 2
        out[y:y + r.shape[0], x0:x0 + r.shape[1]] = r
        y += r.shape[0] + gap
    y += rule_gap - gap
    widest = max(r.shape[1] for r in rows)
    half = max(widest + (round(50 * PX_MM) if plate else 0), round(120 * PX_MM)) // 2
    out[y:y + rule_h, AREA_W // 2 - half:AREA_W // 2 + half] = 1
    if plate:
        probe = ImageFont.truetype(FONT, 1000)
        cap = probe.getbbox("H")[3] - probe.getbbox("H")[1]
        f = ImageFont.truetype(FONT, round(4.0 * PX_MM * 1000 / cap))
        im = Image.new("L", (int(f.getlength(plate)) + 4, sum(f.getmetrics())), 0)
        ImageDraw.Draw(im).text((0, 0), plate, font=f, fill=255)
        a = np.asarray(im) > 127
        ys = np.nonzero(a.any(1))[0]
        a = a[ys[0]:ys[-1] + 1]
        x1 = AREA_W // 2 + half
        y0 = max(0, y - round(1.5 * PX_MM) - a.shape[0])
        out[y0:y0 + a.shape[0], x1 - a.shape[1]:x1] |= a
    return out


def fit(k, size, trim=True, below=0):
    """Scale the picture into the design box (26 x 35 cm x size) and place it centred, at the optical
    centre of the space under the heading (a little above the middle). `below` (px) is kept free under
    the picture for a ground line and dimension line.
    Each of a stack of layers (the two positives) is trimmed and placed on its own,
    so each starts at the top: a pale sky is ink on a black tee and nothing on white."""
    if k.ndim == 3:
        return np.stack([fit_one(l[crop_box(l)] if trim else l, size, below) for l in k])
    return fit_one(k[crop_box(k)] if trim else k, size, below)


def fit_one(k, size, below=0):
    global LAST_BOX
    h, w = k.shape
    s = min(DESIGN_W * size / w, (DESIGN_H - HEAD - below) * size / h)
    nw, nh = int(w * s), int(h * s)
    up = cv2.resize(k, (nw, nh), interpolation=cv2.INTER_CUBIC if s > 1 else cv2.INTER_AREA)
    # A little sharpening after the enlargement keeps the engraved lines crisp.
    blur = cv2.GaussianBlur(up, (0, 0), 1.2 * s / 3)
    up = np.clip(up + 0.6 * (up - blur), 0, 1)
    canvas = np.zeros((AREA_H, AREA_W), np.float32)
    x0 = (AREA_W - nw) // 2
    # The optical centre: 40% of the spare height above the picture (and its ground block), 60% below.
    spare = max(0, round(TOP + DESIGN_H) - (TOP + HEAD) - nh - below)
    top = TOP + HEAD + round(ANCHOR * spare)
    canvas[top:top + nh, x0:x0 + nw] = up[: AREA_H - top]
    LAST_BOX = (x0, top, nw, min(nh, AREA_H - top))
    return canvas


GROUND_MM, DIM_GAP_MM = 0.6, 7.0


def ground_block(box):
    """A ground line under a side elevation (a little wider than it) and a dimension line below:
    0.4 mm with end ticks, as on a patent sheet or a builder's elevation (1-bit, print size)."""
    x0, top, nw, nh = box
    out = np.zeros((AREA_H, AREA_W), np.uint8)
    g = round(GROUND_MM * PX_MM)
    y = top + nh + round(1.5 * PX_MM)
    pad = round(0.04 * nw)
    out[y:y + g, max(0, x0 - pad):min(AREA_W, x0 + nw + pad)] = 1
    t = max(round(0.4 * PX_MM), 5)
    yd = y + g + round(DIM_GAP_MM * PX_MM)
    out[yd:yd + t, x0:x0 + nw] = 1
    tick = round(3 * PX_MM)
    for x in (x0, x0 + nw - t):
        out[yd - tick // 2:yd + tick // 2 + t, x:x + t] = 1
    return out


GROUND_BELOW = round((1.5 + GROUND_MM + DIM_GAP_MM + 3) * PX_MM)


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


def engrave_ink(tone):
    """Line and solid only (the conversion for generated drawings), no dot screen anywhere. A generated
    "engraving" is mostly grey tone: its hatching is finer than a pixel, so a threshold on darkness turns
    a mid-grey wing into a black blot and a pale breast into nothing. The lines are found instead by local
    contrast (darker than their surroundings, at two scales: the hatching and the strokes), and only the
    truly dark parts print solid; strokes under 0.4 mm are grown to it, specks under 0.5 mm go."""
    global SCREENED
    SCREENED = 0.0
    fine = cv2.GaussianBlur(tone, (0, 0), 0.8 * PX_MM)
    broad = cv2.GaussianBlur(tone, (0, 0), 2.5 * PX_MM)
    ridge = ((tone - fine) > 0.04) | ((tone - broad) > 0.10)
    ink = ((ridge & (tone > 0.12)) | (tone > 0.82)).astype(np.uint8)
    thick = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disc(0.2 * PX_MM))
    ink = np.maximum(ink, cv2.dilate(ink & (1 - thick), disc(0.2 * PX_MM + 0.5)))
    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disc(0.2 * PX_MM - 0.01))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(ink)
    keep = np.zeros(n, bool)
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] > (0.5 * PX_MM) ** 2 * 1.5
    return keep[lab].astype(np.uint8)


# The shop's screen (scripts/photos/halftone.py, lib/upload/convert.ts), at this file's 300 DPI, at 55 lpi
# from Oct 2026 (6 px a cell; designs converted before then were screened at 30 and are left as they are).
HT_LPI, HT_ANGLE = 55, 45
HT_MAX_TONE = 0.8
HT_MIN_DOT = 0.08
# A dark mass: a square 3.5 mm across fits inside it (halftone.py SLAB_PX, 19 px at 1500 px for 28 cm).
HT_SLAB_PX = round(19 * AREA_W / 1500) | 1
_ht_screen = None


def halftone_screen():
    """The AM threshold map: 0 at each dot's centre rising to 1 at the cell's corners (round dots that join past 50%)."""
    global _ht_screen
    if _ht_screen is None:
        cell = AREA_W / (28 / 2.54) / HT_LPI
        y, x = np.mgrid[0:AREA_H, 0:AREA_W].astype(np.float32) + 0.5
        t = np.deg2rad(HT_ANGLE)
        u = (x * np.cos(t) + y * np.sin(t)) / cell
        v = (-x * np.sin(t) + y * np.cos(t)) / cell
        _ht_screen = (0.5 - (np.cos(2 * np.pi * u) + np.cos(2 * np.pi * v)) / 4).astype(np.float32)
    return _ht_screen


def subject_only(k):
    """The picture alone (halftone): tone left only on the subject, the pieces of clear drawing (darker than
    18%, closed over 2 mm, holes filled) at least a twentieth the size of the largest; a faint paper residue,
    a rectangle a retouch left, a horizon apart from the subject print nothing."""
    on = cv2.morphologyEx((k > 0.18).astype(np.uint8), cv2.MORPH_CLOSE, disc(2 * PX_MM))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(on)
    if n <= 1:
        return k
    area = stats[1:, cv2.CC_STAT_AREA]
    keep = np.zeros(n, bool)
    keep[1:] = area >= area.max() / 20
    m = ndi.binary_fill_holes(keep[lab])
    m = cv2.GaussianBlur(cv2.dilate(m.astype(np.uint8), disc(1.5 * PX_MM)).astype(np.float32), (0, 0), 0.5 * PX_MM)
    return k * m


def halftone_ink(tone):
    """The shop's photograph screen on a tone (0..1 ink): highlights cleaned ((D - 0.04) / 0.92), the dot
    floor, a dark mass scaled down to the open mesh (strokes keep full ink), then ink where the tone beats the screen.
    A mass is scaled, not clipped (Oct 2026): clipping turned a dark limb or trunk into a flat grey slab with
    straight seams, where scaling keeps its texture (100% prints at HT_MAX_TONE, 60% at 48%), and the mask is
    feathered so no edge shows."""
    global SCREENED
    SCREENED = 1.0
    d = np.clip((tone - 0.04) / 0.92, 0, 1)
    d = np.where(d < HT_MIN_DOT / 2, 0, np.maximum(d, HT_MIN_DOT) * (d > 0)).astype(np.float32)
    dark = (d > HT_MAX_TONE).astype(np.uint8)
    k = np.ones((HT_SLAB_PX, HT_SLAB_PX), np.uint8)
    mass = cv2.dilate(cv2.erode(dark, k), k).astype(np.float32)
    mass = cv2.GaussianBlur(mass, (0, 0), HT_SLAB_PX / 2)
    d = d * (1 - mass * (1 - HT_MAX_TONE))
    return (d > halftone_screen()).astype(np.uint8)


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
    global SCREENED
    dots = (np.minimum(tone, MAX_MASS_TONE) > screen_map()).astype(np.uint8)
    ink = np.where(flat.astype(bool), dots, ink).astype(np.uint8)
    slab = slab_mask(ink)
    ink = hold_slabs(ink)
    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disc(0.2 * PX_MM))
    SCREENED = float(((flat.astype(bool) | slab) & (ink > 0)).sum() / max(1, ink.sum()))
    return ink


def slab_mask(ink):
    """Where hold_slabs will cut a mesh: solid patches wider than 4 mm."""
    core = cv2.erode(ink, disc(2 * PX_MM))
    return cv2.dilate(core, disc(2 * PX_MM)).astype(bool)


def pen_ink(tone):
    """Fine pen drawing (hairlines, technical drawings): a hairline enlarged from a small
    picture is a faint grey streak, not a dark line, so lines are found by local contrast
    (darker than their surroundings) rather than by darkness, then drawn at 0.4 mm or more."""
    local = cv2.GaussianBlur(tone, (0, 0), 1.2 * PX_MM)
    ridge = ((tone - local) > 0.035) & (tone > 0.08)
    ink = (ridge | (tone > 0.5)).astype(np.uint8)
    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disc(1.0))
    thick = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disc(0.2 * PX_MM))
    ink = np.maximum(ink, cv2.dilate(ink & (1 - thick), disc(1.6)))
    # Crumbs: pieces smaller than about 0.8 mm across are noise, not line.
    n, lab, stats, _ = cv2.connectedComponentsWithStats(ink)
    keep = np.zeros(n, bool)
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] > (0.8 * PX_MM) ** 2
    ink = keep[lab].astype(np.uint8)
    global SCREENED
    slab = slab_mask(ink)
    ink = hold_slabs(ink)
    SCREENED = float((slab & (ink > 0)).sum() / max(1, ink.sum()))
    return ink


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


def detail_light(k, light):
    """The black tee's positive for a faded scene: the light parts that carry drawing.
    A plain light area (an empty sky, the paper inside the vignette) is left as tee,
    not printed as a bright oval of mesh; the lit side of a tower, foam or snow with
    marks in it stays ink. Detail is the local contrast of the picture, about 2 mm round."""
    mean = cv2.GaussianBlur(k, (0, 0), 2 * PX_MM)
    std = np.sqrt(np.maximum(cv2.GaussianBlur(k * k, (0, 0), 2 * PX_MM) - mean * mean, 0))
    detail = np.clip((std - 0.03) / 0.09, 0, 1)
    detail = cv2.GaussianBlur(detail, (0, 0), 3 * PX_MM)
    return light * np.clip(detail * 1.4, 0, 1)


def solid_share(ink):
    """The share of the ink in solid fills: pixels whose 1.5 mm neighbourhood is over 85% ink."""
    k = max(3, round(1.5 * PX_MM)) | 1
    local = cv2.blur(ink.astype(np.float32), (k, k))
    return float(((local > 0.85) & (ink > 0)).sum() / max(1, ink.sum()))


def check(ink, ctx=None):
    """The guidelines' measures (sections 02, 04, 05) on a 1-bit print at 300 DPI, and the studio's
    own (a screen, a hard rectangle, an empty sheet, a heading on the picture, specks, a study
    of one view). ctx: mode, edge, title, sub, views, outline, box (the picture), headRows."""
    ctx = ctx or {}
    cov = ink.mean()
    # The drawing's own extent, under the heading (the heading isn't the picture).
    rows = ctx.get("headRows")
    art = ink.copy()
    if rows is not None:
        art[:rows + round(1 * PX_MM)] = 0
    ys, xs = np.nonzero(art)
    bw = (xs.max() - xs.min() + 1) / AREA_W if len(xs) else 0
    bh = (ys.max() - ys.min() + 1) / AREA_H if len(ys) else 0
    # The print's top (heading included): where the ink starts on the back.
    all_rows = np.nonzero(ink.any(1))[0]
    top_mm = all_rows[0] / PX_MM if len(all_rows) else 0
    thick = cv2.morphologyEx(ink, cv2.MORPH_OPEN, disc(0.2 * PX_MM - 0.01))
    thin = (ink & (1 - thick)).sum() / max(1, ink.sum())
    fails = []
    if not 0.04 <= cov <= 0.32: fails.append(f"coverage {cov:.1%} (4–32%)")
    if bw < 0.3 or bh < 0.3: fails.append(f"too small {bw:.0%} × {bh:.0%}")
    if top_mm > 25: fails.append(f"starts {top_mm:.0f} mm down")
    dots = ctx.get("mode") in ("tone", "halftone")
    if thin > 0.01 and ctx.get("mode") != "halftone": fails.append(f"{thin:.1%} of the ink thinner than 0.4 mm")
    screened = SCREENED if not dots else 1.0
    if ctx.get("mode") in ("engrave", "line", "pen") and screened > 0.03:
        fails.append(f"{screened:.0%} of the ink is screen dots (3% at most: line and solid only)")
    if ctx.get("edge") == "rect":
        fails.append("a hard rectangular edge (use --edge dissolve or horizon)")
    # An empty sheet: the drawing fills neither the design box's width nor its height (75%); or a
    # strip: full width but under 30% of the height (a side elevation must build height: a second
    # view, a plan above it, the ground block).
    dw, dh = bw * AREA_W / DESIGN_W, bh * AREA_H / DESIGN_H
    if bw > 0 and dw < 0.75 and dh < 0.75:
        fails.append(f"floats small: {dw:.0%} of the width, {dh:.0%} of the height (fill one of them to 75%)")
    elif bw > 0 and dh < 0.30:
        fails.append(f"a strip: {dh:.0%} of the height (add a second view or a plan to build height)")
    # The heading must stand clear of the picture by 3 mm.
    if rows is not None and len(ys):
        below = ys[ys > rows]
        if len(below) and (below.min() - rows) < 3 * PX_MM:
            fails.append("the heading touches the picture (3 mm clear)")
    # Specks: pieces under 0.5 mm across.
    n, lab, stats, _ = cv2.connectedComponentsWithStats(ink)
    crumbs = stats[1:, cv2.CC_STAT_AREA][stats[1:, cv2.CC_STAT_AREA] < (0.5 * PX_MM) ** 2 * 1.5].sum() if n > 1 else 0
    if not dots and crumbs / max(1, ink.sum()) > 0.002:
        fails.append(f"{crumbs / max(1, ink.sum()):.1%} of the ink in specks under 0.5 mm")
    says_study = "study" in (ctx.get("title") or "").lower() or "study" in (ctx.get("sub") or "").lower()
    if says_study and ctx.get("views", 1) < 2:
        fails.append("titled a study but shows one view (--views 2 or more, or retitle)")
    w_cm, h_cm = bw * 28, bh * 37
    if w_cm < 20 and h_cm < 30:
        fails.append(f"too small on the tee: {w_cm:.0f} × {h_cm:.0f} cm (20 cm wide or 30 cm tall)")
    solid = solid_share(ink)
    warns = []
    if CRISP is not None and CRISP < CRISP_WARN:
        warns.append(f"soft source: {CRISP:.0%} of the drawing by a sharp line ({CRISP_WARN:.0%}; the review marked soft grey pictures down)")
    return {
        "coverage": round(float(cov), 4),
        "thin": round(float(thin), 4), "sizeCm": [round(w_cm, 1), round(h_cm, 1)], "topMm": round(float(top_mm), 1),
        "screened": round(float(screened), 4), "solid": round(solid, 4),
        "blackTee": bool(ctx.get("outline")) and solid < 0.10,
        "crisp": round(CRISP, 3) if CRISP is not None else None,
        "fails": fails, "warns": warns,
    }


def save_ink(ink, colour, path):
    rgba = np.zeros((*ink.shape, 4), np.uint8)
    rgba[..., :3] = colour
    rgba[..., 3] = ink * 255
    Image.fromarray(rgba, "RGBA").save(path, optimize=True, dpi=(DPI, DPI))


def preview(ink, path, on_white=False):
    """The guidelines' preview: 1500 px wide, the design on the tee it sells on (black, or white for a
    drawing that may not print white on black: shown white, it would read as its own negative)."""
    small = cv2.resize(ink.astype(np.float32), (1500, round(1500 * AREA_H / AREA_W)), interpolation=cv2.INTER_AREA)
    Image.fromarray(((1 - small if on_white else small) * 255).astype(np.uint8), "L").save(path)


def main():
    global HEAD, ANCHOR
    args = sys.argv[1:]
    if "--anchor" in args:
        ANCHOR = float(args[args.index("--anchor") + 1])
    src, out, slug = args[0], args[1], args[2]
    crop = None
    size = 1.0
    mode = args[args.index("--mode") + 1] if "--mode" in args else "line"
    edge = args[args.index("--edge") + 1] if "--edge" in args else ("oval" if "--fade" in args else None)
    edge = {"plate": "rect", "vignette": "oval"}.get(edge, edge)
    if edge is not None and edge not in EDGES:
        sys.exit(f"--edge {edge}: one of {', '.join(EDGES)}")
    bleed = edge is not None
    if "--crop" in args:
        crop = tuple(int(v) for v in args[args.index("--crop") + 1].split(","))
    if "--size" in args:
        size = float(args[args.index("--size") + 1])
    os.makedirs(out, exist_ok=True)
    title = args[args.index("--title") + 1] if "--title" in args else None
    sub = args[args.index("--sub") + 1] if "--sub" in args else None
    plate = args[args.index("--plate") + 1] if "--plate" in args else None
    view = args[args.index("--view") + 1] if "--view" in args else None
    views = int(args[args.index("--views") + 1]) if "--views" in args else 1
    outline = "--outline" in args
    if view:
        sub = f"{sub} · {view}" if sub else view
    head = heading(title, sub, plate) if title else None
    if head is not None:
        HEAD = head.shape[0] + round(8 * PX_MM)
    g = load(src, crop)
    if mode == "halftone":
        g = flatten_paper(g)
    k = darkness(g, bleed)
    global CRISP
    CRISP = crispness(k)
    rule = None
    # A wide subject (or --ground): room under it for a ground line and a dimension line.
    kh, kw = k[crop_box(k)].shape if not bleed else k.shape
    ground = not bleed and ("--ground" in args or kw / max(1, kh) > 1.6)
    below = GROUND_BELOW if ground else 0
    if edge == "dissolve":
        m = dissolve(k)
        both = fit(np.stack([k * m, detail_light(k, 1 - k) * m]), size)
        k, light = both[0], both[1]
    elif edge == "oval":
        # The vignette fades both positives: the dark parts on white, the light parts on black.
        m = fade(k)
        both = fit(np.stack([k * m, detail_light(k, 1 - k) * m]), size)
        k, light = both[0], both[1]
    elif edge:
        # A cut edge: both positives and the shape placed alike (no trimming), then the keyline.
        m = edge_shape(*k.shape, edge)
        ys, xs = np.nonzero(m > 0)
        bb = np.s_[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        k, m = k[bb], m[bb]
        placed = fit(np.stack([k * m, detail_light(k, 1 - k) * m, m]), size, trim=False)
        k, light, M = placed
        rule = edge_rule(M, edge)
    else:
        k = fit(k, size, below=below)
    box = LAST_BOX
    if mode == "engrave":
        white = fit_coverage(k, 1.0, lo=0.04, hi=0.30, inker=engrave_ink)
        black = white
        mode, conv = "line", "engrave"
    elif mode == "halftone":
        # The white tee's positive only: dark dots on a light tee (white dots on black would be a negative).
        white = fit_coverage(subject_only(k), 1.0, lo=0.04, hi=0.32, inker=halftone_ink)
        black = None
        mode, conv = "halftone", "halftone"
    elif mode == "pen":
        white = pen_ink(k)
        black = white
        mode, conv = "line", "pen"
    elif mode == "line":
        conv = "line"
        # Line art: one file; the same lines print white on black and black on white (guidelines, 03).
        white = fit_coverage(k, 1.0, inker=line_ink)
        black = white
    else:
        conv = "tone"
        # Tonal work: two positives; on a black tee the subject's light parts are the ink.
        white = fit_coverage(k, 1.0)
        if bleed:
            black = fit_coverage(light, 1.0)
        else:
            mask = subject_mask(k)
            black = fit_coverage(np.clip(1 - k, 0, 1), mask.astype(np.float32))
    inks = [i for i in {id(white): white, id(black): black}.values() if i is not None]
    if rule is not None:
        for ink in inks:
            ink |= rule
    if ground and box is not None:
        block = ground_block(box)
        for ink in inks:
            ink |= block
    if head is not None:
        for ink in inks:
            ink[TOP:TOP + head.shape[0]] |= head
    if mode == "line":
        save_ink(white, (0, 0, 0), os.path.join(out, f"{slug}.png"))
    elif mode == "halftone":
        save_ink(white, (0, 0, 0), os.path.join(out, f"{slug}-white.png"))
    else:
        save_ink(white, (0, 0, 0), os.path.join(out, f"{slug}-white.png"))
        save_ink(black, (255, 255, 255), os.path.join(out, f"{slug}-black.png"))
    ctx = {"mode": conv, "edge": edge, "title": title, "sub": sub, "views": views, "outline": outline,
           "headRows": (TOP + head.shape[0]) if head is not None else None}
    rep = {"line": check(white, ctx)} if mode == "line" else {"white": check(white, ctx)} if mode == "halftone" else {"white": check(white, ctx), "black": check(black, ctx)}
    with open(os.path.join(out, f"{slug}-check.json"), "w") as f:
        json.dump(rep, f, indent=1, ensure_ascii=False)
    # Delivered with the design (the shop reads it): the measures of the print it sells.
    main_rep = rep.get("line") or rep["white"]
    # An engraving that may not print white on black is previewed on the white tee it sells on.
    if mode == "halftone":
        preview(white, os.path.join(out, f"{slug}-preview.png"), on_white=True)
    else:
        preview(black, os.path.join(out, f"{slug}-preview.png"), on_white=conv == "engrave" and not main_rep["blackTee"])
    with open(os.path.join(out, "print.json"), "w") as f:
        json.dump({"mode": conv, "edge": edge, "views": views, "outline": outline, "ground": ground,
                   "coverage": main_rep["coverage"], "solid": main_rep["solid"], "screened": main_rep["screened"],
                   "sizeCm": main_rep["sizeCm"], "blackTee": main_rep["blackTee"] and mode == "line",
                   "crisp": main_rep["crisp"], "fails": main_rep["fails"], "warns": main_rep["warns"]}, f, indent=1, ensure_ascii=False)
    print(slug, json.dumps(rep, ensure_ascii=False))


if __name__ == "__main__":
    main()
