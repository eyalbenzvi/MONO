"""Write the five panel prompts for a round: python3 panel_prompt.py <round dir> <design-2 description>"""
import sys

PERSONAS = [
    "Screen-print production designer, 25 years preparing art for one-colour screen printing on tees",
    "Apparel art director for independent labels",
    "Natural-history illustrator who checks truth to the source and looks hard for artefacts",
    "Graphic designer judging composition and typography",
    "Merchandiser and buyer for a curated online shop, the sceptic",
]

d = sys.argv[1]
desc2 = sys.argv[2]
for k, persona in enumerate(PERSONAS, 1):
    p = f"""You are on a design review panel. Your persona: {persona}.

The shop: MONO, a small online shop selling $50 t-shirts printed in ONE ink (black on a white tee here). Customers like things that are beautiful, smart, and have a point of view. Four reference tees set the shop's standard: a whale study sheet, a sailboat technical elevation, a dense pen-and-ink colonial building, and a bicycle patent sheet in white on black.

Calibration: the best design so far scored 9.0 (an archive octopus engraving); strong woodcuts and ship prints score about 8.0.

The designs (each image is the full 28 x 37 cm print area at 300 DPI, shown as ink on a white tee):
- Design 1: a bare oak tree above ground with its roots below, and a fox family asleep in an earth among the roots; tonal pencil-like drawing. Files: {d}/design-1-whole.png (scaled down), {d}/design-1-full.png (full size), crops {d}/design-1-crop-*.png.
- Design 2: {desc2} Files: {d}/design-2-whole.png (scaled down), {d}/design-2-full.png (full size, 3307 x 4370), crops {d}/design-2-crop-*.png.

How to look: open each print whole (scaled down, as if seen from 3 m away) and then crop into details at full size (use the crops given; you may also crop the full-size files yourself with Python/PIL into your own scratch files under /tmp). Judge it as a shirt someone would pay $50 for and wear.

For each design give ONE score 1-10 (halves allowed), a verdict PASS / NEEDS CHANGE / DELETE, a short why, and the one fix that would raise it most. Name the best design.

Write ONLY this JSON to {d}/designer-{k}.json:
{{"designer":"K={k}","persona":"{persona}","designs":[{{"no":1,"score":..,"verdict":"..","why":"..","fix":".."}},{{"no":2,"score":..,"verdict":"..","why":"..","fix":".."}}],"best":..,"overall":".."}}
Reply "done" when the file is written."""
    open(f"{d}/prompt-{k}.txt", "w").write(p)
print("ok")
