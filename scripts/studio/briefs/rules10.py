"""
Ten designs under the new rules (scripts/studio/briefs/rules.md): sixteen candidates, eight helpers with two
each, for the five designers to approve the best ten. All made with SDXL (scripts/studio/generate_sdxl.py),
converted with oneink.py --mode engrave. At most two of a family (rules.md, section 1).

  python3 scripts/studio/briefs/rules10.py <K> <slot|all> <main|backup> <out-dir> > jobs.json
  python3 scripts/studio/generate_sdxl.py --jobs jobs.json

Each design: (title, family, shop category, oneink options, main prompt, backup title, backup prompt).
The prompts are written here (45-90 words, the exclusions in the first sentence: Lightning has no negative).
"""
import json, sys

PAPER = "plain white paper, no text, no lettering, no numbers, no frame, no border, no colour"
ENGRAVE = "Pure black ink line engraving, crisp cross-hatching, no grey shading, no cast shadow"
OUTLINE = "Clean black outline drawing, one even line weight, no shading, no hatching masses, no cast shadow"

DESIGNS = {
    1: [
        ("HUMPBACK WHALE", "sea-life", "Botanical & Nature", "--sub 'Megaptera novaeangliae' --view 'Diving'",
         f"One humpback whale diving straight down, seen from the side, on {PAPER}. The whole whale vertical, tail flukes up "
         f"at the top, long knobbly pectoral fins, throat grooves, small eye, barnacles on the jaw. {ENGRAVE}, natural history "
         "plate. Centred, the entire animal inside wide white margins.",
         "SPERM WHALE",
         f"One sperm whale diving straight down, seen from the side, on {PAPER}. The whole whale vertical, tail flukes up at "
         f"the top, huge square head at the bottom, small jaw, wrinkled skin. {ENGRAVE}, natural history plate. Centred, the "
         "entire animal inside wide white margins."),
        ("NAUTILUS", "sea-life", "Botanical & Nature", "--sub 'Nautilus pompilius' --view 'Shell in section' --views 1",
         f"One chambered nautilus shell cut in half, showing the spiral of pearly chambers inside, on {PAPER}. A single large "
         f"shell, the chambers growing in a perfect spiral, thin walls between them, the outer lip smooth. {ENGRAVE}, natural "
         "history plate. Centred with wide white margins.",
         "AMMONITE",
         f"One ammonite fossil shell, flat side view, on {PAPER}. A single large spiral shell with strong ribs curving outward, "
         f"the coils tightening to the centre. {ENGRAVE}, natural history plate. Centred with wide white margins."),
    ],
    2: [
        ("GAFF CUTTER", "ships", "Engravings", "--outline --view 'Sail plan' --plate 'Pl. I'",
         f"One gaff-rigged sailing cutter, side elevation, on {PAPER}. A single wooden sailing boat facing right, tall mast, "
         f"gaff mainsail, two headsails on a long bowsprit, all rigging lines, the hull and keel below a thin waterline. {OUTLINE}, "
         "naval architect's sail plan. Centred, the whole boat inside wide white margins.",
         "SAILING KETCH",
         f"One two-masted sailing ketch, side elevation, on {PAPER}. A single wooden sailing boat facing right, main mast and "
         f"smaller mizzen mast, triangular sails, rigging lines, hull and keel below a thin waterline. {OUTLINE}, naval "
         "architect's sail plan. Centred with wide white margins."),
        ("PENNY-FARTHING", "vehicles", "Engravings", "--outline --view 'Side elevation' --plate 'Pl. II'",
         f"One penny-farthing bicycle, side elevation, on {PAPER}. A single high-wheel bicycle facing right, one huge front "
         f"wheel with thin spokes, one tiny rear wheel, curved backbone, saddle on top, handlebar and pedals on the front hub. "
         f"{OUTLINE}, patent drawing. Centred, the whole bicycle inside wide white margins.",
         "TANDEM BICYCLE",
         f"One vintage tandem bicycle, side elevation, on {PAPER}. A single long bicycle for two riders facing right, two "
         f"saddles, two sets of pedals, two spoked wheels, chain. {OUTLINE}, patent drawing. Centred with wide white margins."),
    ],
    3: [
        ("HOT AIR BALLOON", "aircraft", "Engravings", "--outline --view 'Elevation' --plate 'Pl. III'",
         f"One hot air balloon, front elevation, on {PAPER}. A single tall balloon envelope made of vertical gores, net of "
         f"ropes, a small wicker basket hanging below on lines, a burner frame. {OUTLINE}, patent drawing. Centred, the whole "
         "balloon and basket inside wide white margins.",
         "AIRSHIP GONDOLA",
         f"One early airship, side elevation, on {PAPER}. A single long cigar-shaped envelope with fins at the tail, a small "
         f"gondola hanging below on cables, a propeller. {OUTLINE}, patent drawing. Centred with wide white margins."),
        ("SCOOTER", "vehicles", "Engravings", "--outline --view 'Side elevation' --plate 'Pl. IV'",
         f"One 1950s Italian motor scooter, side elevation, on {PAPER}. A single scooter facing right, rounded steel body, "
         f"small wheels, step-through floor, curved front shield, handlebar with a round headlamp, saddle. {OUTLINE}, patent "
         "drawing. Centred, the whole scooter inside wide white margins.",
         "VINTAGE MOPED",
         f"One vintage moped, side elevation, on {PAPER}. A single light motorbike facing right, pedals, small engine, thin "
         f"frame, two spoked wheels, round headlamp. {OUTLINE}, patent drawing. Centred with wide white margins."),
    ],
    4: [
        ("COLONIAL HOUSE", "buildings", "Architecture", "--edge dissolve",
         f"One old two-storey colonial house with a deep veranda, front view, on {PAPER}. Wooden columns, louvred shutters, "
         f"a balcony with railings, a tiled roof, tall palm trees and plants around it. {ENGRAVE}, dense pen and ink, every "
         "window and leaf drawn. The scene centred and fading out at its edges into white paper.",
         "PLANTATION VERANDA",
         f"One tropical villa with a wide veranda and arched windows, front view, on {PAPER}. Columns, shutters, potted plants, "
         f"two palm trees. {ENGRAVE}, dense pen and ink. The scene centred and fading out at its edges into white paper."),
        ("LIGHTHOUSE", "buildings", "Architecture", "--view 'Elevation' --plate 'Pl. V'",
         f"One tall stone lighthouse on a rock, front elevation, on {PAPER}. A single tapering tower of stone courses, small "
         f"windows, a gallery with railings near the top, the glazed lantern room and a domed cap, the keeper's door at the "
         f"base. {ENGRAVE}, architect's elevation. Centred with wide white margins.",
         "WATER MILL",
         f"One old stone water mill with a large wooden water wheel, front view, on {PAPER}. Stone walls, a tiled roof, "
         f"small windows, the wheel at the side. {ENGRAVE}, architect's elevation. Centred with wide white margins."),
    ],
    5: [
        ("STAG BEETLE", "insects", "Botanical & Nature", "--sub 'Lucanus cervus' --view 'Dorsal view'",
         f"One stag beetle seen from directly above, on {PAPER}. A single large male beetle, symmetrical, six jointed legs "
         f"from the middle body, two long branched jaws like antlers, smooth wing cases, short elbowed antennae. {ENGRAVE}, "
         "entomology plate. Centred with wide white margins.",
         "RHINOCEROS BEETLE",
         f"One rhinoceros beetle seen from directly above, on {PAPER}. A single large beetle, symmetrical, six jointed legs, "
         f"one long curved horn, smooth wing cases. {ENGRAVE}, entomology plate. Centred with wide white margins."),
        ("LUNA MOTH", "insects", "Botanical & Nature", "--sub 'Actias luna' --view 'Wings spread'",
         f"One luna moth with its wings spread flat, seen from above, on {PAPER}. A single moth, symmetrical, four broad "
         f"wings with eye spots, two long curving tails on the hind wings, feathery antennae, furry body. {ENGRAVE}, "
         "entomology plate. Centred with wide white margins.",
         "SWALLOWTAIL",
         f"One swallowtail butterfly with its wings spread flat, seen from above, on {PAPER}. Symmetrical, striped wings, "
         f"long tails on the hind wings, thin antennae. {ENGRAVE}, entomology plate. Centred with wide white margins."),
    ],
    6: [
        ("AGAVE", "plants", "Botanical & Nature", "--sub 'Agave americana' --view 'Habit'",
         f"One agave plant, side view, on {PAPER}. A single large rosette of thick pointed leaves with spiny edges, the leaves "
         f"curving outward, the base in a little ground. {ENGRAVE}, botanical plate. Centred with wide white margins.",
         "ALOE",
         f"One aloe plant, side view, on {PAPER}. A single rosette of thick toothed leaves with a tall flower spike. "
         f"{ENGRAVE}, botanical plate. Centred with wide white margins."),
        ("SUNFLOWER", "plants", "Botanical & Nature", "--sub 'Helianthus annuus' --view 'Flower and leaf'",
         f"One sunflower, front view of the flower head on its stem, on {PAPER}. A single large flower, the seeds in a "
         f"spiral pattern, long petals around, a thick stem with two big heart-shaped leaves. {ENGRAVE}, botanical plate. "
         "Centred with wide white margins.",
         "ARTICHOKE FLOWER",
         f"One artichoke on its stem, side view, on {PAPER}. A single globe of overlapping scales opening into a thistle "
         f"flower, a few spiky leaves. {ENGRAVE}, botanical plate. Centred with wide white margins."),
    ],
    7: [
        ("POCKET WATCH", "instruments", "Engravings", "--outline --view 'Front view' --plate 'Pl. VI'",
         f"One antique pocket watch, front view, lid open, on {PAPER}. A single round watch, a plain dial with twelve small "
         f"tick marks and no numbers, two hands, the crown and ring at the top, the hinged lid behind, a short chain. "
         f"{OUTLINE}, patent drawing. Centred with wide white margins.",
         "COMPASS",
         f"One brass pocket compass, front view, lid open, on {PAPER}. A round case, a compass rose with no letters, a needle, "
         f"the hinged lid. {OUTLINE}, patent drawing. Centred with wide white margins."),
        ("RANGEFINDER CAMERA", "objects", "Engravings", "--outline --view 'Front elevation' --plate 'Pl. VII'",
         f"One 1930s rangefinder camera, front view, on {PAPER}. A single small rectangular camera body, a round lens barrel "
         f"in the middle, two small rangefinder windows above it, a shutter dial and a winding knob on top, no logo. "
         f"{OUTLINE}, patent drawing. Centred, large, with white margins.",
         "FOLDING CAMERA",
         f"One vintage folding camera, front view, bellows open, on {PAPER}. A small body, pleated bellows, the lens on a "
         f"front standard, no logo. {OUTLINE}, patent drawing. Centred with white margins."),
    ],
    8: [
        ("RED DEER", "animals", "Botanical & Nature", "--sub 'Cervus elaphus' --view 'Side view'",
         f"One red deer stag standing, side view, on {PAPER}. A single animal facing left, large branching antlers, four "
         f"slim legs with hooves, a shaggy neck, short tail, standing on a little ground. {ENGRAVE}, natural history plate. "
         "Centred, the whole animal inside wide white margins.",
         "IBEX",
         f"One alpine ibex standing on a rock, side view, on {PAPER}. A single animal facing left, long curved ridged horns, "
         f"four legs with hooves, a short beard. {ENGRAVE}, natural history plate. Centred with wide white margins."),
        ("GREY HERON", "animals", "Botanical & Nature", "--sub 'Ardea cinerea' --view 'Standing'",
         f"One grey heron standing in shallow water, side view, on {PAPER}. A single tall bird facing left, long S-curved "
         f"neck, dagger beak, black crest plume, folded wings, two long thin legs, a few reeds. {ENGRAVE}, natural history "
         "plate. Centred, the whole bird inside wide white margins.",
         "WHITE STORK",
         f"One white stork standing, side view, on {PAPER}. A single tall bird facing left, long straight beak, long legs, "
         f"folded wings with dark flight feathers. {ENGRAVE}, natural history plate. Centred with wide white margins."),
    ],
}


def slug(title):
    return "".join(c if c.isalnum() else "-" for c in title.lower().replace("'", "")).strip("-").replace("--", "-")


def jobs(k, slot, which, out, seeds=3):
    title, family, category, opts, main, btitle, backup = DESIGNS[k][slot - 1]
    t, p = (title, main) if which == "main" else (btitle, backup)
    p = " ".join(p.split())
    n = len(p.split())
    if not 45 <= n <= 90:
        sys.exit(f"helper {k} slot {slot} {which}: {n} words (45-90)")
    base = 40000 + k * 100 + slot * 10 + (0 if which == "main" else 5)
    return [{"out": f"{out}/K{slot}-{slug(t)}-s{base + i}.png", "seed": base + i, "prompt": p, "size": "832x1216",
             "helper": k, "slot": slot, "which": which, "title": t, "slug": slug(t), "family": family,
             "category": category, "oneink": opts} for i in range(seeds)]


if __name__ == "__main__":
    k, slot, which, out = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
    assert which in ("main", "backup")
    slots = range(1, 3) if slot == "all" else [int(slot)]
    print(json.dumps([j for s in slots for j in jobs(k, s, which, out)], indent=1, ensure_ascii=False))
