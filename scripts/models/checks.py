"""
What makes a generated model photo unusable, measured on the man's
silhouette (rembg). generate.py runs these on every try and retries with the
next seed at once; analyze.py runs them again. Each rule is a lesson from a
photo that was thrown away:

- tee tone: the middle of the back must be the tee's colour. Caught loose
  long hair falling over the back (the print would sit on the hair), a tee
  backlit by a sunset (dark), a grey tee.
- tint: a white tee must be white, not beige (golden autumn light).
- sleeves: the tee covers the shoulders out to the upper arms — a tank top
  shows skin there (the shop sells tees only).
- trousers: light trousers merge with a white tee (its hem can't be found,
  and the black twin gets a white band); dark or mid tones only.
"""
import numpy as np

def measure(img, j, session):
    """The silhouette's landmarks and the numbers the rules look at."""
    from rembg import remove
    w, h = img.size
    person = np.array(remove(img, session=session, only_mask=True)) > 128
    a = np.asarray(img).astype(np.float32) / 255
    lum = a @ [0.2126, 0.7152, 0.0722]
    sat = a.max(2) - a.min(2)
    rows = [np.nonzero(person[r])[0] for r in range(h)]
    span = [(c.min(), c.max()) if len(c) else None for c in rows]
    head = next((r for r in range(h) if span[r]), None)
    if head is None:
        return None
    width = lambda r: span[r][1] - span[r][0] if span[r] else 0
    cen = lambda r: (span[r][0] + span[r][1]) / 2 if span[r] else None
    search = range(head + int(h * 0.05), min(h - 1, head + int(h * 0.3)))
    neck = min(search, key=lambda r: width(r) if width(r) > 5 else 1e9)
    sh_rows = range(neck, min(h - 1, neck + int(h * 0.15)))
    shoulder_row = max(sh_rows, key=width); shoulders = width(shoulder_row)
    waist = min(h - 1, neck + int(shoulders * 1.25))
    cx = (cen(neck) + cen(waist)) / 2 if cen(waist) is not None else cen(neck)
    ys = slice(int(neck + shoulders * 0.3), int(neck + shoulders * 0.7))
    xs = slice(int(cx - shoulders * 0.12), int(cx + shoulders * 0.12))
    tone = float(lum[ys, xs].mean())
    tint = float(sat[ys, xs].mean())
    # Upper arms: the band a little below the shoulder line, outer fifths of the silhouette.
    r0, r1 = int(neck + shoulders * 0.18), int(neck + shoulders * 0.32)
    tee_like = (lum > 0.5) & (sat < 0.12) if j["color"] == "white" else (lum < 0.2)
    outer = []
    for r in range(r0, min(h, r1)):
        if not span[r]: continue
        L, R = span[r]; k = max(1, int((R - L) * 0.2))
        outer += list(tee_like[r, L:L + k] & person[r, L:L + k]) + list(tee_like[r, R - k:R] & person[r, R - k:R])
    sleeves = float(np.mean(outer)) if outer else 0.0
    # Trousers: the body below the tee's usual hem.
    t0, t1 = int(neck + shoulders * 1.45), int(min(h, neck + shoulders * 1.75))
    tx = slice(int(cx - shoulders * 0.3), int(cx + shoulders * 0.3))
    body = person[t0:t1, tx]
    trousers = float(lum[t0:t1, tx][body].mean()) if body.any() else 0.0
    return dict(person=person, lum=lum, span=span, neck=neck, shoulders=shoulders, cx=cx,
                tone=tone, tint=tint, sleeves=sleeves, trousers=trousers)

def reason(m, j):
    """Why the photo can't be used, or None."""
    if m is None: return "no person"
    white = j["color"] == "white"
    if (white and m["tone"] < j.get("min_tone", 0.6)) or (not white and m["tone"] > 0.22): return f"tee tone {m['tone']:.2f}"
    if white and m["tint"] > 0.08: return f"tee tinted {m['tint']:.2f}"
    if m["sleeves"] < 0.5: return f"no sleeves {m['sleeves']:.2f}"
    if white and m["trousers"] > 0.62: return f"light trousers {m['trousers']:.2f}"
    return None
