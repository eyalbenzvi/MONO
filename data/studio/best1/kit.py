"""
The best1 run's shared kit: a design is composed as SVG in millimetres on the print area (280 x 370 mm),
rendered by resvg at 300 DPI (3307 x 4370) with the shop's fonts, thresholded to one ink, checked by
scripts/studio/oneink.py's own check, and written beside the build as <slug>.png and print.json.

Line art from an image model goes in as an <image>: its crop upscaled 3x (Lanczos), a light median against
JPEG noise, then thresholded to ink (line_art below), so the print keeps the drawing's own brush line.
"""
import base64, io, json, os, subprocess, sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
FONTS = ROOT / "assets" / "fonts"
W_MM, H_MM = 280, 370
PX_MM = 300 / 25.4
W, H = round(W_MM * PX_MM), round(H_MM * PX_MM)

sys.path.insert(0, str(ROOT / "scripts" / "studio"))
import oneink  # noqa: E402

RENDER_JS = """
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const [svgPath, outPath, fontDir] = process.argv.slice(1);
const fontFiles = fs.readdirSync(fontDir).filter(f => f.endsWith('.ttf')).map(f => fontDir + '/' + f);
const r = new Resvg(fs.readFileSync(svgPath, 'utf8'), { fitTo: { mode: 'width', value: %d }, font: { fontFiles, loadSystemFonts: false }, background: 'rgba(0,0,0,0)' });
fs.writeFileSync(outPath, r.render().asPng());
""" % W


def svg_doc(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W_MM}mm" height="{H_MM}mm" viewBox="0 0 {W_MM} {H_MM}">{body}</svg>'


def render(body, tmp):
    """The SVG body (ink drawn in black) as a 0/1 ink array at 300 DPI."""
    tmp = Path(tmp)
    tmp.mkdir(parents=True, exist_ok=True)
    (tmp / "design.svg").write_text(svg_doc(body))
    subprocess.run(["node", "-e", RENDER_JS, str(tmp / "design.svg"), str(tmp / "design.png"), str(FONTS)], check=True, cwd=ROOT)
    a = np.array(Image.open(tmp / "design.png").convert("RGBA"))
    assert a.shape[:2] == (H, W), a.shape
    return (a[..., 3] >= 128).astype(np.uint8)


def line_art(path, box, level=150, median=3, scale=3, grow=0, hollow=None, clip=None):
    """A crop (x0, y0, x1, y1 in the source's pixels) of a black-on-white drawing as a data URI of its ink
    (black on transparent), upscaled `scale` times; `grow` px (at the upscaled size) thickens the line.
    hollow (r, keep): solid patches wider than 2r px kept as their outline, `keep` px wide (a filled leg
    printed as a blot of white ink on black). clip (x0, y0, x1, y1, in the source's px): ink outside it dropped."""
    g = Image.open(path).convert("L").crop(tuple(box))
    g = g.resize((g.width * scale, g.height * scale), Image.LANCZOS)
    a = np.asarray(g)
    if median:
        a = cv2.medianBlur(a, median)
    ink = (a < level).astype(np.uint8)
    if hollow:
        r, keep = hollow
        solid = cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
        inner = cv2.erode(solid, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * keep + 1, 2 * keep + 1)))
        ink = ink & (1 - inner)
    if grow:
        ink = cv2.dilate(ink, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1)))
    if clip:
        cx0, cy0, cx1, cy1 = [(v - o) * scale for v, o in zip(clip, (box[0], box[1], box[0], box[1]))]
        keepm = np.zeros_like(ink)
        keepm[max(0, cy0):max(0, cy1), max(0, cx0):max(0, cx1)] = 1
        ink = ink & keepm
    rgba = np.zeros((*ink.shape, 4), np.uint8)
    rgba[..., 3] = ink * 255
    buf = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(), ink.shape[1], ink.shape[0]


def despeck(ink, mm=0.5):
    """Pieces under `mm` across (the check's specks) taken out."""
    n, lab, stats, _ = cv2.connectedComponentsWithStats(ink)
    kill = np.zeros(n, bool)
    kill[1:] = stats[1:, cv2.CC_STAT_AREA] < (mm * PX_MM) ** 2 * 1.5
    out = ink.copy()
    out[kill[lab]] = 0
    return out


def deliver(ink, folder, slug, tees, features, tee_default=None):
    """<slug>.png (ink as alpha), a preview on the tee it leads with, and print.json with the check."""
    folder = Path(folder)
    oneink.SCREENED = 0.0
    oneink.CRISP = None
    m = {"mode": "line", "edge": None, "views": 1, "outline": False, "ground": False}
    m.update(oneink.check(ink, {"mode": "line"}))
    m["tees"] = tees
    if tee_default:
        m["teeDefault"] = tee_default
    m["features"] = features
    rgba = np.zeros((*ink.shape, 4), np.uint8)
    rgba[..., 3] = ink * 255
    Image.fromarray(rgba, "RGBA").save(folder / f"{slug}.png", optimize=True, dpi=(300, 300))
    lead = tee_default or tees
    small = cv2.resize(ink.astype(np.float32), (1500, round(1500 * H / W)), interpolation=cv2.INTER_AREA)
    Image.fromarray(((small if lead == "black" else 1 - small) * 255).astype(np.uint8), "L").save(folder / f"{slug}-preview.png")
    (folder / "print.json").write_text(json.dumps(m, indent=1) + "\n")
    print(json.dumps({k: m[k] for k in ("coverage", "thin", "sizeCm", "topMm", "solid", "fails", "warns")}))
    return m


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
