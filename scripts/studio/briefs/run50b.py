"""
The second run of fifty (run50b): ten helper sessions, five slots each, a main design and a
backup per slot (100 designs, 50 slots). The coordinator writes the list and the
shared negative; each helper writes its own prompts in run50b-K.py (60-100 words
each, subject, count and view in the first seven words) as

  PROMPTS = {1: {"main": "...", "backup": "..."}, 2: {...}, ...}

A scene's mode names its ending: "tone --edge horizon|rect|circle|arch|oval"
(oneink.py; horizon by default, oval at most one design in ten). The brief said
"tone --fade" for helpers 7-9; under the new scene-ending rules each scene names
its ending instead (the user asked for the guidelines to follow the new rules).

This prints the jobs file for generate.py, four seeds a design:

  python scripts/studio/briefs/run50b.py <K> <slot|all> <main|backup> <out-dir> > jobs.json

"all" gives the five mains (or backups) at once: 20 jobs. Each job carries what
oneink.py needs alongside (slug, title, sub, mode, fade, size).
"""
import importlib.util, json, os, sys

NEGATIVE = (
    "text, letters, numbers, signature, watermark, logo, frame, border, ornament, decorative corners, panel, "
    "colour, grey wash, gradient, blurry, photo, 3d render, cropped, cut off, extra limbs, missing limbs, fused, "
    "deformed, two heads, duplicate"
)
NO_SCENE = ", landscape background"  # not for helpers 7-9

# K: [(main title, main note, backup title, backup note, mode, size, sub)]
# After the first run's lessons (scripts/studio/briefs/run50b-helper.md): marine slots of a coral or a
# bivalve became radial top views and spiral shells (marine failed 3 of 5); the mesa (desert cliffs
# were made in run 1) became a sandstone arch; scenes take an ending (--edge) instead of an oval fade.
D = {
    1: [  # Marine and fossils
        ("AMMONITE FOSSIL", "spiral, side view", "TRILOBITE FOSSIL", "seen from above", "line", "960x1088", "Science · Fossil plate"),
        ("MOON SNAIL SHELL", "", "COWRIE SHELL", "", "line", "960x1088", "Marine life · Natural history plate"),
        ("SEA URCHIN SHELL", "seen from above, radial", "STARFISH", "seen from above, five arms", "line", "960x1088", "Marine life · Seen from above"),
        ("CONCH SHELL", "", "NAUTILUS SHELL", "cut in half, chambers", "line", "960x1088", "Marine life · Natural history plate"),
        ("KELP FROND", "one", "BLADDERWRACK", "", "line", "832x1216", "Marine life · Natural history plate"),
    ],
    2: [  # Birds: perched on a branch, head only, or a skull; never standing on the ground
        ("TAWNY OWL", "perched, front view", "LONG-EARED OWL", "perched, front view", "tone", "832x1216", "Nature · Night hunter"),
        ("PEREGRINE FALCON", "head and shoulders", "HAWK", "head and shoulders", "line", "832x1216", "Nature · Portrait"),
        ("MUTE SWAN", "head and neck", "FLAMINGO", "head and neck", "line", "832x1216", "Nature · Portrait"),
        ("TOUCAN", "head and shoulders", "HORNBILL", "head and shoulders", "line", "832x1216", "Nature · Portrait"),
        ("RAVEN SKULL", "side view", "OWL SKULL", "front view", "line", "960x1088", "Science · Osteology"),
    ],
    3: [  # Wings and small worlds: seen from above, symmetrical
        ("EMPEROR MOTH", "seen from above, symmetrical", "HAWK MOTH", "seen from above, symmetrical", "line", "960x1088", "Nature · Night flyer"),
        ("CICADA", "wings open, seen from above", "LACEWING", "seen from above", "pen", "960x1088", "Nature · Wings open"),
        ("MORPHO BUTTERFLY", "seen from above, symmetrical", "PEACOCK BUTTERFLY", "seen from above, symmetrical", "line", "960x1088", "Nature · Wings open"),
        ("LADYBIRD", "seen from above", "SCARAB BEETLE", "seen from above, legs folded", "line", "960x1088", "Nature · Natural history plate"),
        ("SPIDER WEB", "with dew, no spider", "DANDELION SEED", "one seed", "pen", "832x1216", "Nature · Fine work"),
    ],
    4: [  # Heads: front view, symmetrical, to the shoulders
        ("ELEPHANT", "head, front view, ears spread", "RHINOCEROS", "head, front view", "line", "960x1088", "Nature · Portrait"),
        ("HORSE", "head, front view", "ZEBRA", "head, front view", "line", "832x1216", "Nature · Portrait"),
        ("SNOW LEOPARD", "head, front view", "LYNX", "head, front view", "line", "832x1216", "Nature · Portrait"),
        ("BISON", "head, front view", "WATER BUFFALO", "head, front view", "line", "960x1088", "Nature · Portrait"),
        ("GORILLA", "head, front view", "ORANGUTAN", "head, front view", "line", "832x1216", "Nature · Portrait"),
    ],
    5: [  # Trees: one tree, to the ground, the ground breaking into paper
        ("BAOBAB", "", "DRAGON BLOOD TREE", "", "line", "832x1216", "Botanical · One tree"),
        ("ANCIENT OLIVE TREE", "", "CORK OAK", "", "line", "832x1216", "Botanical · One tree"),
        ("WEEPING WILLOW", "", "CEDAR OF LEBANON", "", "line", "832x1216", "Botanical · One tree"),
        ("BONSAI PINE", "", "JUNIPER BONSAI", "", "line", "832x1216", "Botanical · One tree"),
        ("DATE PALM", "", "COCONUT PALM", "", "line", "832x1216", "Botanical · One tree"),
    ],
    6: [  # Flowers and harvest: one item, botanical plate
        ("KING PROTEA", "", "BANKSIA", "", "line", "832x1216", "Botanical · Natural history plate"),
        ("ORCHID", "one stem", "IRIS", "one stem", "line", "832x1216", "Botanical · Natural history plate"),
        ("WHEAT", "a sheaf of ears", "BARLEY", "a sheaf of ears", "line", "832x1216", "Production · The harvest"),
        ("COFFEE BRANCH", "with cherries", "COCOA POD", "cut in half", "line", "832x1216", "Production · From branch to cup"),
        ("HOP CONES", "on a bine", "LAVENDER", "a bunch", "line", "832x1216", "Production · Natural history plate"),
    ],
    7: [  # Places (scenes, an ending each)
        ("SNOW-CAPPED VOLCANO", "", "CINDER CONE", "", "tone --edge horizon", "832x1216", "Places · Fire and ice"),
        ("RICE TERRACES", "", "VINEYARD HILLS", "", "tone --edge rect", "832x1216", "Places · Worked land"),
        ("SAVANNA", "with one acacia", "SALT FLAT", "", "tone --edge horizon", "960x1088", "Places · Open ground"),
        ("LIMESTONE KARST PEAKS", "", "SANDSTONE ARCH", "", "tone --edge arch", "832x1216", "Places · Old rock"),
        ("AURORA OVER MOUNTAINS", "", "MILKY WAY OVER PEAKS", "", "tone --edge rect", "832x1216", "Maps & Sky · Night sky"),
    ],
    8: [  # Buildings in the landscape (scenes): one old, organic building, no technical drawing
        ("WINDMILL", "", "WATERMILL", "", "tone --edge horizon", "832x1216", "Architecture · Old work"),
        ("HILLTOP MONASTERY", "", "CLIFF VILLAGE", "", "tone --edge arch", "832x1216", "Architecture · High places"),
        ("STONE COTTAGE", "", "THATCHED COTTAGE", "", "tone --edge horizon", "960x1088", "Villages · Home"),
        ("CASTLE RUIN", "", "ROUND TOWER RUIN", "", "tone --edge horizon", "832x1216", "Architecture · Ruins"),
        ("MOUNTAIN HUT", "", "ALPINE CHAPEL", "", "tone --edge rect", "832x1216", "Villages · Under the peaks"),
    ],
    9: [  # Sky and earth
        ("TOTAL SOLAR ECLIPSE", "with corona", "ANNULAR ECLIPSE", "", "tone", "960x1088", "Maps & Sky · The sun hidden"),
        ("COMET", "over hills", "METEOR SHOWER", "over hills", "tone --edge horizon", "832x1216", "Maps & Sky · Visitors"),
        ("LIGHTNING STORM", "over a plain", "SUPERCELL CLOUD", "", "tone --edge horizon", "832x1216", "Science · Weather"),
        ("MARS", "one globe", "MERCURY", "one globe", "tone", "960x1088", "Maps & Sky · The planets"),
        ("DESERT ROSE CRYSTAL", "", "PYRITE CUBES", "", "line", "960x1088", "Science · Mineral plate"),
    ],
    10: [  # Objects: front view, one object, no text, numerals or letters
        ("VINTAGE CAMERA", "front view", "FOLDING CAMERA", "front view", "line", "960x1088", "Objects · Light tight"),
        ("ENAMEL TEAPOT", "", "COFFEE POT", "", "line", "960x1088", "Objects · Kitchen"),
        ("AVIATOR GOGGLES", "", "MOTORCYCLE HELMET", "front view", "line", "960x1088", "Objects · Open road"),
        ("FOUNTAIN PEN NIB", "close up", "QUILL", "", "line", "832x1216", "Objects · Ink"),
        ("MONKEY'S FIST KNOT", "", "COIL OF ROPE", "", "line", "832x1216", "Maritime · Ropework"),
    ],
}


def slug(title):
    return "".join(c if c.isalnum() else "-" for c in title.lower().replace("'", "")).strip("-").replace("--", "-")


def design(k, slot, which):
    mt, mn, bt, bn, mode, size, sub = D[k][slot - 1]
    title, note = (mt, mn) if which == "main" else (bt, bn)
    edge = mode.split("--edge ")[1].split()[0] if "--edge " in mode else ("oval" if "--fade" in mode else None)
    return {"title": title, "note": note, "slug": slug(title), "mode": mode.split()[0], "edge": edge, "fade": edge is not None, "size": size, "sub": sub}


def prompts(k):
    path = os.path.join(os.path.dirname(__file__), f"run50b-{k}.py")
    spec = importlib.util.spec_from_file_location(f"run50b_{k}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.PROMPTS


def jobs(k, slot, which, out):
    d = design(k, slot, which)
    p = " ".join(prompts(k)[slot][which].split())
    n = len(p.split())
    if not 60 <= n <= 100:
        sys.exit(f"helper {k} slot {slot} {which}: {n} words (60-100)")
    neg = NEGATIVE + ("" if k in (7, 8, 9) else NO_SCENE)
    base = k * 1000 + slot * 100 + (0 if which == "main" else 50)
    return [
        {"out": f"{out}/K{slot}-{d['slug']}-s{base + i}.png", "seed": base + i, "prompt": p, "negative": neg, "size": d["size"],
         "helper": k, "slot": slot, "which": which, "words": n, **d}
        for i in range(4)
    ]


if __name__ == "__main__":
    k, slot, which, out = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
    assert which in ("main", "backup")
    slots = range(1, 6) if slot == "all" else [int(slot)]
    print(json.dumps([j for s in slots for j in jobs(k, s, which, out)], indent=1, ensure_ascii=False))
