"""
PISA: one large postage stamp in bold line, the whole stamp (its perforated edge, double frame, lettering
and strip of lawn) tilted 3.97 degrees to the right, the Leaning Tower's own lean since its 1990-2001
stabilisation, while the tower inside stands perfectly upright. The tower is the owner's ChatGPT drawing
(original-1.jpg, the first of three runs of one prompt: the blind-arcade base with its lozenges, six loggia
levels and the flat-topped bell chamber, as the tower is built), counter-rotated so it stands plumb; everything
else drawn here; PISA in Cinzel, the stamp's value, 3.97°, in the corner.

  python data/studio/best1/03-1-pisa/sources/build.py
"""
import math, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))
import kit  # noqa: E402

TILT = 3.97  # degrees, clockwise: the tower's lean
CX = 140.0
W, H = 196.0, 322.0  # the stamp's paper
X0, Y0 = CX - W / 2, 14.0
PERF_R, PERF_STEP = 2.7, 8.8  # perforation holes and their pitch
EDGE = 1.5  # the paper edge's line
TOWER_SRC = HERE / "original-1.jpg"
TOWER_BOX = (236, 42, 612, 1229)  # the tower, plinth included, without the drawing's own ground line


def perforated(x0, y0, w, h):
    """The stamp's outline with its perforation: a quarter hole at each corner, evenly pitched holes between."""
    corners = [(x0, y0), (x0 + w, y0), (x0 + w, y0 + h), (x0, y0 + h)]
    d = []
    for i in range(4):
        (ax, ay), (bx, by) = corners[i], corners[(i + 1) % 4]
        length = ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5
        ux, uy = (bx - ax) / length, (by - ay) / length
        if i == 0:
            d.append(f"M{ax + ux * PERF_R:.2f},{ay + uy * PERF_R:.2f}")
        n = max(2, round(length / PERF_STEP))
        for k in range(1, n):
            c = k * length / n
            d.append(f"L{ax + ux * (c - PERF_R):.2f},{ay + uy * (c - PERF_R):.2f} A{PERF_R},{PERF_R} 0 0 0 {ax + ux * (c + PERF_R):.2f},{ay + uy * (c + PERF_R):.2f}")
        # The corner's quarter hole, round to the next edge.
        nx, ny = corners[(i + 2) % 4]
        vx, vy = (nx - bx), (ny - by)
        vl = (vx * vx + vy * vy) ** 0.5
        d.append(f"L{bx - ux * PERF_R:.2f},{by - uy * PERF_R:.2f} A{PERF_R},{PERF_R} 0 0 0 {bx + vx / vl * PERF_R:.2f},{by + vy / vl * PERF_R:.2f}")
    return f'<path d="{" ".join(d)} Z" fill="none" stroke="black" stroke-width="{EDGE}" stroke-linejoin="round"/>'


MARGIN = 10.0  # paper to the frame
F0x, F0y, Fw, Fh = X0 + MARGIN, Y0 + MARGIN, W - 2 * MARGIN, H - 2 * MARGIN
IX0, IX1 = F0x + 3.4, F0x + Fw - 3.4  # the inner rule's sides
BAND = 36.0  # the lettering's band at the top of the frame
PAVE = 13.0  # the piazza's band at the foot
GROUND = F0y + Fh - 3.4 - PAVE  # the ground line, level

stamp = [perforated(X0, Y0, W, H)]
# The double frame, the band's rule under the lettering, PISA and the value: the tower's lean.
stamp.append(f'<rect x="{F0x:.2f}" y="{F0y:.2f}" width="{Fw:.2f}" height="{Fh:.2f}" fill="none" stroke="black" stroke-width="2.4"/>')
stamp.append(f'<rect x="{IX0:.2f}" y="{F0y + 3.4:.2f}" width="{IX1 - IX0:.2f}" height="{Fh - 6.8:.2f}" fill="none" stroke="black" stroke-width="0.9"/>')
stamp.append(f'<line x1="{IX0:.2f}" y1="{F0y + BAND:.2f}" x2="{IX1:.2f}" y2="{F0y + BAND:.2f}" stroke="black" stroke-width="0.9"/>')
stamp.append(f'<text x="{IX0 + 8:.2f}" y="{F0y + BAND - 9:.2f}" font-family="Cinzel" font-weight="bold" font-size="25" letter-spacing="5" fill="black">PISA</text>')
stamp.append(f'<text x="{IX1 - 7:.2f}" y="{F0y + BAND - 9:.2f}" text-anchor="end" font-family="Cinzel" font-weight="bold" font-size="17" letter-spacing="1.2" fill="black">3.97°</text>')
# The piazza: the ground line and a band of paving in two staggered courses.
stamp.append(f'<line x1="{IX0:.2f}" y1="{GROUND:.2f}" x2="{IX1:.2f}" y2="{GROUND:.2f}" stroke="black" stroke-width="1.4"/>')
mid = GROUND + PAVE / 2
stamp.append(f'<line x1="{IX0:.2f}" y1="{mid:.2f}" x2="{IX1:.2f}" y2="{mid:.2f}" stroke="black" stroke-width="0.9"/>')
STONE = 14.0
for course, (ya, yb, off) in enumerate([(GROUND, mid, 0.0), (mid, GROUND + PAVE, STONE / 2)]):
    x = IX0 + STONE - off
    while x < IX1 - 2:
        if x > IX0 + 2:
            stamp.append(f'<line x1="{x:.2f}" y1="{ya:.2f}" x2="{x:.2f}" y2="{yb:.2f}" stroke="black" stroke-width="0.9"/>')
        x += STONE

# The tower, leaning 3.97 degrees about its plinth's left foot on the ground: the left foot planted, the
# right sunk below the paving (as the real tower sank on its south side).
tx0, ty0, tx1, ty1 = TOWER_BOX
TOWER_H = GROUND - (F0y + BAND) - 14.0
s = TOWER_H / (ty1 - ty0)
tw = (tx1 - tx0) * s
FOOT = 1.2  # mm in from the drawing's left edge to the plinth's left foot
LEFT_X = CX - tw / 2 - TOWER_H * 0.069 / 2  # set left so the leaning tower sits centred in the frame
uri, _, _ = kit.line_art(TOWER_SRC, TOWER_BOX, level=150, median=3, scale=3, grow=3)
tower = f'<image x="{LEFT_X:.2f}" y="{GROUND - TOWER_H:.2f}" width="{tw:.2f}" height="{TOWER_H:.2f}" xlink:href="{uri}" preserveAspectRatio="none"/>'
stamp.append(f'<clipPath id="above"><rect x="0" y="0" width="280" height="{GROUND:.2f}"/></clipPath>')
stamp.append(f'<g clip-path="url(#above)"><g transform="rotate({TILT} {LEFT_X + FOOT:.2f} {GROUND:.2f})">{tower}</g></g>')

# The cancellation: a circular date stamp over the frame's upper right (PISA · ITALIA, and the day the
# tower's building began, 9 August 1173), its wavy bars running off the stamp's edge; the stamp's own lines
# knocked out under it so it reads clean.
mark, holes = [], []
PX, PY, PR = IX1 - 13, F0y + BAND + 34, 21.0
mark.append(f'<circle cx="{PX:.2f}" cy="{PY:.2f}" r="{PR}" fill="none" stroke="black" stroke-width="1.1"/>')
mark.append(f'<circle cx="{PX:.2f}" cy="{PY:.2f}" r="{PR - 8.5}" fill="none" stroke="black" stroke-width="0.7"/>')
ra = PR - 6.6
mark.append(f'<path id="arcTop" d="M{PX - ra:.2f},{PY:.2f} A{ra},{ra} 0 0 1 {PX + ra:.2f},{PY:.2f}" fill="none"/>')
mark.append(f'<text font-family="Cinzel" font-weight="bold" font-size="4.5" letter-spacing="0.5" fill="black"><textPath xlink:href="#arcTop" startOffset="50%" text-anchor="middle">PISA · ITALIA</textPath></text>')
rb = PR - 2.4
mark.append(f'<path id="arcBot" d="M{PX - rb:.2f},{PY:.2f} A{rb},{rb} 0 0 0 {PX + rb:.2f},{PY:.2f}" fill="none"/>')
mark.append(f'<text font-family="Cinzel" font-weight="bold" font-size="5.0" letter-spacing="1.4" fill="black"><textPath xlink:href="#arcBot" startOffset="50%" text-anchor="middle">TOSCANA</textPath></text>')
mark.append(f'<text x="{PX:.2f}" y="{PY - 0.6:.2f}" text-anchor="middle" font-family="Cinzel" font-weight="bold" font-size="5.2" fill="black">9 · VIII</text>')
mark.append(f'<text x="{PX:.2f}" y="{PY + 5.4:.2f}" text-anchor="middle" font-family="Cinzel" font-weight="bold" font-size="5.2" fill="black">1173</text>')
for k in range(5):
    y = PY - 12 + k * 6
    x = PX + PR + 2.5
    d = f"M{x:.2f},{y:.2f}" + "".join(f" q2.5,-2.2 5,0 t5,0" for _ in range(3))
    mark.append(f'<path d="{d}" fill="none" stroke="black" stroke-width="1.0" stroke-linecap="round"/>')
    holes.append(f'<path d="{d}" fill="none" stroke="black" stroke-width="3.6" stroke-linecap="round"/>')
holes.append(f'<circle cx="{PX:.2f}" cy="{PY:.2f}" r="{PR + 1.4}" fill="black"/>')

body = (f'<mask id="knock" maskUnits="userSpaceOnUse" x="0" y="0" width="280" height="370"><rect x="0" y="0" width="280" height="370" fill="white"/>{"".join(holes)}</mask>'
        f'<g mask="url(#knock)">{"".join(stamp)}</g>{"".join(mark)}')
ink = kit.render(body, HERE / ".render")
ink = kit.despeck(ink)
kit.deliver(ink, HERE.parent, "pisa", "both", {"architectural": 0.85, "wit": 0.6, "line_art": 0.85, "classic": 0.65, "pictorial": 0.7, "retro": 0.5, "typography": 0.3, "clean_minimal": 0.45, "contrast": 0.75, "density": 0.4}, tee_default="white")
