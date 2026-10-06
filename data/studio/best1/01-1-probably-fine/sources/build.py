"""
PROBABLY FINE.: sixteen dashboard warning lights, all lit, each named, and the verdict under them. White
ink on a black tee, like an instrument panel at night. The symbols are redrawn here in the manner of the
ISO 2575 tell-tales (not traced from any maker's panel), in bold even strokes; type in Oswald and Space
Grotesk.

  python data/studio/best1/01-1-probably-fine/sources/build.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))
import kit  # noqa: E402

SW = 1.6  # the symbols' stroke, mm
B = f'fill="none" stroke="black" stroke-width="{SW}" stroke-linecap="round" stroke-linejoin="round"'
F = 'fill="black"'

# Each symbol drawn in a 40 x 30 box, centred on (20, 15).
SYMBOLS = {
    "ENGINE": f'<path {B} d="M8,12 h4 v-3 h10 v3 h5 l3,-3 h3 v14 h-3 l-3,-3 h-3 v3 h-12 l-4,-4 h-2 v-4 h2 z M4,13 v8 M4,17 h4 M17,9 v-3 h-5 h10"/>',
    "OIL PRESSURE": f'<path {B} d="M6,13 l6,2 h14 l8,-5 l-6,8 h-4 l-2,4 h-14 z M12,15 v-4 h4 M26,15 l4,-2"/><path {F} d="M35,15 q1.6,3 0,4.2 q-1.6,-1.2 0,-4.2 z"/>',
    "BATTERY CHARGE": f'<rect {B} x="6" y="9" width="28" height="15" rx="1"/><path {B} d="M10,9 v-3 h5 v3 M25,9 v-3 h5 v3 M11,16.5 h5 M13.5,14 v5 M24,16.5 h5"/>',
    "COOLANT TEMP.": f'<path {B} d="M20,4 v14 M20,4 h4 M20,8 h4 M20,12 h4"/><circle {B} cx="20" cy="20" r="3"/><path {B} d="M6,24 q3.5,-2.5 7,0 t7,0 t7,0 t7,0 M6,28 q3.5,-2.5 7,0 t7,0 t7,0 t7,0"/>',
    "BRAKE SYSTEM": f'<circle {B} cx="20" cy="15" r="9"/><path {B} d="M8,6 a13,13 0 0 0 0,18 M32,6 a13,13 0 0 1 0,18 M20,9.5 v7"/><circle {F} cx="20" cy="20.3" r="1.2"/>',
    "ABS": f'<circle {B} cx="20" cy="15" r="9"/><path {B} d="M8,6 a13,13 0 0 0 0,18 M32,6 a13,13 0 0 1 0,18"/><text x="20" y="18.3" text-anchor="middle" font-family="Oswald" font-size="9" letter-spacing="0.3" fill="black" stroke="black" stroke-width="0.55" stroke-linejoin="round">ABS</text>',
    "AIRBAG": f'<circle {F} cx="14" cy="6" r="2.6"/><path {B} d="M13,10 l-2,9 h9 l3,7 M13,10 l4,5 h5 M8,26 h10 M27,10 v16"/><circle {F} cx="27" cy="15" r="5.5"/>',
    "SEAT BELT": f'<circle {F} cx="20" cy="5.5" r="2.8"/><path {B} d="M12,26 v-8 q0,-7 8,-7 q8,0 8,7 v8 M14.5,12.5 l12,11"/><rect {F} x="23.6" y="19.6" width="4" height="3" rx="0.6" transform="rotate(42 25.6 21.1)"/>',
    "TYRE PRESSURE": f'<path {B} d="M9,8 q-3,8 0,16 h22 q3,-8 0,-16 M9,24 v3 M15,24 v3 M20,24 v3 M25,24 v3 M31,24 v3 M20,10 v7"/><circle {F} cx="20" cy="20.5" r="1.2"/>',
    "LOW FUEL": f'<rect {B} x="9" y="5" width="13" height="20" rx="1.2"/><path {B} d="M12,8 h7 v5 h-7 z M7,25 h17 M22,11 h4 l3,3 v8 q0,2 2,2 q2,0 2,-2 v-12 l-3,-3"/>',
    "DOOR OPEN": f'<path {B} d="M16,4 h8 q3,0 3,3 v17 q0,3 -3,3 h-8 q-3,0 -3,-3 v-17 q0,-3 3,-3 z M13.5,9 q6.5,-2 13,0 M13.5,22 q6.5,2 13,0 M13,12 l-6,5 M27,12 l6,5"/>',
    "TRACTION CONTROL": f'<path {B} d="M9,13 l3,-5 h16 l3,5 v4 h-22 z M9,17 v3 h3 v-3 M28,17 v3 h3 v-3 M9,25 q3,-3 6,0 t6,0 M19,25 q3,-3 6,0 t6,0"/>',
    "POWER STEERING": f'<circle {B} cx="20" cy="15" r="9"/><circle {B} cx="20" cy="15" r="3"/><path {B} d="M11,15 h6 M23,15 h6 M20,18 v6 M7,7 a14,14 0 0 0 0,16 M33,7 a14,14 0 0 1 0,16"/>',
    "PARKING BRAKE": f'<circle {B} cx="20" cy="15" r="9"/><path {B} d="M8,6 a13,13 0 0 0 0,18 M32,6 a13,13 0 0 1 0,18 M17,20 v-10 h4 q3.5,0 3.5,3 q0,3 -3.5,3 h-4"/>',
    "HIGH BEAM": f'<path {B} d="M24,7 q8,0 8,8 q0,8 -8,8 q-3,0 -3,-8 q0,-8 3,-8 z M6,9 h11 M6,13 h11 M6,17 h11 M6,21 h11"/>',
    "LAMP FAILURE": f'<path {B} d="M20,5 q6,0 6,6 q0,4 -3,6 v3 h-6 v-3 q-3,-2 -3,-6 q0,-6 6,-6 z M17,23 h6 M18,26 h4 M8,6 l4,3 M32,6 l-4,3 M6,15 h4 M30,15 h4"/>',
}

COLS, ROWS = 4, 4
X0, X1 = 8, 272
Y0 = 13
CELL_W = (X1 - X0) / COLS
ICON = 1.62  # the 40 x 30 box drawn at 65 x 49 mm
LABEL = 7.4  # the labels' font size, mm
CELL_H = 30 * ICON + 22
body = []
for k, (name, svg) in enumerate(SYMBOLS.items()):
    c, r = k % COLS, k // COLS
    cx, top = X0 + CELL_W * (c + 0.5), Y0 + CELL_H * r
    body.append(f'<g transform="translate({cx - 20 * ICON:.2f},{top:.2f}) scale({ICON})">{svg}</g>')

    body.append(f'<text x="{cx:.2f}" y="{top + 30 * ICON + 11.5:.2f}" text-anchor="middle" font-family="Oswald" font-size="{LABEL}" letter-spacing="0.5" fill="black" stroke="black" stroke-width="0.22" stroke-linejoin="round">{kit.esc(name)}</text>')

# The verdict, set to the grid's full measure (the outer symbols' edges), measured in the font itself.
from PIL import ImageFont  # noqa: E402

VERDICT, TRACK = "PROBABLY FINE.", 0.04  # tracking as a share of the size
f1k = ImageFont.truetype(str(kit.FONTS / "space-grotesk-bold.ttf"), 1000)
measure = (X1 - X0) - 2 * (CELL_W / 2 - 18 * ICON)  # from the first column's symbol to the last's
size = measure / ((f1k.getlength(VERDICT) + TRACK * 1000 * (len(VERDICT) - 1)) / 1000)
cap = f1k.getbbox("H")
cap_h = (cap[3] - cap[1]) / 1000 * size
body.append(f'<text x="140" y="{Y0 + CELL_H * ROWS - 6 + cap_h:.2f}" text-anchor="middle" font-family="Space Grotesk" font-weight="bold" font-size="{size:.2f}" letter-spacing="{TRACK * size:.2f}" fill="black">{VERDICT}</text>')

ink = kit.render("".join(body), HERE / ".render")
ink = kit.despeck(ink)
kit.deliver(ink, HERE.parent, "probably-fine", "black", {"typography": 0.6, "wit": 0.9, "geometric": 0.5, "clean_minimal": 0.45, "line_art": 0.7, "dark_industrial": 0.45, "retro": 0.25, "classic": 0.1, "pictorial": 0.3, "contrast": 0.8, "density": 0.45})
