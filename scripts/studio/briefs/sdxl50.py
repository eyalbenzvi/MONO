"""
Fifty more designs in the founder's taste (sdxl50), all made with SDXL (scripts/studio/generate_sdxl.py:
SDXL base 1.0 + the SDXL-Lightning 8-step UNet). Thirteen helper sessions, four slots each (52 slots,
fifty to deliver), one slot in each of the four languages of the reference tees the founder picked:

  A  Natural-history study sheet: one animal (or plant) large and alive in the centre, its skeleton or
     anatomy and small detail sketches around, thin scale lines, faint note marks. Black ink, white tee.
  B  Technical side elevation: one machine or structure in clean side view, construction and rigging
     lines, a thin ground line, faint spec columns. Black ink, white tee.
  C  Dense pen-and-ink street or town: old buildings with balconies, shutters, plants, drawn edge to
     edge in fine hatching, the ground ending in a straight line. Black ink, white tee.
  D  Patent study sheet on black: one object large, its parts exploded or repeated round it, small
     detail roundels. White line on a black tee.

Each helper writes its prompts in sdxl50-K.py: PROMPTS = {1: {"main": "...", "backup": "..."}, ...}.
Lightning has no negative prompt: the exclusions go in the prompt, in its first sentence.

  python3 scripts/studio/briefs/sdxl50.py <K> <slot|all> <main|backup> <out-dir> > jobs.json
  python3 scripts/studio/generate_sdxl.py --jobs jobs.json
"""
import importlib.util, json, os, sys

FAMILY = {
    "A": ("line", "832x1216", "white"),
    "B": ("line", "832x1216", "white"),
    "C": ("pen --edge horizon", "832x1216", "white"),
    "D": ("line", "832x1216", "black"),
}
# (main title, main note, backup title, backup note, sub) per family, thirteen each
A = [
    ("SEAHORSE STUDY", "alive, skeleton, fin and snout details", "PIPEFISH STUDY", "", "Marine life · Study sheet"),
    ("LOBSTER STUDY", "alive from above, claw and shell details", "CRAYFISH STUDY", "", "Marine life · Study sheet"),
    ("HORSESHOE CRAB STUDY", "top and underside, tail and leg details", "KING CRAB STUDY", "", "Marine life · Study sheet"),
    ("SWORDFISH STUDY", "alive side view, skeleton, bill details", "MARLIN STUDY", "", "Marine life · Study sheet"),
    ("CUTTLEFISH STUDY", "alive, cuttlebone, eye details", "ARGONAUT STUDY", "shell and animal", "Marine life · Study sheet"),
    ("CHAMELEON STUDY", "on a branch, skull, foot and eye details", "GECKO STUDY", "", "Nature · Study sheet"),
    ("HUMMINGBIRD STUDY", "in flight, skeleton, wing and beak details", "SWALLOW STUDY", "", "Nature · Study sheet"),
    ("STAG BEETLE STUDY", "top view, wing case open, leg details", "RHINOCEROS BEETLE STUDY", "", "Nature · Study sheet"),
    ("TREE FROG STUDY", "on a leaf, skeleton, foot details", "TOAD STUDY", "", "Nature · Study sheet"),
    ("SNAKE STUDY", "coiled, skeleton, head and scale details", "LIZARD STUDY", "with skeleton", "Nature · Study sheet"),
    ("RAVEN STUDY", "perched, skull, feather details", "MAGPIE STUDY", "", "Nature · Study sheet"),
    ("FOX STUDY", "standing side view, skull, paw details", "HARE STUDY", "", "Nature · Study sheet"),
    ("MUSHROOM STUDY", "several kinds, cut sections, spores", "FERN STUDY", "frond, fiddlehead, spores", "Botanical · Study sheet"),
]
B = [
    ("STEAM LOCOMOTIVE", "side elevation, wheels and rods", "TRAM", "side elevation", "Objects · Elevation"),
    ("ZEPPELIN", "side elevation, gondola and frame", "GLIDER", "side elevation", "Objects · Elevation"),
    ("VINTAGE CAR", "side elevation, spoked wheels", "VINTAGE TRUCK", "side elevation", "Objects · Elevation"),
    ("SUBMARINE", "side elevation, periscope and hull plates", "BATHYSPHERE", "on its cable", "Maritime · Elevation"),
    ("BRASS TELESCOPE", "on a tripod mount, side view", "ARMILLARY SPHERE", "on its stand", "Objects · Elevation"),
    ("SPACE ROCKET", "side elevation, stages", "LUNAR LANDER", "side elevation, legs", "Maps & Sky · Elevation"),
    ("VINTAGE MOTORCYCLE", "side elevation", "SCOOTER", "side elevation", "Objects · Elevation"),
    ("TUGBOAT", "side elevation on a waterline", "PADDLE STEAMER", "side elevation", "Maritime · Elevation"),
    ("FERRIS WHEEL", "front elevation, spokes and cabins", "CAROUSEL", "side elevation", "Architecture · Elevation"),
    ("OBSERVATORY", "domed building, section", "WATER TOWER", "elevation", "Architecture · Elevation"),
    ("SUSPENSION BRIDGE", "elevation, towers and cables", "ARCH BRIDGE", "stone, elevation", "Architecture · Elevation"),
    ("VINTAGE TRACTOR", "side elevation", "STEAM ROLLER", "side elevation", "Objects · Elevation"),
    ("CLOCK TOWER", "elevation with a section", "RADIO TOWER", "lattice, elevation", "Architecture · Elevation"),
]
C = [
    ("AMALFI VILLAGE", "houses stacked on a cliff over the sea", "CINQUE TERRE VILLAGE", "", "Places · Town"),
    ("ISTANBUL SKYLINE", "domes and minarets over roofs", "CAIRO MINARETS", "", "Places · Town"),
    ("PARIS ROOFTOPS", "mansard roofs and chimneys", "LONDON ROOFTOPS", "chimney pots", "Places · Town"),
    ("BROWNSTONE STREET", "stoops and fire escapes", "IRON BALCONIES", "French Quarter street", "Places · Street"),
    ("HONG KONG TENEMENTS", "tall blocks, balconies, signs without letters", "TOKYO ALLEY", "lanterns, no letters", "Places · Street"),
    ("PRAGUE OLD TOWN", "spires and gabled houses", "BRUGES GABLES", "stepped gables over a canal", "Places · Town"),
    ("MARKET STREET", "awnings, arches, stalls", "BAZAAR ARCADE", "", "Places · Street"),
    ("EDINBURGH OLD TOWN", "tall stone tenements up a hill", "CASTLE TOWN", "houses below a castle", "Places · Town"),
    ("VALPARAISO HILLS", "houses stacked up steep hills", "HILLSIDE HOUSES", "", "Places · Town"),
    ("COLONIAL CHURCH", "a baroque church front on a plaza", "MISSION CHURCH", "", "Architecture · Town"),
    ("FISHING HARBOUR", "houses round a harbour, boats", "HARBOUR TOWN", "", "Maritime · Town"),
    ("HOUSES ON A BRIDGE", "an old bridge lined with houses", "RIVER TOWN", "houses along a river", "Places · Town"),
    ("TEMPLE STAIRS", "long stone stairs to a temple", "PAGODA GARDEN", "", "Places · Town"),
]
D = [
    ("ACOUSTIC GUITAR STUDY", "body, neck, bridge and tuning pegs", "VIOLIN STUDY", "", "Objects · Study sheet"),
    ("TURNTABLE STUDY", "record player, tonearm, parts", "GRAMOPHONE STUDY", "horn and parts", "Objects · Study sheet"),
    ("MICROSCOPE STUDY", "brass microscope, lenses, parts", "ASTROLABE STUDY", "", "Objects · Study sheet"),
    ("SEXTANT STUDY", "frame, mirrors, arc, parts", "SHIP'S WHEEL STUDY", "", "Maritime · Study sheet"),
    ("TRUMPET STUDY", "valves and tubing, parts", "SAXOPHONE STUDY", "keys and parts", "Objects · Study sheet"),
    ("ESPRESSO MACHINE STUDY", "lever machine, parts", "MOKA POT STUDY", "exploded", "Objects · Study sheet"),
    ("MICROPHONE STUDY", "vintage studio microphone, parts", "RADIO STUDY", "valve radio, no dial numbers", "Objects · Study sheet"),
    ("GLOBE STUDY", "globe on its stand, gears, no lettering", "ORRERY STUDY", "planets on arms", "Maps & Sky · Study sheet"),
    ("TENNIS RACKET STUDY", "wooden racket, strings, ball", "BASEBALL GLOVE STUDY", "", "Objects · Study sheet"),
    ("ROTARY PHONE STUDY", "dial without numbers, handset, parts", "SEWING MACHINE STUDY", "", "Objects · Study sheet"),
    ("HIKING BOOT STUDY", "boot side view, sole, laces", "SNEAKER STUDY", "", "Objects · Study sheet"),
    ("FISHING REEL STUDY", "reel exploded, rod, lures", "FISHING FLY STUDY", "several flies", "Objects · Study sheet"),
    ("KITE STUDY", "diamond kite, frame, tail", "BOOMERANG STUDY", "", "Objects · Study sheet"),
]
LISTS = {"A": A, "B": B, "C": C, "D": D}
ORDER = "ABCD"  # slot 1 = A, 2 = B, 3 = C, 4 = D; helper K takes item K-1 of each list


def slug(title):
    return "".join(c if c.isalnum() else "-" for c in title.lower().replace("'", "")).strip("-").replace("--", "-")


def design(k, slot, which):
    fam = ORDER[slot - 1]
    mt, mn, bt, bn, sub = LISTS[fam][k - 1]
    mode, size, tee = FAMILY[fam]
    title, note = (mt, mn) if which == "main" else (bt, bn)
    edge = mode.split("--edge ")[1].split()[0] if "--edge " in mode else None
    return {"family": fam, "title": title, "note": note, "slug": slug(title), "mode": mode.split()[0], "edge": edge,
            "size": size, "tee": tee, "sub": sub}


def prompts(k):
    path = os.path.join(os.path.dirname(__file__), f"sdxl50-{k}.py")
    spec = importlib.util.spec_from_file_location(f"sdxl50_{k}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.PROMPTS


def jobs(k, slot, which, out, seeds=3):
    d = design(k, slot, which)
    p = " ".join(prompts(k)[slot][which].split())
    n = len(p.split())
    if not 45 <= n <= 90:
        sys.exit(f"helper {k} slot {slot} {which}: {n} words (45-90)")
    base = 30000 + k * 100 + slot * 10 + (0 if which == "main" else 5)
    return [{"out": f"{out}/K{slot}-{d['slug']}-s{base + i}.png", "seed": base + i, "prompt": p, "size": d["size"],
             "helper": k, "slot": slot, "which": which, "words": n, **d} for i in range(seeds)]


if __name__ == "__main__":
    k, slot, which, out = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
    assert which in ("main", "backup")
    slots = range(1, 5) if slot == "all" else [int(slot)]
    print(json.dumps([j for s in slots for j in jobs(k, s, which, out)], indent=1, ensure_ascii=False))
