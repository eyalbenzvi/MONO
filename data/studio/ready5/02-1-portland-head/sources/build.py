"""
The owner's image (a generative tool's; sources/<model>-<slug>.png, the JPEG it came as decoded
losslessly) made print-ready, then one ink. The slug is the folder's name after its number (ready1's build,
with the caption font per caption).

  python data/studio/ready2/<folder>/sources/build.py   (from the repo root)

1. greyscale, 3x Lanczos up to 3072 x 4608, a median against JPEG noise (after the upscale: at the original's
   scale a median erases the i's dots and the full stops), a mild unsharp mask;
2. params.json's fixes, at the original's scale, then (despeck) small specks removed at the 3x scale;
3. scripts/studio/oneink.py with params.json's arguments into this design's folder, and params.json's
   print (tees, features) merged into the print.json it writes; (captions) type set in place of the
   picture's own lettering, and the print checked again.
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
P = json.loads((HERE / "params.json").read_text())
SLUG = HERE.parent.name.split("-", 2)[2]
SRC = next(HERE.glob(f"*-{SLUG}.png"))  # sources/<model>-<slug>.png (gemini-, gpt-, …)


def fixes(im):
    """Retouches at the original's 1024 x 1536 scale."""
    d = ImageDraw.Draw(im)
    for f in P.get("fixes", []):
        if f["op"] == "white":
            d.rectangle(f["box"], fill=255)
        elif f["op"] == "disc":
            # Inside a drawn ring (a badge): cleared to the paper, the ring kept.
            (cx, cy), r = f["c"], f["r"]
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
        elif f["op"] == "ring":
            # A badge's ring drawn again where a cleared mark crossed it.
            (cx, cy), r = f["c"], f["r"]
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=f.get("ink", 70), width=f.get("w", 2))
        elif f["op"] == "thicken":
            # Hairlines (kite lines, rigging) a pixel wide at the original's scale break in the conversion:
            # inside `box`, a minimum filter of `size` px makes them hold.
            x0, y0, x1, y1 = f["box"]
            part = im.crop((x0, y0, x1, y1)).filter(ImageFilter.MinFilter(f.get("size", 3)))
            if f.get("ink"):
                # ... and their grey made full ink (a hairline's grey reads to engrave as flat tone, left as tee).
                part = part.point(lambda v: 0 if v < f["ink"] else v)
            im.paste(part, (x0, y0))
            d = ImageDraw.Draw(im)
        elif f["op"] == "move":
            # A block (a caption) moved by dx, dy, its old place left as paper.
            x0, y0, x1, y1 = f["box"]
            block = im.crop((x0, y0, x1, y1))
            d.rectangle([x0, y0, x1, y1], fill=255)
            im.paste(block, (x0 + f.get("dx", 0), y0 + f.get("dy", 0)))
            d = ImageDraw.Draw(im)
        elif f["op"] == "erase":
            # Lettering taken out without a cut: only the marks lying wholly inside `box` go (the glyphs and
            # a rule), so the drawing and a frame that run through the box stay whole.
            a = np.asarray(im).copy()
            x0, y0, x1, y1 = f["box"]
            lab, n = ndimage.label(a < f.get("level", 170))
            for i, sl in enumerate(ndimage.find_objects(lab), 1):
                if sl and sl[0].start >= y0 and sl[0].stop <= y1 and sl[1].start >= x0 and sl[1].stop <= x1:
                    a[sl][lab[sl] == i] = 255
            im = Image.fromarray(a)
            d = ImageDraw.Draw(im)
        elif f["op"] == "line":
            d.rectangle(f["box"], fill=0)
        elif f["op"] == "swap":
            # Lettering corrected with the picture's own glyphs: the ink of `src` (a word or digits elsewhere in
            # the picture, same face and size) replaces the ink of `dst`, aligned on its left (or right) and baseline.
            a = np.asarray(im).copy()
            sx0, sy0, sx1, sy1 = f["src"]
            dx0, dy0, dx1, dy1 = f["dst"]
            sb, db = ink_box(a, f["src"]), ink_box(a, f["dst"])
            glyphs = a[sb[1] : sb[3], sb[0] : sb[2]].copy()
            if f.get("scale"):
                # A glyph borrowed from smaller lettering in the same face, brought to the size it replaces.
                g = Image.fromarray(glyphs)
                glyphs = np.asarray(g.resize((round(g.width * f["scale"]), round(g.height * f["scale"])), Image.LANCZOS))
            a[dy0:dy1, dx0:dx1] = 255
            h, w = glyphs.shape
            x = db[2] - w if f.get("align") == "right" else (db[0] + db[2] - w) // 2 if f.get("align") == "center" else db[0]
            y = db[3] - h
            a[y : y + h, x : x + w] = np.minimum(a[y : y + h, x : x + w], glyphs)
            im = Image.fromarray(a)
            d = ImageDraw.Draw(im)
        elif f["op"] == "text":
            # Lettering set by MONO where the picture has no glyph to borrow: `box` cleared, the text set in `font`
            # (assets/fonts) with capitals `h` px tall, its left (right, centre) at x and its baseline at y;
            # rotate 90 reads bottom to top (a vertical dimension).
            from PIL import ImageFont
            if f.get("like"):
                # Measured from the lettering it replaces: its capitals' height, its baseline, its left/right/centre.
                lx0, ly0, lx1, ly1 = ink_box(np.asarray(im), f["like"])
                f = {"h": ly1 - ly0, "y": ly1, "x": {"right": lx1, "center": (lx0 + lx1) // 2}.get(f.get("align"), lx0), "box": f["like"], **f}
            if f.get("box"):
                d.rectangle(f["box"], fill=255)
            font_file = str(ROOT / "assets/fonts" / f["font"])
            size = 6
            while ImageFont.truetype(font_file, size + 1).getbbox("H")[3] - ImageFont.truetype(font_file, size + 1).getbbox("H")[1] <= f["h"]:
                size += 1
            fnt = ImageFont.truetype(font_file, size)
            l, t, r, b = fnt.getbbox(f["text"])
            top = fnt.getbbox("H")[1]
            base = fnt.getbbox("H")[3]
            g = Image.new("L", (r - l + 4, b - top + 6), 255)
            ImageDraw.Draw(g).text((2 - l, 2 - top), f["text"], font=fnt, fill=0)
            if f.get("rotate") == 90:
                g = g.rotate(90, expand=True, fillcolor=255)
                x, y = f["x"] - g.width // 2, f["y"] - g.height // 2  # (x, y) its centre
            else:
                bx = {"right": f["x"] - g.width + 2, "center": f["x"] - g.width // 2}.get(f.get("align"), f["x"] - 2)
                x, y = bx, f["y"] - (base - top) - 2
            a = np.asarray(im).copy()
            gg = np.asarray(g)
            a[y : y + gg.shape[0], x : x + gg.shape[1]] = np.minimum(a[y : y + gg.shape[0], x : x + gg.shape[1]], gg)
            im = Image.fromarray(a)
            d = ImageDraw.Draw(im)
        elif f["op"] == "lift":
            # Midtones and shadows held back by `amount` (0.18: 18% less ink in the greys), the blacks kept
            # where they carry the drawing (under `keep`), the paper kept white.
            a = np.asarray(im, dtype=float) / 255.0
            ink = 1 - a
            mid = ink < f.get("keep", 0.85)
            ink = np.where(mid, ink * (1 - f["amount"]), ink)
            im = Image.fromarray(((1 - ink) * 255).clip(0, 255).astype(np.uint8))
            d = ImageDraw.Draw(im)
        elif f["op"] == "fade":
            # A scene cut by straight sides: rows y0..y1 fade to the paper over `width` px from each side,
            # the fade's start jittered row by row (a fixed seed) so the side reads drawn, not cut.
            a = np.asarray(im, dtype=float)
            x0, x1, y0, y1, w = f["x0"], f["x1"], f["y0"], f["y1"], f["width"]
            rng = np.random.default_rng(f.get("seed", 1))
            jit = ndimage.gaussian_filter1d(rng.normal(0, 1, y1 - y0), 6) * f.get("jitter", 0.35) * w
            xs = np.arange(a.shape[1], dtype=float)
            for i, y in enumerate(range(y0, y1)):
                ww = max(8.0, w + jit[i])
                t = np.clip(np.minimum(xs - x0, x1 - xs) / ww, 0, 1)
                a[y] = 255 - (255 - a[y]) * t
            im = Image.fromarray(a.clip(0, 255).astype(np.uint8))
            d = ImageDraw.Draw(im)
    return im


def ink_box(a, box, level=150):
    """The ink's bounding box inside `box` (x0, y0, x1, y1), as x0, y0, x1, y1 (exclusive)."""
    x0, y0, x1, y1 = box
    ys, xs = np.nonzero(a[y0:y1, x0:x1] < level)
    return x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1


def text_boxes(grey, pad=4):
    """The picture's lettering at the original's scale, found by its shape: glyph-sized pieces (5-34 px tall,
    not long strokes) merged sideways into lines; a line of three or more glyphs of like height, wider than
    tall, standing on paper (a texture inside the drawing is not lettering), is a box. The despeck keeps the
    i-dots and full stops inside these."""
    import cv2
    a = np.asarray(grey)
    ink = (a < 150).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    glyph = np.zeros_like(ink)
    for i in range(1, n):
        x, y, w, h, area = st[i]
        if 5 <= h <= 34 and w <= 40 and area >= 6 and area / (w * h) < 0.75 or (h <= 5 and w <= 5 and area >= 4):
            glyph[lab == i] = 1
    boxes = []
    # Two merges: set solid (13 px) and letter-spaced ("A N T A R C T I C A", 41 px).
    for kw in (13, 41):
        boxes += _line_boxes(a, ink, glyph, kw, pad)
    return boxes


def _line_boxes(a, ink, glyph, kw, pad):
    import cv2
    merged = cv2.dilate(glyph, cv2.getStructuringElement(cv2.MORPH_RECT, (kw, 3)))
    m, lab2, st2, _ = cv2.connectedComponentsWithStats(merged)
    boxes = []
    for j in range(1, m):
        x, y, w, h, _ = st2[j]
        sub = glyph[y : y + h, x : x + w] & (lab2[y : y + h, x : x + w] == j)
        k, _, s3, _ = cv2.connectedComponentsWithStats(sub)
        hs = s3[1:, 3][s3[1:, 3] >= 6]
        if k - 1 >= 3 and len(hs) >= 2 and w > 1.6 * h and h <= 48 and np.std(hs) < 0.45 * np.mean(hs) and sub.sum() / (w * h) < 0.45:
            X0, Y0, X1, Y1 = max(0, x - 8), max(0, y - 8), min(a.shape[1], x + w + 8), min(a.shape[0], y + h + 8)
            ring = ink[Y0:Y1, X0:X1].sum() - ink[y : y + h, x : x + w].sum()
            if ring / max(1, (X1 - X0) * (Y1 - Y0) - w * h) > 0.10:
                continue
            boxes.append([int(max(0, x - pad)), int(max(0, y - pad)), int(min(a.shape[1], x + w + pad)), int(min(a.shape[0], y + h + pad))])
    return boxes


def despeck(im, min_area, protect=(), protect_area=12):
    """The picture made two-tone at the 3x scale (binarize: line work whose grey edges would crumble in
    oneink's threshold), then dark specks under min_area px go: grain the screen can't hold. Inside the
    protect boxes (the original's scale: lettering) only crumbs under protect_area go, so the i's dots,
    the commas and the full stops (30 px and up at this scale) stay."""
    a = np.asarray(im).copy()
    if P.get("binarize"):
        dark = a < P["binarize"]
        # Inside the lettering a lighter cut, so a full stop's grey dot holds (it is grown below).
        for x0, y0, x1, y1 in protect:
            box = (slice(y0 * 3, y1 * 3), slice(x0 * 3, x1 * 3))
            dark[box] = a[box] < P.get("binarize_text", 200)
        a = np.where(dark, 0, 255).astype(np.uint8)
    lab, n = ndimage.label(a < 128)
    if n:
        area = ndimage.sum(np.ones_like(a), lab, index=np.arange(1, n + 1))
        small = np.isin(lab, np.where(area < min_area)[0] + 1)
        tiny = np.isin(lab, np.where(area < protect_area)[0] + 1)
        # The lettering's dots that would print under 0.5 mm (the press check's speck) are grown to hold.
        dot = np.isin(lab, np.where((area >= protect_area) & (area < 130))[0] + 1)
        grow = np.zeros_like(small)
        for x0, y0, x1, y1 in protect:
            box = (slice(y0 * 3, y1 * 3), slice(x0 * 3, x1 * 3))
            small[box] = tiny[box]
            grow[box] = dot[box]
        a[small] = 255
        a[ndimage.binary_dilation(grow, iterations=P.get("dot_grow", 3))] = 0
    return Image.fromarray(a)


def oneink_module():
    import importlib.util
    spec = importlib.util.spec_from_file_location("oneink", ROOT / "scripts/studio/oneink.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def set_captions(out, slug):
    """Type set by MONO in place of the picture's own lettering (halftone mode keeps only the subject, so the
    names would go): each caption in its font (Libre Caslon Text Italic, SIL OFL 1.1, unless params.json names
    another from assets/fonts), its size and centre mapped from
    where the original had it, then the print checked again with oneink's own measures."""
    from PIL import ImageFont
    oi = oneink_module()
    ink_file = out / f"{slug}-white.png"
    ink = (np.asarray(Image.open(ink_file).getchannel("A")) > 127).astype(np.uint8)
    title = P["oneink"][P["oneink"].index("--title") + 1] if "--title" in P["oneink"] else None
    head_rows = oi.TOP + oi.heading(title, None).shape[0] if title else None
    # The picture's extent in the original (captions left out) and in the print (under the heading).
    src = np.asarray(Image.open(SRC).convert("L")) < 128
    for c in P["captions"]:
        x0, y0, x1, y1 = c["box"]
        src[y0 : y1 + 1, x0 : x1 + 1] = False
    sy, sx = np.nonzero(src)
    art = ink.copy()
    if head_rows:
        art[: head_rows + round(oi.PX_MM)] = 0
    oy, ox = np.nonzero(art)
    s = (oy.max() - oy.min()) / (sy.max() - sy.min())
    cx_s, cy_s = (sx.min() + sx.max()) / 2, (sy.min() + sy.max()) / 2
    cx_o, cy_o = (ox.min() + ox.max()) / 2, (oy.min() + oy.max()) / 2
    fonts = {"italic": "libre-caslon-text-italic.ttf", **P.get("fonts", {})}
    for c in P["captions"]:
        font_file = str(ROOT / "assets/fonts" / fonts[c.get("font", "italic")])
        x0, y0, x1, y1 = c["box"]
        h = (y1 - y0) * s
        size = 10
        while True:
            f = ImageFont.truetype(font_file, size + 1)
            l, t, r, b = f.getbbox(c["text"])
            if b - t > h:
                break
            size += 1
        f = ImageFont.truetype(font_file, size)
        l, t, r, b = f.getbbox(c["text"])
        img = Image.new("L", (r - l + 4, b - t + 4), 0)
        ImageDraw.Draw(img).text((2 - l, 2 - t), c["text"], font=f, fill=255)
        g = (np.asarray(img) > 127).astype(np.uint8)
        px = round(cx_o + ((x0 + x1) / 2 - cx_s) * s - g.shape[1] / 2)
        py = round(cy_o + ((y0 + y1) / 2 - cy_s) * s - g.shape[0] / 2)
        ink[py : py + g.shape[0], px : px + g.shape[1]] |= g
    oi.save_ink(ink, (0, 0, 0), str(ink_file))
    pj = json.loads((out / "print.json").read_text())
    rep = oi.check(ink, {"mode": pj["mode"], "edge": pj["edge"], "title": title, "sub": None, "views": pj["views"],
                         "outline": pj["outline"], "headRows": head_rows})
    (out / f"{slug}-check.json").write_text(json.dumps({"white": rep}, indent=1, ensure_ascii=False))
    oi.preview(ink, str(out / f"{slug}-preview.png"), on_white=True)
    for k in ("coverage", "solid", "screened", "sizeCm", "crisp", "fails", "warns"):
        pj[k] = rep[k]
    (out / "print.json").write_text(json.dumps(pj, indent=1, ensure_ascii=False))
    print(slug, "captions set;", json.dumps({k: rep[k] for k in ("coverage", "sizeCm", "fails")}))


def recheck(out, slug, ink, title):
    """The delivered ink saved again and checked with oneink's own measures (its preview and print.json updated)."""
    oi = oneink_module()
    pj = json.loads((out / "print.json").read_text())
    tonal = (out / f"{slug}-white.png").exists()
    ink_file = out / (f"{slug}-white.png" if tonal else f"{slug}.png")
    head_rows = oi.TOP + oi.heading(title, None).shape[0] if title else None
    # The screen's share is measured by the conversion (a module global oneink sets as it inks), not by check():
    # carried over from the conversion's print.json, or the screen gate would read 0 here.
    oi.SCREENED = pj.get("screened", 0.0)
    oi.save_ink(ink, (0, 0, 0), str(ink_file))
    rep = oi.check(ink, {"mode": pj["mode"], "edge": pj["edge"], "title": title, "sub": None, "views": pj["views"],
                         "outline": pj["outline"], "headRows": head_rows})
    (out / f"{slug}-check.json").write_text(json.dumps({"white" if tonal else "line": rep}, indent=1, ensure_ascii=False))
    oi.preview(ink, str(out / f"{slug}-preview.png"), on_white=tonal)
    for k in ("coverage", "solid", "screened", "sizeCm", "crisp", "fails", "warns"):
        if k in rep:
            pj[k] = rep[k]
    (out / "print.json").write_text(json.dumps(pj, indent=1, ensure_ascii=False))
    print(slug, "rechecked;", json.dumps({k: rep.get(k) for k in ("coverage", "sizeCm", "fails")}))


def final_despeck(out, slug):
    """Pieces under the check's 0.5 mm that oneink's threshold left (crumbs off the hatching) taken out of the
    delivered print. The lettering's dots were grown to hold before (despeck's protect boxes), so none of them
    is among these."""
    import cv2
    oi = oneink_module()
    tonal = (out / f"{slug}-white.png").exists()
    ink_file = out / (f"{slug}-white.png" if tonal else f"{slug}.png")
    ink = (np.asarray(Image.open(ink_file).getchannel("A")) > 127).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink)
    small = np.where(st[:, cv2.CC_STAT_AREA] < (0.5 * oi.PX_MM) ** 2 * 1.5)[0]
    ink[np.isin(lab, small[small > 0])] = 0
    title = P["oneink"][P["oneink"].index("--title") + 1] if "--title" in P["oneink"] else None
    recheck(out, slug, ink, title)


def main():
    im = Image.open(SRC).convert("L")
    im = fixes(im)
    # "protect": "auto" finds the lettering (after the fixes, so set type is kept too); a list is boxes as given.
    protect = text_boxes(im) + P.get("protect_extra", []) if P.get("protect") == "auto" else P.get("protect", ())
    # Regions where a texture in the drawing reads to the finder as lettering (a bubble field): no box there.
    for ex0, ey0, ex1, ey1 in P.get("protect_exclude", []):
        protect = [b for b in protect if b[2] <= ex0 or b[0] >= ex1 or b[3] <= ey0 or b[1] >= ey1]
    im = im.resize((im.width * 3, im.height * 3), Image.LANCZOS).filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.UnsharpMask(2, 60, 2))
    if P.get("despeck"):
        im = despeck(im, P["despeck"], protect)
    fixed = HERE / "fixed.png"
    im.save(fixed)

    out = HERE.parent
    # Outputs of an earlier mode go first (a halftone delivers <slug>-white.png; a stale <slug>.png would read as line art).
    for stale in (f"{SLUG}.png", f"{SLUG}-white.png", f"{SLUG}-black.png"):
        (out / stale).unlink(missing_ok=True)
    subprocess.run([sys.executable, str(ROOT / "scripts/studio/oneink.py"), str(fixed), str(out), SLUG, *P["oneink"]], check=True)
    # The tees and features decided for the panel (params.json "print"), merged into oneink's measures.
    pj = out / "print.json"
    m = json.loads(pj.read_text())
    m.update(P.get("print", {}))
    pj.write_text(json.dumps(m, indent=1) + "\n")
    if P.get("final_despeck"):
        final_despeck(out, SLUG)
        m = json.loads(pj.read_text())
        m.update(P.get("print", {}))
        pj.write_text(json.dumps(m, indent=1) + "\n")
    if P.get("captions"):
        set_captions(out, SLUG)
        m = json.loads(pj.read_text())
        m.update(P.get("print", {}))
        pj.write_text(json.dumps(m, indent=1) + "\n")


if __name__ == "__main__":
    main()
    # The intermediates go (publish.ts takes the first .png in sources/: it must be the source).
    for tmp in ("fixed.png", "retouched.png"):
        (HERE / tmp).unlink(missing_ok=True)
