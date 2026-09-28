"""
The personalised prints' font: DejaVu Sans Mono (the face every computed
print is set in, scripts/images/bake.ts FONT_OPTS), Regular and Bold, cut to
the characters a caption can hold, as WOFF2 in public/fonts. The browser
embeds it in the print's SVG (an SVG drawn through <img> can't load a web
font). Run by hand after the place list changes (pip install fonttools brotli):

  python scripts/tools/buildFonts.py

Characters: printable ASCII, the caption's own symbols (· ° … and friends),
and every character of every place name in data/cities, upper and lower case.
"""
import json, os, shutil
from fontTools import subset

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
SRC = "/usr/share/fonts/truetype/dejavu"
OUT = os.path.join(ROOT, "public", "fonts")
LICENSE = "/usr/share/doc/fonts-dejavu-core/copyright"

names = json.load(open(os.path.join(ROOT, "data", "cities", "cities.json")))["name"]
chars = set(chr(c) for c in range(0x20, 0x7F)) | set("·°…–—‘’“”")
for n in names:
    chars |= set(n) | set(n.upper()) | set(n.lower())
text = "".join(sorted(chars))
os.makedirs(OUT, exist_ok=True)
for src, dst in (("DejaVuSansMono.ttf", "dejavu-sans-mono.woff2"), ("DejaVuSansMono-Bold.ttf", "dejavu-sans-mono-bold.woff2")):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    font = subset.load_font(os.path.join(SRC, src), opts)
    s = subset.Subsetter(opts)
    s.populate(text=text)
    s.subset(font)
    subset.save_font(font, os.path.join(OUT, dst), opts)
    print(dst, os.path.getsize(os.path.join(OUT, dst)), "bytes")
shutil.copyfile(LICENSE, os.path.join(OUT, "LICENSE-dejavu.txt"))
print(len(text), "characters")
