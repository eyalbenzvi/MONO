"""
vineyard: the owner's image (Google Gemini, 1024 x 1536; sources/gemini-vineyard.png, the JPEG it came as decoded losslessly) made print-ready, then one ink.

  python data/studio/ready1/03-1-vineyard/sources/build.py   (from the repo root)

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
SLUG = "vineyard"


def fixes(im):
    """Retouches at the original's 1024 x 1536 scale."""
    d = ImageDraw.Draw(im)
    for f in P.get("fixes", []):
        if f["op"] == "white":
            d.rectangle(f["box"], fill=255)
        elif f["op"] == "line":
            d.rectangle(f["box"], fill=0)
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


def despeck(im, min_area, protect=(), protect_area=12):
    """The picture made two-tone at the 3x scale (binarize: line work whose grey edges would crumble in
    oneink's threshold), then dark specks under min_area px go: grain the screen can't hold. Inside the
    protect boxes (the original's scale: lettering) only crumbs under protect_area go, so the i's dots,
    the commas and the full stops (30 px and up at this scale) stay."""
    a = np.asarray(im).copy()
    if P.get("binarize"):
        a = np.where(a < P["binarize"], 0, 255).astype(np.uint8)
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
        a[ndimage.binary_dilation(grow, iterations=3)] = 0
    return Image.fromarray(a)


def oneink_module():
    import importlib.util
    spec = importlib.util.spec_from_file_location("oneink", ROOT / "scripts/studio/oneink.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def set_captions(out, slug):
    """Type set by MONO in place of the picture's own lettering (halftone mode keeps only the subject, so the
    names would go): each caption in Libre Caslon Text Italic (SIL OFL 1.1), its size and centre mapped from
    where the original had it, then the print checked again with oneink's own measures."""
    from PIL import ImageFont
    oi = oneink_module()
    ink_file = out / f"{slug}-white.png"
    ink = (np.asarray(Image.open(ink_file).getchannel("A")) > 127).astype(np.uint8)
    title = P["oneink"][P["oneink"].index("--title") + 1] if "--title" in P["oneink"] else None
    head_rows = oi.TOP + oi.heading(title, None).shape[0] if title else None
    # The picture's extent in the original (captions left out) and in the print (under the heading).
    src = np.asarray(Image.open(HERE / "gemini-vineyard.png").convert("L")) < 128
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
    font_file = str(ROOT / "assets/fonts/libre-caslon-text-italic.ttf")
    for c in P["captions"]:
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


def main():
    im = Image.open(HERE / "gemini-vineyard.png").convert("L")
    im = fixes(im)
    im = im.resize((im.width * 3, im.height * 3), Image.LANCZOS).filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.UnsharpMask(2, 60, 2))
    if P.get("despeck"):
        im = despeck(im, P["despeck"], P.get("protect", ()))
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
    if P.get("captions"):
        set_captions(out, SLUG)
        m = json.loads(pj.read_text())
        m.update(P.get("print", {}))
        pj.write_text(json.dumps(m, indent=1) + "\n")


if __name__ == "__main__":
    main()
