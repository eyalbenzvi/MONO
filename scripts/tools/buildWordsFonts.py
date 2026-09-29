"""
The types "Your words" is set in (From yours, lib/upload/words FACES): six
faces, each one WOFF2 in public/fonts/words cut to the characters the words
field takes (lib/upload/words PRINTABLE), its licence beside it, and
names.svg, each face's label drawn in that face as outlines (so the type
picker shows them without loading a font). Every face was measured through
the print checks at Full and Small on both tees before it was chosen (strokes
and gaps above the floors); a face that can't set the whole character set
fails the build. Run by hand when the faces or the characters change
(pip install fonttools brotli; the sources come from google/fonts at a pinned
commit, DejaVu from the system as for buildFonts.py):

  python scripts/tools/buildWordsFonts.py
"""
import os, shutil, tempfile, urllib.parse, urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "public", "fonts", "words")
GF = "https://raw.githubusercontent.com/google/fonts/23e54b51ddffbc7713c583748e3bd86f62b1fa4a/"
DEJAVU = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
DEJAVU_LICENSE = "/usr/share/doc/fonts-dejavu-core/copyright"

# id, label, source (google/fonts path or the system file), variable axes to pin, licence, OpenType features kept, output file.
FACES = [
    ("mono", "Mono", DEJAVU, None, DEJAVU_LICENSE, ["kern"], "dejavu-sans-mono-bold.woff2"),
    ("grotesk", "Grotesk", "ofl/inter/Inter[opsz,wght].ttf", {"wght": 800, "opsz": 32}, "ofl/inter/OFL.txt", ["kern", "liga"], "inter-extrabold.woff2"),
    ("condensed", "Condensed", "ofl/anton/Anton-Regular.ttf", None, "ofl/anton/OFL.txt", ["kern", "liga"], "anton.woff2"),
    ("serif", "Serif", "ofl/fraunces/Fraunces[SOFT,WONK,opsz,wght].ttf", {"wght": 900, "opsz": 72, "SOFT": 0, "WONK": 0}, "ofl/fraunces/OFL.txt", ["kern", "liga"], "fraunces-black.woff2"),
    ("gothic", "Gothic", "ofl/pirataone/PirataOne-Regular.ttf", None, "ofl/pirataone/OFL.txt", ["kern", "liga"], "pirata-one.woff2"),
    # Contextual alternates dropped: they'd take the file from 47 to 73 KB for a variety no one reads at a tee's distance.
    ("hand", "Hand", "ofl/caveatbrush/CaveatBrush-Regular.ttf", None, "ofl/caveatbrush/OFL.txt", ["kern"], "caveat-brush.woff2"),
]

# lib/upload/words PRINTABLE: ASCII, Latin-1 and Latin Extended-A (less the soft hyphen, the vulgar fractions and two
# deprecated letters no face has), and the punctuation a phone's keyboard types instead of plain quotes and dashes.
CODES = [c for c in range(0x20, 0x7F)] + [c for c in range(0xA0, 0x180) if c not in (0xAD, 0xBC, 0xBD, 0xBE, 0x149, 0x17F)] + [0x2018, 0x2019, 0x201C, 0x201D, 0x2013, 0x2014, 0x2026]
TEXT = "".join(chr(c) for c in CODES)


def fetch(path, tmp):
    if os.path.isabs(path):
        return path
    dst = os.path.join(tmp, path.replace("/", "_"))
    if not os.path.exists(dst):
        with urllib.request.urlopen(GF + urllib.parse.quote(path)) as r, open(dst, "wb") as f:
            f.write(r.read())
    return dst


def label_symbol(font, fid, label):
    """The label as one <symbol> of outlines, advance by advance, baseline at the font's ascender, on an em of 100 (whole units: sharp enough at a tile's 20 px)."""
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    k = 100 / font["head"].unitsPerEm
    asc, desc = font["hhea"].ascent, font["hhea"].descent
    x, paths = 0, []
    for ch in label:
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs, ntos=lambda v: str(round(v)))
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, x * k, asc * k)))
        paths.append(pen.getCommands())
        x += font["hmtx"][g][0]
    return f'<symbol id="face-{fid}" viewBox="0 0 {round(x * k)} {round((asc - desc) * k)}"><path d="{" ".join(paths)}"/></symbol>'


def main():
    os.makedirs(OUT, exist_ok=True)
    symbols = []
    with tempfile.TemporaryDirectory() as tmp:
        for fid, label, src, axes, lic, features, out in FACES:
            font = TTFont(fetch(src, tmp))
            if axes:
                font = instancer.instantiateVariableFont(font, axes)
            missing = [f"U+{c:04X}" for c in CODES if c not in font.getBestCmap()]
            if missing:
                raise SystemExit(f"{label}: missing {len(missing)} characters: {' '.join(missing[:12])}")
            symbols.append(label_symbol(font, fid, label))
            path = os.path.join(tmp, f"{fid}.ttf")
            font.save(path)
            opts = subset.Options()
            opts.flavor = "woff2"
            opts.layout_features = features
            opts.name_IDs = ["*"]
            opts.notdef_outline = True
            cut = subset.load_font(path, opts)
            s = subset.Subsetter(opts)
            s.populate(text=TEXT)
            s.subset(cut)
            subset.save_font(cut, os.path.join(OUT, out), opts)
            shutil.copyfile(fetch(lic, tmp), os.path.join(OUT, f"LICENSE-{fid}.txt"))
            print(f"{out}: {os.path.getsize(os.path.join(OUT, out))} bytes")
    with open(os.path.join(OUT, "names.svg"), "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg">' + "".join(symbols) + "</svg>\n")
    print(f"names.svg: {os.path.getsize(os.path.join(OUT, 'names.svg'))} bytes; {len(CODES)} characters")


if __name__ == "__main__":
    main()
