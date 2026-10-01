"""
The run of fifty: ten helper sessions, five slots each, a main design and a
backup per slot (100 designs, 50 slots). The coordinator writes the list and the
shared negative; each helper writes its own prompts in run50-K.py (60-100 words
each, subject, count and view in the first seven words) as

  PROMPTS = {1: {"main": "...", "backup": "..."}, 2: {...}, ...}

A scene's mode names its ending: "tone --edge horizon|rect|circle|arch|oval"
(oneink.py; horizon by default, oval at most one design in ten). This run's list
predates the endings and says "tone --fade", which oneink.py reads as oval.

This prints the jobs file for generate.py, four seeds a design:

  python scripts/studio/briefs/run50.py <K> <slot|all> <main|backup> <out-dir> > jobs.json

"all" gives the five mains (or backups) at once: 20 jobs. Each job carries what
oneink.py needs alongside (slug, title, sub, mode, fade, size).
"""
import importlib.util, json, os, sys

NEGATIVE = (
    "text, letters, numbers, signature, watermark, logo, frame, border, ornament, decorative corners, panel, "
    "colour, grey wash, gradient, blurry, photo, 3d render, cropped, cut off, extra limbs, missing limbs, fused, "
    "deformed, two heads, duplicate"
)
NO_SCENE = ", landscape background"  # not for the landscape helpers (7-9 scenes)

# K: [(main title, main note, backup title, backup note, mode, size, sub)]
D = {
    1: [  # Marine life
        ("MANTA RAY", "seen from above, wings spread", "STINGRAY", "seen from above", "line", "960x1088", "Marine life · Seen from above"),
        ("NAUTILUS SHELL", "side view of the spiral", "CONCH SHELL", "", "line", "832x1216", "Marine life · Natural history plate"),
        ("SCALLOP SHELL", "front view", "SAND DOLLAR", "seen from above", "line", "960x1088", "Marine life · Natural history plate"),
        ("PUFFERFISH", "front view, inflated", "SEA URCHIN", "", "line", "960x1088", "Marine life · Natural history plate"),
        ("BRANCHING CORAL", "one branch", "SEA FAN", "", "line", "832x1216", "Marine life · The reef"),
    ],
    2: [  # Birds: front view, perched on a branch or head only, never standing on the ground
        ("SNOWY OWL", "perched on a branch, front view", "EAGLE OWL", "perched, front view", "tone", "832x1216", "Nature · Arctic hunter"),
        ("GOLDEN EAGLE", "front view, wings spread wide", "RAVEN", "front view, wings spread", "line", "960x1088", "Nature · Wings open"),
        ("PEACOCK FEATHER", "one feather", "PHEASANT FEATHER", "one feather", "line", "832x1216", "Nature · One feather"),
        ("PUFFIN", "head and shoulders, side portrait", "KINGFISHER", "head and shoulders", "line", "832x1216", "Nature · Portrait"),
        ("BIRD'S NEST", "with eggs, seen from above", "OWL FEATHER", "one feather", "line", "960x1088", "Nature · Seen from above"),
    ],
    3: [  # Wings: seen from above, symmetrical
        ("SWALLOWTAIL BUTTERFLY", "seen from above, symmetrical", "MONARCH BUTTERFLY", "seen from above, symmetrical", "line", "960x1088", "Nature · Wings open"),
        ("LUNA MOTH", "seen from above, symmetrical", "ATLAS MOTH", "seen from above, symmetrical", "line", "960x1088", "Nature · Night flyer"),
        ("DRAGONFLY", "seen from above, symmetrical", "DAMSELFLY", "seen from above, symmetrical", "pen", "960x1088", "Nature · Four wings"),
        ("HONEYBEE", "seen from above, symmetrical", "BUMBLEBEE", "seen from above, symmetrical", "line", "960x1088", "Nature · Natural history plate"),
        ("BAT", "front view, wings spread", "FLYING FOX", "front view, wings spread", "line", "960x1088", "Nature · Wings open"),
    ],
    4: [  # Heads: front view, symmetrical, to the shoulders
        ("WOLF", "head, front view", "FOX", "head, front view", "line", "832x1216", "Nature · Portrait"),
        ("LION", "head with mane, front view", "TIGER", "head, front view", "line", "832x1216", "Nature · Portrait"),
        ("RED DEER STAG", "head with antlers, front view", "MOOSE", "head, front view", "line", "832x1216", "Nature · Portrait"),
        ("BROWN BEAR", "head, front view", "POLAR BEAR", "head, front view", "line", "832x1216", "Nature · Portrait"),
        ("HIGHLAND BULL", "head with horns, front view", "RAM", "head with curled horns, front view", "line", "960x1088", "Nature · Portrait"),
    ],
    5: [  # Botanical: one item, botanical plate
        ("OAK LEAF AND ACORNS", "", "MAPLE LEAF", "", "line", "832x1216", "Botanical · Natural history plate"),
        ("FERN FROND", "one, curling", "GINKGO LEAF", "", "line", "832x1216", "Botanical · Natural history plate"),
        ("PINE CONE", "one", "FIR CONE", "on a branch", "line", "832x1216", "Botanical · Natural history plate"),
        ("ARTICHOKE", "one", "THISTLE", "", "line", "832x1216", "Botanical · Natural history plate"),
        ("SUNFLOWER HEAD", "front view", "DANDELION CLOCK", "", "line", "960x1088", "Botanical · Seen head on"),
    ],
    6: [  # Garden and fruit
        ("POMEGRANATE", "cut in half", "FIG", "cut in half", "line", "960x1088", "Botanical · Cut open"),
        ("FLY AGARIC", "two mushrooms", "MOREL", "one", "line", "832x1216", "Nature · Forest floor"),
        ("LOTUS FLOWER", "front view", "WATER LILY", "", "line", "960x1088", "Botanical · Natural history plate"),
        ("ROSE", "one bloom, front view", "PEONY", "one bloom", "line", "960x1088", "Botanical · Natural history plate"),
        ("OLIVE BRANCH", "one branch with olives", "LEMON BRANCH", "one branch with lemons", "line", "832x1216", "Botanical · Natural history plate"),
    ],
    7: [  # Mountains (scenes)
        ("MATTERHORN", "a lone pyramid peak", "DOLOMITES", "rock towers", "tone --fade", "832x1216", "Places · The Alps"),
        ("ALPINE LAKE", "with peaks", "FJORD", "", "tone --fade", "832x1216", "Places · Still water"),
        ("DESERT DUNES", "", "MESAS", "in the desert", "tone --fade", "832x1216", "Places · The desert"),
        ("WATERFALL", "tall", "SLOT CANYON", "", "tone --fade", "832x1216", "Places · Falling water"),
        ("PINE FOREST IN MIST", "", "BIRCH WOOD", "", "tone --fade", "832x1216", "Places · The forest"),
    ],
    8: [  # Coast (scenes)
        ("SEA STACKS", "", "SEA ARCH", "", "tone --fade", "832x1216", "Places · The coast"),
        ("BREAKING WAVE", "one big wave", "STORM SEA", "", "tone --fade", "960x1088", "Maritime · Open water"),
        ("ROCKY ISLET", "with one tree", "LONE PALM ON A BEACH", "", "tone --fade", "832x1216", "Places · The island"),
        ("CHALK CLIFFS", "", "BASALT COLUMNS", "", "tone --fade", "832x1216", "Places · The coast"),
        ("FISHING HUT ON STILTS", "over water", "BOATHOUSE", "on a lake", "tone --fade", "960x1088", "Maritime · Still water"),
    ],
    9: [  # Sky and earth
        ("FULL MOON", "one disc, no fade", "CRESCENT MOON", "", "tone", "960x1088", "Maps & Sky · The near side"),
        ("SATURN", "with its rings", "JUPITER", "", "tone", "960x1088", "Maps & Sky · The planets"),
        ("GEYSER", "erupting", "ICEBERG", "", "tone --fade", "832x1216", "Science · Earth at work"),
        ("QUARTZ CRYSTAL CLUSTER", "", "AMETHYST GEODE", "cut in half", "line", "960x1088", "Science · Mineral plate"),
        ("GLACIER", "", "ICE CAVE", "", "tone --fade", "832x1216", "Places · Ice"),
    ],
    10: [  # Objects: front view, one object, no text or numerals
        ("ANCHOR", "", "SHIP'S BELL", "", "line", "832x1216", "Maritime · Ground tackle"),
        ("DIVING HELMET", "front view", "OIL LANTERN", "", "line", "832x1216", "Maritime · Deep water"),
        ("HOURGLASS", "", "OIL LAMP", "", "line", "832x1216", "Objects · Time"),
        ("ANTIQUE KEY", "", "PADLOCK", "", "line", "960x1088", "Objects · Ironwork"),
        ("CHESS KNIGHT", "", "CHESS ROOK", "", "line", "832x1216", "Objects · Carved wood"),
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
    path = os.path.join(os.path.dirname(__file__), f"run50-{k}.py")
    spec = importlib.util.spec_from_file_location(f"run50_{k}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.PROMPTS


def jobs(k, slot, which, out):
    d = design(k, slot, which)
    p = " ".join(prompts(k)[slot][which].split())
    n = len(p.split())
    if not 60 <= n <= 100:
        sys.exit(f"helper {k} slot {slot} {which}: {n} words (60-100)")
    neg = NEGATIVE + ("" if d["fade"] else NO_SCENE)
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
