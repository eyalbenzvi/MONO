"""
The print fonts beside DejaVu Sans Mono (scripts/tools/buildFonts.py): a text
serif (Libre Caslon Text, Regular and Bold), a condensed sans (Oswald, Regular
and Bold) and a blackletter for mastheads (UnifrakturMaguntia), all under the
SIL Open Font License 1.1. Each is cut to the characters a print can hold (the
words' rule: Latin letters, digits and the WORDS marks, and the few symbols
the templates set) and written three ways:

- public/fonts/<file>.woff2: the live preview registers them (lib/custom/canvasSvg);
- assets/fonts/<file>.ttf: resvg reads them in the gate, the audit and the bakers
  (scripts/gen/fonts.ts), so a print is measured in the glyphs it shows;
- lib/custom/fontWidths.json: each face's advance widths (thousandths of an em),
  so a template measures its text without a DOM (lib/custom/kit textWidth).

Run by hand with the sources downloaded (Google Fonts' static instances; pip
install fonttools brotli):

  python scripts/tools/buildPrintFonts.py <folder with the .ttf sources>
"""
import json, os, sys, urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OFL = {
    "librecaslontext": "https://raw.githubusercontent.com/google/fonts/main/ofl/librecaslontext/OFL.txt",
    "oswald": "https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/OFL.txt",
    "unifrakturmaguntia": "https://raw.githubusercontent.com/google/fonts/main/ofl/unifrakturmaguntia/OFL.txt",
}
# (source, output name, family key, weight, licence key)
FACES = [
    ("LibreCaslonText-Regular.ttf", "libre-caslon-text", "serif", "regular", "librecaslontext"),
    ("LibreCaslonText-Bold.ttf", "libre-caslon-text-bold", "serif", "bold", "librecaslontext"),
    ("Oswald-Regular.ttf", "oswald", "condensed", "regular", "oswald"),
    ("Oswald-Bold.ttf", "oswald-bold", "condensed", "bold", "oswald"),
    ("UnifrakturMaguntia-Book.ttf", "unifraktur-maguntia", "blackletter", "regular", "unifrakturmaguntia"),
]

# Printable ASCII, Latin-1 and Latin Extended-A (the words' rule is the Latin script), and the templates' symbols.
chars = set(chr(c) for c in range(0x20, 0x7F)) | set(chr(c) for c in range(0xA0, 0x180)) | set("‘’“”–—…·•№×°′″→←↑↓★")
text = "".join(sorted(chars))
widths = {}
for src, name, family, weight, lic in FACES:
    opts = subset.Options()
    opts.flavor = None
    opts.layout_features = ["kern"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    font = subset.load_font(os.path.join(SRC, src), opts)
    s = subset.Subsetter(opts)
    s.populate(text=text)
    s.subset(font)
    subset.save_font(font, os.path.join(ROOT, "assets", "fonts", f"{name}.ttf"), opts)
    opts.flavor = "woff2"
    subset.save_font(font, os.path.join(ROOT, "public", "fonts", f"{name}.woff2"), opts)
    f = TTFont(os.path.join(ROOT, "assets", "fonts", f"{name}.ttf"))
    cmap, hmtx, upm = f.getBestCmap(), f["hmtx"], f["head"].unitsPerEm
    adv = {ch: round(hmtx[cmap[ord(ch)]][0] * 1000 / upm) for ch in text if ord(ch) in cmap}
    widths.setdefault(family, {})[weight] = adv
    print(name, os.path.getsize(os.path.join(ROOT, "public", "fonts", f"{name}.woff2")), "bytes,", len(adv), "glyphs")
for key, url in OFL.items():
    data = urllib.request.urlopen(url).read()
    for folder in ("public/fonts", "assets/fonts"):
        open(os.path.join(ROOT, folder, f"LICENSE-{key}.txt"), "wb").write(data)
json.dump(widths, open(os.path.join(ROOT, "lib", "custom", "fontWidths.json"), "w"), separators=(",", ":"), ensure_ascii=False)
print(len(text), "characters")
