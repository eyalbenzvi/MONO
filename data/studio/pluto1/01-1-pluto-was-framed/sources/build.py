"""PLUTO WAS FRAMED: a punk-zine photocopy collage in white ink for a black tee.

Ransom-note letters (the shop's fonts, each letter on its own torn scrap), Pluto from
New Horizons (NASA PIA19952, public domain) in coarse photocopy dots, tape, a New Horizons
probe sketch with its path, scribbled stars. Everything but the photograph is drawn here.

  python build.py params.json out-dir
"""
import json, math, os, sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

P = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
FONTS = P["fonts_dir"]
PX = 300 / 25.4
W, H = round(280 * PX), round(370 * PX)
rng = np.random.default_rng(P.get("seed", 7))
LINE = max(1, round(P.get("line_mm", 0.6) * PX))

ink = np.zeros((H, W), np.uint8)


def mm(v):
    return int(round(v * PX))


def paste(layer, cover, x0, y0):
    """Put a piece down on top: its paper (cover) hides what is under it, then its ink."""
    h, w = layer.shape
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if xa >= xb or ya >= yb:
        return
    sl = (slice(ya, yb), slice(xa, xb))
    ls = (slice(ya - y0, yb - y0), slice(xa - x0, xb - x0))
    ink[sl][cover[ls] > 0] = 0
    ink[sl] |= layer[ls]


def torn(w, h, amp=1.2, step=2.0):
    """A torn-paper outline round a w x h box (px): the edges wander in small jagged steps."""
    pts = []
    corners = [(0, 0), (w, 0), (w, h), (0, h)]
    for i in range(4):
        (ax, ay), (bx, by) = corners[i], corners[(i + 1) % 4]
        n = max(2, int(math.hypot(bx - ax, by - ay) / mm(step)))
        nx, ny = -(by - ay), bx - ax
        ln = math.hypot(nx, ny) or 1
        nx, ny = nx / ln, ny / ln
        off = 0.0
        for k in range(n):
            t = k / n
            off = 0.6 * off + rng.normal(0, mm(amp) * 0.6)
            pts.append((ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off))
    return np.array(pts)


def screen(shape, tone, cell_mm, angle=45, phase=0.0):
    """A clustered-dot screen of a tone map (0..1): round dots, none under 0.45 mm, gaps held open."""
    h, w = shape
    cell = cell_mm * PX
    y, x = np.mgrid[0:h, 0:w].astype(np.float32) + 0.5
    t = np.deg2rad(angle)
    u = (x * np.cos(t) + y * np.sin(t)) / cell + phase
    v = (-x * np.sin(t) + y * np.cos(t)) / cell + phase
    thr = 0.5 - (np.cos(2 * np.pi * u) + np.cos(2 * np.pi * v)) / 4
    floor = math.pi * (0.52 / 2) ** 2 / cell_mm ** 2
    d = np.where(tone < floor / 2, 0, np.maximum(tone, floor))
    d = np.minimum(d, P.get("max_tone", 0.72))
    return (d > thr).astype(np.uint8)


def rotate_piece(layer, cover, deg):
    h, w = layer.shape
    c = (w / 2, h / 2)
    M = cv2.getRotationMatrix2D(c, deg, 1)
    cos, sin = abs(M[0, 0]), abs(M[0, 1])
    nw, nh = int(h * sin + w * cos) + 4, int(h * cos + w * sin) + 4
    M[0, 2] += nw / 2 - c[0]
    M[1, 2] += nh / 2 - c[1]
    f = lambda a: (cv2.warpAffine(a.astype(np.float32), M, (nw, nh), flags=cv2.INTER_LINEAR) > 0.3).astype(np.uint8)
    return f(layer), f(cover)


def letter_piece(ch, spec):
    """One ransom letter on its own torn scrap. style 'line': scrap outlined, letter in ink;
    'screen': the scrap a photocopy grey, the letter knocked out of it; 'solid': letter only, a torn keyline."""
    font = ImageFont.truetype(os.path.join(FONTS, spec["font"]), mm(spec["size"]))
    bb = font.getbbox(ch)
    lw, lh = bb[2] - bb[0], bb[3] - bb[1]
    pad = mm(spec.get("pad", 4.5))
    w, h = lw + 2 * pad, lh + 2 * pad
    m = mm(3)
    glyph = Image.new("L", (w + 2 * m, h + 2 * m), 0)
    ImageDraw.Draw(glyph).text((m + pad - bb[0], m + pad - bb[1]), ch, font=font, fill=255)
    g = (np.array(glyph) > 127).astype(np.uint8)
    poly = (torn(w, h, amp=spec.get("tear", 1.0)) + m).astype(np.int32)
    cover = np.zeros_like(g)
    cv2.fillPoly(cover, [poly], 1)
    outline = np.zeros_like(g)
    cv2.polylines(outline, [poly], True, 1, LINE)
    style = spec["style"]
    if style in ("screen", "paper"):
        grey = screen(g.shape, np.full(g.shape, spec.get("grey", 0.38), np.float32), 1.25, angle=spec.get("angle", 45))
        halo = cv2.dilate(g, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (mm(1.2) | 1,) * 2))
        layer = (grey & cover & (1 - halo)) | outline
    else:
        layer = g | outline
    cover = cv2.dilate(cover, np.ones((LINE, LINE), np.uint8))
    return rotate_piece(layer, cover, spec.get("rot", 0.0))


def line_of(word, specs, target_w_mm):
    pieces = [letter_piece(ch, s) for ch, s in zip(word, specs)]
    dys = [s.get("dy", 0) for s in specs]
    total = sum(p[0].shape[1] for p in pieces)
    gap = -mm(P.get("letter_overlap_mm", 2.0))
    width = total + gap * (len(pieces) - 1)
    scale = mm(target_w_mm) / width
    out = []
    for layer, cover in pieces:
        if abs(scale - 1) > 0.01:
            sz = (max(1, int(layer.shape[1] * scale)), max(1, int(layer.shape[0] * scale)))
            layer = (cv2.resize(layer.astype(np.float32), sz) > 0.5).astype(np.uint8)
            cover = (cv2.resize(cover.astype(np.float32), sz) > 0.5).astype(np.uint8)
        out.append((layer, cover))
    return [(l, c, dy) for (l, c), dy in zip(out, dys)], int(gap * scale)


def place_line(pieces, gap, x_mm, top_mm, jitter_mm):
    x = mm(x_mm)
    heights = [p[0].shape[0] for p in pieces]
    base = mm(top_mm) + max(heights) // 2
    for (layer, cover, dy) in pieces:
        y = base - layer.shape[0] // 2 + mm(dy) + mm(rng.uniform(-jitter_mm, jitter_mm))
        paste(layer, cover, x, y)
        x += layer.shape[1] + gap
    return max(heights)


# ---- the photograph: Pluto in photocopy dots, on a torn print, taped ----
def pluto_piece():
    src = cv2.imread(P["pluto_src"], cv2.IMREAD_COLOR)
    f = src.astype(np.float32) / 255
    # Luminance, leaning to blue: the pale heart (nitrogen ice) against the tan and dark red ground.
    b, gg, r = f[..., 0], f[..., 1], f[..., 2]
    g = np.clip(P.get("pluto_mix", [0.5, 0.35, 0.15])[0] * b + P.get("pluto_mix", [0.5, 0.35, 0.15])[1] * gg + P.get("pluto_mix", [0.5, 0.35, 0.15])[2] * r, 0, 1)
    cx, cy, r = P["pluto_disc"]  # in source px
    crop = g[max(0, cy - r):cy + r, max(0, cx - r):cx + r]
    D = mm(P["pluto_mm"])
    crop = cv2.resize(crop, (D, D), interpolation=cv2.INTER_LANCZOS4)
    # Photocopy contrast: a curve that keeps the heart bright and the dark belt detailed.
    lo, hi, gam = P["pluto_levels"]
    tone = np.clip((crop - lo) / (hi - lo), 0, 1) ** gam
    yy, xx = np.mgrid[0:D, 0:D]
    disc = ((xx - D / 2) ** 2 + (yy - D / 2) ** 2) <= (D / 2 - 1) ** 2
    # Dodge and burn, as a darkroom would: the heart (the smooth bright plain in the south) lifted,
    # the bright north held back a little, so the heart is the brightest shape on the disc.
    sm_ = cv2.resize(crop, (500, 500), interpolation=cv2.INTER_AREA)
    mu = cv2.GaussianBlur(sm_, (0, 0), 3)
    sd = np.sqrt(np.maximum(cv2.GaussianBlur(sm_ * sm_, (0, 0), 3) - mu * mu, 0))
    heart = np.clip(1 - sd / 0.05, 0, 1) * np.clip((mu - 0.45) / 0.15, 0, 1)
    v = np.linspace(0, 1, 500)[:, None]
    heart = cv2.GaussianBlur(heart * np.clip((v - 0.42) / 0.1, 0, 1), (0, 0), 8)
    heart = cv2.resize(np.clip(heart / max(1e-6, np.percentile(heart, 99.5)), 0, 1), (D, D))
    north = cv2.resize(np.clip((0.5 - v) / 0.4, 0, 1) * np.ones((1, 500)), (D, D))
    db = P.get("dodge_burn", [0.35, 0.25])
    tone = np.clip(tone * (1 - db[1] * north) + db[0] * heart, 0, 1)
    # The night side and the dark belt keep a faint tone, so the whole round disc reads.
    tone = np.maximum(tone, P.get("pluto_floor", 0.12)) * disc
    m = mm(P["photo_margin_mm"])
    e = mm(4)  # room for the torn edge to wander outside the print
    w = h = D + 2 * m
    img = np.zeros((h + 2 * e, w + 2 * e), np.float32)
    img[e + m:e + m + D, e + m:e + m + D] = tone
    dots = screen(img.shape, img, P["pluto_cell_mm"], angle=45)
    poly = (torn(w, h, amp=1.4, step=2.5) + e).astype(np.int32)
    cover = np.zeros(img.shape, np.uint8)
    cv2.fillPoly(cover, [poly], 1)
    outline = np.zeros_like(cover)
    cv2.polylines(outline, [poly], True, 1, LINE)
    win = np.zeros(img.shape, np.uint8)
    b = mm(P.get("photo_border_mm", 0))
    if b:
        cv2.rectangle(win, (e + b, e + b), (e + w - b, e + h - b), 1, -1)
        paper = screen(img.shape, np.full(img.shape, P.get("photo_border_grey", 0.2), np.float32), 1.0, angle=15)
        dots = dots | (paper & (1 - win))
    layer = (dots & cover) | outline
    return layer, cover


def tape_piece(len_mm, wid_mm, deg):
    w, h = mm(len_mm), mm(wid_mm)
    pad = mm(2)
    layer = np.zeros((h + 2 * pad, w + 2 * pad), np.uint8)
    # Tape: torn ends, straight sides, filled with fine diagonal lines (translucent).
    pts = [(pad, pad), (pad + w, pad)]
    for k in range(1, 6):
        pts.append((pad + w + rng.uniform(-mm(1.2), mm(1.2)), pad + h * k / 6))
    pts += [(pad + w, pad + h), (pad, pad + h)]
    for k in range(5, 0, -1):
        pts.append((pad + rng.uniform(-mm(1.2), mm(1.2)), pad + h * k / 6))
    poly = np.array(pts, np.int32)
    cover = np.zeros_like(layer)
    cv2.fillPoly(cover, [poly], 1)
    hatch = np.zeros_like(layer)
    sp = mm(P.get("tape_hatch_mm", 1.6))
    for x in range(-h, w + h + 2 * pad, sp):
        cv2.line(hatch, (x, 0), (x + h + 2 * pad, h + 2 * pad), 1, LINE)
    outline = np.zeros_like(layer)
    cv2.polylines(outline, [poly], True, 1, LINE)
    return rotate_piece((hatch & cover) | outline, cover, deg)


def sketch_line(img, pts, wob=0.5, passes=2, width=None):
    """A hand line: drawn twice, a little off each time."""
    width = width or SKETCH_W[0]
    pts = np.array(pts, np.float32)
    for _ in range(passes):
        # Slow wobble, not jitter: the noise is smoothed along the stroke.
        nz = rng.normal(0, mm(wob), pts.shape)
        if len(pts) > 6:
            k = np.ones(7) / 7
            nz = np.stack([np.convolve(np.r_[nz[-3:, i], nz[:, i], nz[:3, i]], k, "valid") for i in range(2)], 1)
        q = pts + nz
        cv2.polylines(img, [q.astype(np.int32)], False, 1, width)


SKETCH_W = [LINE]


def ellipse_pts(cx, cy, a, b, rot, n=48, start=0, end=360):
    t = np.deg2rad(np.linspace(start, end, n))
    r = np.deg2rad(rot)
    x, y = a * np.cos(t), b * np.sin(t)
    return np.stack([cx + x * np.cos(r) - y * np.sin(r), cy + x * np.sin(r) + y * np.cos(r)], 1)


def probe_sketch(size_mm, deg):
    """New Horizons, sketched from above: the flat triangular body in perspective with its depth,
    the big dish standing on it (rim, inner ring, feed on struts), and the RTG on a boom off one
    corner, its cooling fins drawn as ticks."""
    s = mm(size_mm)
    img = np.zeros((s, s), np.uint8)
    u = s / 100
    A, B, C = (8 * u, 62 * u), (54 * u, 46 * u), (88 * u, 70 * u)
    d = 13 * u
    sketch_line(img, [A, B, C, A], wob=0.3)
    sketch_line(img, [A, (A[0], A[1] + d), (C[0], C[1] + d), C], wob=0.3)
    # The dish, facing up and out, hides the body behind it.
    hide = np.zeros_like(img)
    rim = ellipse_pts(46 * u, 36 * u, 27 * u, 17 * u, -14, n=140)
    cv2.fillPoly(hide, [rim.astype(np.int32)], 1)
    img[hide > 0] = 0
    sketch_line(img, rim, wob=0.25, passes=1)
    sketch_line(img, ellipse_pts(46 * u, 36 * u, 20 * u, 12 * u, -14, n=120), wob=0.2, passes=1)
    feed = (44 * u, 22 * u)
    for a in (0, 120, 240):
        p = ellipse_pts(46 * u, 36 * u, 20 * u, 12 * u, -14, n=2, start=a + 30, end=a + 30)[0]
        sketch_line(img, [tuple(p), feed], wob=0.12, passes=1)
    cv2.circle(img, (int(feed[0]), int(feed[1])), max(LINE, int(2.2 * u)), 1, -1)
    # The RTG on its boom.
    sketch_line(img, [(C[0] - 2 * u, C[1] + 4 * u), (95 * u, 86 * u)], wob=0.15, passes=1)
    sketch_line(img, [(89 * u, 90 * u), (97 * u, 81 * u), (99.5 * u - LINE, 85 * u), (92 * u, 94 * u), (89 * u, 90 * u)], wob=0.1, passes=1)
    cover = np.zeros_like(img)
    return rotate_piece(img, cover, deg)


def probe_traced(size_mm, deg):
    """The probe from a line drawing (P["probe_src"]): cropped to the drawing, scaled so its width is
    size_mm, thresholded, thinned to a skeleton and redrawn at an even line (probe_line_mm). It is cut
    out like a clipping: its silhouette, grown by cut_mm, hides what is under it, with a keyline round it."""
    from skimage.morphology import skeletonize
    g = cv2.imread(P["probe_src"], cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
    on = g < 0.55
    ys, xs = np.nonzero(on)
    g = g[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    w = mm(size_mm)
    h = round(w * g.shape[0] / g.shape[1])
    big = cv2.resize(g, (w * 2, h * 2), interpolation=cv2.INTER_LANCZOS4) < 0.55
    sk = skeletonize(big).astype(np.uint8)
    lw = mm(P.get("probe_line_mm", 0.6)) * 2
    lines = cv2.dilate(sk, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (lw | 1, lw | 1)))
    lines = (cv2.resize(lines.astype(np.float32), (w, h), interpolation=cv2.INTER_AREA) > 0.5).astype(np.uint8)
    pad = mm(P.get("cut_mm", 2.5)) + mm(2)
    lines = np.pad(lines, pad)
    from scipy import ndimage as ndi
    sil = ndi.binary_fill_holes(cv2.morphologyEx(lines, cv2.MORPH_CLOSE, np.ones((mm(1.5), mm(1.5)), np.uint8))).astype(np.uint8)
    k = mm(P.get("cut_mm", 2.5)) * 2 + 1
    cover = cv2.dilate(sil, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    edge = cover - cv2.erode(cover, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * LINE + 1, 2 * LINE + 1)))
    layer = lines | (edge if P.get("cut_keyline", True) else 0)
    return rotate_piece(layer, cover, deg)


def star(size_mm):
    s = mm(size_mm)
    pad = mm(2)
    img = np.zeros((s + 2 * pad, s + 2 * pad), np.uint8)
    c = s / 2 + pad
    a0 = rng.uniform(0, 72)
    pts = [(c + s / 2 * math.cos(math.radians(a0 + k * 144)), c + s / 2 * math.sin(math.radians(a0 + k * 144))) for k in range(6)]
    sketch_line(img, pts, wob=0.4)
    return img


def dotted_path(pts_mm, dash_mm=1.2, gap_mm=2.4):
    pts = np.array([(mm(x), mm(y)) for x, y in pts_mm], np.float32)
    # Catmull-Rom through the points, then dots along it.
    curve = []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = pts[max(0, i - 1)], pts[i], pts[i + 1], pts[min(len(pts) - 1, i + 2)]
        for t in np.linspace(0, 1, 60, endpoint=False):
            curve.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    curve = np.array(curve)
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(curve, axis=0).T))]
    for d in np.arange(0, seg[-1], mm(dash_mm + gap_mm)):
        i = int(np.searchsorted(seg, d))
        cv2.circle(ink, tuple(curve[min(i, len(curve) - 1)].astype(int)), mm(dash_mm) // 2, 1, -1)


# ---- composition ----
lay = P["layout"]
# The photo goes down first, so the letters can sit over its edge like a pasted-up flyer.
ph, pc = pluto_piece()
ph, pc = rotate_piece(ph, pc, lay["photo_rot"])
px, py = mm(lay["photo_x"]), mm(lay["photo_y"])
paste(ph, pc, px, py)
for t in lay["tapes"]:
    tl, tc = tape_piece(t["len"], t["wid"], t["rot"])
    paste(tl, tc, mm(t["x"]), mm(t["y"]))

for st in lay["stars"]:
    s = star(st["size"])
    paste(s, np.zeros_like(s), mm(st["x"]), mm(st["y"]))
dotted_path(lay["path"])
if P.get("probe_src"):
    pl, pcov = probe_traced(lay["probe_size"], lay["probe_rot"])
else:
    SKETCH_W[0] = mm(P.get("probe_line_mm", 0.6))
    pl, pcov = probe_sketch(lay["probe_size"], lay["probe_rot"])
    SKETCH_W[0] = LINE
paste(pl, pcov, mm(lay["probe_x"]), mm(lay["probe_y"]))

if lay.get("arrow"):
    (x1, y1), (x2, y2) = lay["path"][-2], lay["path"][-1]
    a = math.atan2(y2 - y1, x2 - x1)
    tip = np.array([mm(x2), mm(y2)], float)
    for da in (2.6, -2.6):
        end = tip + mm(4) * np.array([math.cos(a + da), math.sin(a + da)])
        cv2.line(ink, tuple(tip.astype(int)), tuple(end.astype(int)), 1, LINE)

lab = lay.get("label")
if lab:
    font = ImageFont.truetype(os.path.join(FONTS, lab["font"]), mm(lab["cap_mm"] / 0.7))
    bbs = [font.getbbox(t) for t in lab["lines"]]
    lh = mm(lab["cap_mm"] * 1.7)
    tw = max(b[2] - b[0] for b in bbs)
    pad = mm(2.5)
    w, h = tw + 2 * pad, lh * len(lab["lines"]) + 2 * pad - mm(lab["cap_mm"] * 0.5)
    m = mm(3)
    im = Image.new("L", (w + 2 * m, h + 2 * m), 0)
    d = ImageDraw.Draw(im)
    for k, (t, b) in enumerate(zip(lab["lines"], bbs)):
        d.text((m + pad - b[0], m + pad + k * lh - font.getbbox("H")[1]), t, font=font, fill=255)
    g = (np.array(im) > 127).astype(np.uint8)
    poly = (torn(w, h, amp=0.6, step=1.5) + m).astype(np.int32)
    cov = np.zeros_like(g)
    cv2.fillPoly(cov, [poly], 1)
    cv2.polylines(g, [poly], True, 1, LINE)
    cov = cv2.dilate(cov, np.ones((LINE, LINE), np.uint8))
    g, cov = rotate_piece(g, cov, lab["rot"])
    paste(g, cov, mm(lab["x"]), mm(lab["y"]))

for ln in P["lines"]:
    pieces, gap = line_of(ln["word"], ln["letters"], ln["width"])
    place_line(pieces, gap, ln["x"], ln["top"], ln.get("jitter", 2.5))

# Clean specks under 0.5 mm (not the screen's own dots: those are kept, they are the photocopy).
n, lab, stats, _ = cv2.connectedComponentsWithStats(ink)
tiny = math.pi * (0.45 * PX / 2) ** 2  # a dot cut by a scrap's edge, smaller than the smallest dot
kill = np.zeros(n, bool)
kill[1:] = stats[1:, cv2.CC_STAT_AREA] < tiny
ink[kill[lab]] = 0

rgba = np.zeros((H, W, 4), np.uint8)
rgba[..., :3] = 255
rgba[..., 3] = ink * 255
slug = P["slug"]
Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, f"{slug}-black.png"), optimize=True, dpi=(300, 300))
small = cv2.resize(ink.astype(np.float32), (1500, round(1500 * H / W)), interpolation=cv2.INTER_AREA)
Image.fromarray((small * 255).astype(np.uint8), "L").save(os.path.join(OUT, f"{slug}-preview.png"))
np.save(os.path.join(OUT, "ink.npy"), ink)
ys, xs = np.nonzero(ink)
print(json.dumps({"coverage": round(float(ink.mean()), 4), "sizeCm": [round((xs.max() - xs.min() + 1) / PX / 10, 1), round((ys.max() - ys.min() + 1) / PX / 10, 1)]}))
