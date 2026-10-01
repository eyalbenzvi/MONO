"""
Twelve designs after four reference tees the founder likes (insp12): four helper sessions,
three slots each, a main design and a backup per slot. Each slot is a new subject in the
spirit of its reference, never a variation of it:

  1  A natural-history study sheet: one large animal drawn alive in the centre, its skeleton
     or anatomy below, small detail sketches, scale lines and faint note marks round it.
     Black ink on a white tee.
  2  A technical elevation: one machine or structure in clean side view with its rigging or
     construction lines, a thin ground line and faint spec-column marks either side.
     Black ink on a white tee.
  3  A dense pen-and-ink street scene: old buildings with balconies, shutters and plants,
     drawn edge to edge in fine hatching, a ground line at the foot. Black ink on a white tee.
  4  A patent-style study sheet in white chalk-like line on black: one object large, exploded
     or repeated parts round it, small detail roundels. White ink on a black tee.

Each helper writes its own prompts in insp12-K.py (60-100 words each, subject, count and view
in the first seven words) as PROMPTS = {1: {"main": "...", "backup": "..."}, ...}.

  python scripts/studio/briefs/insp12.py <K> <slot|all> <main|backup> <out-dir> > jobs.json
"""
import importlib.util, json, os, sys

NEGATIVE = (
    "text, letters, numbers, signature, watermark, logo, frame, border, ornament, decorative corners, panel, "
    "colour, grey wash, gradient, blurry, photo, 3d render, cropped, cut off, extra limbs, missing limbs, fused, "
    "deformed, two heads"
)
NO_SCENE = ", landscape background"  # not for helper 3 (street scenes)

# K: [(main title, main note, backup title, backup note, mode, size, sub)]
D = {
    1: [  # study sheets of a large animal (after the whale sheet)
        ("SEA TURTLE STUDY", "alive seen from above, shell, skeleton, flipper details", "TORTOISE STUDY", "side view, shell plates, skeleton", "line", "832x1216", "Marine life · Study sheet"),
        ("HAMMERHEAD SHARK STUDY", "alive side view, skeleton, jaw and teeth details", "SAWFISH STUDY", "alive side view, skeleton, saw details", "line", "832x1216", "Marine life · Study sheet"),
        ("OCTOPUS STUDY", "alive with arms spread, beak, sucker details", "SQUID STUDY", "alive side view, beak, fin details", "line", "832x1216", "Marine life · Study sheet"),
    ],
    2: [  # technical elevations (after the sailboat)
        ("HOT AIR BALLOON", "side elevation with basket and rigging lines", "AIRSHIP", "side elevation, gondola, ribs", "line", "832x1216", "Objects · Elevation"),
        ("LIGHTHOUSE ELEVATION", "side view with a cut-away section of the stairs", "WINDPUMP", "side elevation, lattice tower and wheel", "line", "832x1216", "Architecture · Elevation"),
        ("BIPLANE", "side elevation, struts and wires", "SEAPLANE", "side elevation on floats", "line", "832x1216", "Objects · Elevation"),
    ],
    3: [  # dense pen-and-ink street scenes (after the colonial building with palms)
        ("VENETIAN CANAL HOUSES", "palazzo fronts over water, a moored boat", "LISBON HILL STREET", "tiled houses up a steep street, a tram", "pen --edge horizon", "832x1216", "Places · Street"),
        ("MEDINA ROOFTOPS", "flat roofs, arches and a minaret", "SANTORINI HOUSES", "domed white houses stacked on a cliff", "pen --edge horizon", "832x1216", "Places · Street"),
        ("OLD KYOTO STREET", "wooden machiya houses and a pagoda behind", "HANOI SHOPHOUSES", "narrow tall houses, balconies, wires", "pen --edge horizon", "832x1216", "Places · Street"),
    ],
    4: [  # patent study sheets in white line on black (after the bicycle)
        ("SURFBOARD STUDY", "boards in profile and plan, fins, rails", "SKATEBOARD STUDY", "deck, trucks and wheels, exploded", "line", "832x1216", "Objects · Study sheet"),
        ("POCKET WATCH STUDY", "watch face, open movement, gears", "COMPASS STUDY", "compass rose, needle, gimbal parts", "line", "832x1216", "Objects · Study sheet"),
        ("ROLLER SKATE STUDY", "a vintage skate side view, wheels, plates", "TYPEWRITER STUDY", "front view, keys and type bars, no letters", "line", "832x1216", "Objects · Study sheet"),
    ],
}
TEE = {1: "white", 2: "white", 3: "white", 4: "black"}


def slug(title):
    return "".join(c if c.isalnum() else "-" for c in title.lower().replace("'", "")).strip("-").replace("--", "-")


def design(k, slot, which):
    mt, mn, bt, bn, mode, size, sub = D[k][slot - 1]
    title, note = (mt, mn) if which == "main" else (bt, bn)
    edge = mode.split("--edge ")[1].split()[0] if "--edge " in mode else None
    return {"title": title, "note": note, "slug": slug(title), "mode": mode.split()[0], "edge": edge, "size": size, "sub": sub, "tee": TEE[k]}


def prompts(k):
    path = os.path.join(os.path.dirname(__file__), f"insp12-{k}.py")
    spec = importlib.util.spec_from_file_location(f"insp12_{k}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.PROMPTS


def jobs(k, slot, which, out):
    d = design(k, slot, which)
    p = " ".join(prompts(k)[slot][which].split())
    n = len(p.split())
    if not 60 <= n <= 100:
        sys.exit(f"helper {k} slot {slot} {which}: {n} words (60-100)")
    neg = NEGATIVE + ("" if k == 3 else NO_SCENE)
    base = 20000 + k * 1000 + slot * 100 + (0 if which == "main" else 50)
    return [
        {"out": f"{out}/K{slot}-{d['slug']}-s{base + i}.png", "seed": base + i, "prompt": p, "negative": neg, "size": d["size"],
         "helper": k, "slot": slot, "which": which, "words": n, **d}
        for i in range(4)
    ]


if __name__ == "__main__":
    k, slot, which, out = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
    assert which in ("main", "backup")
    slots = range(1, 4) if slot == "all" else [int(slot)]
    print(json.dumps([j for s in slots for j in jobs(k, s, which, out)], indent=1, ensure_ascii=False))
