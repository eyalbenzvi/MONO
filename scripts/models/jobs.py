"""
The model photos to generate (see generate.py): pleasant, candid shots
from directly behind — a relaxed man walking away or standing easy, hands
in his pockets or holding something (never pressed to his sides), shoulders
square to the camera so the whole back shows, a smooth fitted tee (a
wrinkled back hides the print), soft warm light, a quiet city background
softly out of focus. The tee is the subject.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from poses import ARMS
MOMENTS = [
  "standing still, hands in pockets",
  "standing still at dusk, hands in pockets",
  "standing still in a passage, hands in pockets",
  "standing still in the morning, hands in pockets",
]
MEN = ["a young man with short brown hair", "a man in his thirties with short dark hair", "a young Black man with short curly hair",
       "an East Asian man with short black hair", "a man in his fifties with short grey hair", "a South Asian man with short dark hair"]
only = int(sys.argv[1]) if len(sys.argv) > 1 else None
# White tees only: the model gets them right first time; analyze.py makes
# each one's black-tee twin by darkening the tee (the photos are greyscale),
# so every pose comes in both colours and no black tee comes out grey.
jobs = []
for i, man in enumerate(MEN):
    moment = MOMENTS[i % len(MOMENTS)]
    jobs.append({"id": f"m{i:02d}", "color": "white", "seed": 9100 + i * 31, "steps": 8, "pose": 0,
      # The model reads only ~75 tokens: the tee first, the rest short.
      "prompt": f"plain white short-sleeved t-shirt, smooth taut fabric, back view, {man} {moment}, dark jeans, relaxed arms, straight-on from directly behind, symmetrical, shoulders level, head straight, blurred quiet street, soft light, photo"})
# More models: same pose, a different man, build and quiet urban scene each.
MORE = [
  ("a stocky broad-shouldered man with a shaved head", "blurred concrete plaza"),
  ("a tall slim man with short wavy hair", "blurred underpass, soft light"),
  ("a muscular man with short black hair and a short beard", "blurred plain stone steps"),
  ("a lean young man with short curly red hair", "blurred empty loft with a large window"),
  # A second set: other hair, fuller builds, different heights.
  ("a chubby heavyset man with shoulder-length hair tied back", "blurred grey metro station"),
  ("a middle-aged man with a receding hairline and a round belly", "blurred quiet parking garage"),
  ("a young man with short spiky dyed blond hair, slim", "blurred brutalist concrete wall"),
  ("a very tall broad man with long straight dark hair to his shoulders", "blurred glass office lobby"),
]
for k, (man, scene) in enumerate(MORE):
    i = len(MEN) + k
    jobs.append({"id": f"m{i:02d}", "color": "white", "seed": 9100 + i * 31, "steps": 8, "pose": 0,
      "prompt": f"plain white short-sleeved t-shirt, smooth taut fabric, back view, {man} standing still, dark jeans, relaxed arms, straight-on from directly behind, symmetrical, shoulders level, head straight, {scene}, soft light, photo"})
# The third set: what looked off in the first two, fixed. They all stood in one
# stiff mirror-symmetric pose with drawn hands (dark blobs at the hips), slim
# and narrow-hipped, in a taut, flattened tee. These stand in natural stances
# (poses.py: wider shoulders and hips, no hand keypoints), fuller builds, a
# smooth tee — half oversized, half a regular fit — and each his own hair,
# trousers and — some — tattooed forearms.
# Half wear it oversized, half closer (a regular fit, not tight): both smooth, so the print reads.
TEES = ["regular fit plain white t-shirt, smooth ironed fabric", "oversized plain white t-shirt, smooth ironed fabric"]
NATURAL = "candid 35mm photo, natural skin, soft daylight"
THIRD = [
  # (man, trousers, pose, scene)
  ("a man in his thirties with a soft belly and messy brown hair, full sleeve tattoos on both forearms", "black jeans", 1, "blurred quiet brick street"),
  ("a stocky broad man with a buzz cut and a short beard", "olive cargo pants", 2, "blurred concrete plaza"),
  ("a heavyset young Black man with a round afro", "charcoal chinos", 1, "blurred tiled underpass"),
  ("a big tall man with a man bun, a dragon tattoo on his right forearm", "mid-blue jeans", 4, "blurred glass shopfronts"),
  ("a sturdy middle-aged man with grey hair in a low ponytail", "dark grey trousers", 2, "blurred stone arcade"),
  ("a young man of average build with shoulder-length dreadlocks", "black trousers", 3, "blurred metro platform"),
  ("a chubby man with a mullet, small tattoos on both forearms", "faded dark jeans", 3, "blurred parking garage"),
  ("a sturdy East Asian man with medium-length straight black hair", "dark cargo pants", 4, "blurred quiet alley at dusk"),
]
# Under CLIP's 77 tokens, most important first.
NEG_THIRD = ("wrinkled shirt, creased, crumpled, skinny, thin, narrow shoulders, plastic skin, waxy, doll, mannequin, cgi, 3d render, "
  "face, profile, side view, looking at camera, long sleeves, jacket, hoodie, white pants, shorts, "
  "logo, print, text, pattern, grey shirt, deformed, extra arms")
for k, (man, trousers, pose, scene) in enumerate(THIRD):
    i = len(MEN) + len(MORE) + k
    jobs.append({"id": f"m{i:02d}", "color": "white", "seed": 7300 + i * 37, "steps": 8, "pose": pose, "guidance": 1.8, "neg": NEG_THIRD, "min_tone": 0.52,
      "prompt": f"{TEES[k % 2]}, back view, {man}, {trousers}, from behind, {scene}, {NATURAL}"})
# The fourth set: pictures that sell — a fashion lookbook, not a snapshot.
# Upright and at ease (shoulders back, arms loose at the sides, at most a
# slight shift of weight; no hands in pockets, nothing held), a good heavy
# cotton tee lying smooth, groomed hair, soft directional light, and clean,
# varied settings instead of the same grey passage.
LOOKBOOK = "fashion lookbook photo, 85mm, soft overcast light"
# A thick cotton hangs smooth over the back (a thin one shows every shoulder blade).
TEES4 = ["thick heavyweight plain white short-sleeved cotton t-shirt, regular fit, smooth drape", "thick heavyweight plain white short-sleeved cotton t-shirt, boxy relaxed fit, smooth drape"]
FOURTH = [
  # (man, trousers, pose, setting) — real places, each different; never a bare wall.
  ("a well-built man with neat short brown hair, tattooed forearms", "black jeans", 1, "busy shopping street, blurred shopfronts"),
  ("a broad solid man with a clean buzz cut and short beard", "olive chinos", 4, "seaside promenade, blurred sea"),
  ("a broad-shouldered Black man with a neat high-top fade", "charcoal trousers", 1, "city park with trees, soft bokeh"),
  ("a tall solid man with his hair in a neat man bun, a tattoo on one forearm", "mid-blue jeans", 4, "rooftop terrace, city skyline at dusk"),
  ("a sturdy silver-haired man in his fifties, neatly combed", "dark grey trousers", 1, "old town cobbled square, cafes"),
  ("a well-built young man with neat shoulder-length locs", "black trousers", 4, "harbour with boats, blurred"),
  ("a stocky man with a tidy textured crop, small forearm tattoos", "dark jeans", 1, "farmers market, blurred stalls"),
  ("a solid East Asian man with neat medium-length black hair", "stone-coloured chinos", 4, "mountain lookout, hazy valley"),
]
NEG_FOURTH = ("tank top, sleeveless, shoulder blades, bony back, thin fabric, harsh shadows, wrinkled shirt, slouching, hands in pockets, holding bag, skinny, "
  "plastic skin, doll, cgi, face, profile, side view, looking at camera, jacket, hoodie, white pants, shorts, logo, print, text, grey shirt, deformed")
for k, (man, trousers, pose, setting) in enumerate(FOURTH):
    i = len(MEN) + len(MORE) + len(THIRD) + k
    jobs.append({"id": f"m{i:02d}", "color": "white", "seed": 5100 + i * 41, "steps": 8, "pose": pose, "guidance": 1.8, "neg": NEG_FOURTH, "min_tone": 0.52,
      "prompt": f"{TEES4[k % 2]}, back view, {man}, standing upright, shoulders back, {trousers}, {setting}, {LOOKBOOK}"})
    if k == 6: jobs[-1]["seed"] += 1000  # the first seed gave a tank top (the shop sells tees only)
    if k == 3: jobs[-1]["lower"] = 60  # the bun was cut off at the top edge: the man stands lower in the picture
# The fifth set: the lookbook recipe, with more variety — ages, origins,
# builds, hair, trousers, three upright stances, sixteen different places.
FIFTH = [
  # (man, trousers, pose, setting)
  ("a broad Latino man in his thirties with a curly top and faded sides, a forearm sleeve tattoo", "black jeans", 1, "neon-lit city street at night, blurred"),
  ("a tall athletic Nordic man with a blond undercut", "navy chinos", 4, "lakeside wooden pier, calm water"),
  ("a solid Middle Eastern man with slicked-back dark hair and a trimmed beard", "charcoal trousers", 5, "sunny Mediterranean harbour, blurred"),
  ("a big tall Pacific Islander man with long wavy hair tied back in a low bun", "olive cargo pants", 1, "beach boardwalk, soft evening light"),
  ("a well-built Black man with neat cornrows, tattoos on both forearms", "raw denim jeans", 4, "old stone bridge over a river"),
  ("a stocky red-haired man with a short neat beard", "brown corduroy trousers", 5, "forest path on an overcast day"),
  ("a fit South Asian man in his forties with a neat side part", "stone chinos", 1, "vineyard rows in soft evening light"),
  ("a broad bald man in his fifties with a grey beard", "dark jeans", 4, "industrial loft with big windows"),
  ("a well-built young East Asian man with curtain hair", "black cargo pants", 5, "skate park at golden hour"),
  ("a solid mixed-race man with a short afro, a small tattoo on one forearm", "navy trousers", 1, "canal with bikes and old houses"),
  ("an athletic man in his twenties with long straight brown hair", "charcoal jeans", 4, "desert road, wide sky"),
  ("a broad grey-haired man in his sixties with a neat buzz cut", "olive chinos", 5, "botanical glasshouse, lush plants"),
  ("a well-built man with short twisted locs, tattooed forearms", "black trousers", 1, "sports field on a bright afternoon"),
  ("a sturdy man with a neat quiff and full beard", "mid-blue jeans", 4, "snowy mountain village, soft light"),
  ("a fit Latino man with wavy shoulder-length hair", "dark grey chinos", 5, "flower market, blurred stalls"),
  ("a broad-shouldered young man with a clean crew cut, a tattoo on his upper arm", "black jeans", 1, "rooftop garden, city behind"),
]
for k, (man, trousers, pose, setting) in enumerate(FIFTH):
    i = len(MEN) + len(MORE) + len(THIRD) + len(FOURTH) + k
    jobs.append({"id": f"m{i:02d}", "color": "white", "seed": 4100 + i * 43, "steps": 8, "pose": pose, "guidance": 1.8, "neg": NEG_FOURTH, "min_tone": 0.52,
      "prompt": f"{TEES4[k % 2]}, back view, {man}, standing upright, shoulders back, {trousers}, {setting}, {LOOKBOOK}"})
    if k in (3, 12): jobs[-1]["seed"] += 500  # retried: loose hair over the back; a backlit, dark tee
    if k == 9: jobs[-1]["lower"] = 60  # the afro was cut off at the top edge: the man stands lower in the picture
    if k == 5:  # golden autumn light turned every try beige: another seed, the white said twice
        jobs[-1]["seed"] += 1000
        jobs[-1]["prompt"] = jobs[-1]["prompt"].replace("plain white", "bright pure white")
# The sixth set and on: relaxed, varied arms (the lookbook stances all stood arms-down, nearly at attention).
# Each photo takes a relaxed pose (poses.py: pose-g … pose-l) with its arms said in the prompt; a set uses them all.
# (man, trousers, pose name, setting) — fill in and run; ids continue after the fifth set.
# Shorter than TEES4: the arms take words, and CLIP reads 77 tokens.
TEES6 = ["heavyweight plain white short-sleeved cotton t-shirt, smooth", "heavyweight plain white short-sleeved cotton t-shirt, boxy fit, smooth"]
SIXTH = [
  ("a well-built man with a taper fade and short beard", "dark jeans", "pose-g", "city sidewalk with cafes, blurred"),
  ("a broad young Black man with short neat twists, tattooed forearms", "black chinos", None, "art gallery with paintings, blurred"),
  ("a solid man with short salt-and-pepper hair", "navy trousers", "pose-i", "seaside cliff path, blue sea, overcast"),
  ("a stocky East Asian man with a short textured fringe", "olive chinos", None, "train station platform, blurred"),
  ("a tall athletic Latino man with a neat buzz cut, a forearm tattoo", "mid-blue jeans", "pose-k", "tree-lined city park path"),
  ("a well-built red-haired man with a tidy crop and short beard", "charcoal jeans", None, "bookshop street, blurred"),
]
NEG_SIXTH = ("tank top, sleeveless, shoulder blades, bony back, thin fabric, harsh shadows, wrinkled shirt, slouching, stiff pose, standing at attention, "
  "military posture, arms straight down, skinny, plastic skin, cgi, face, profile, looking at camera, jacket, hoodie, white pants, shorts, logo, print, text, grey shirt, deformed")
POSE_NAMES = sorted(f[:-4] for f in os.listdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "poses")))  # generate.py's order
for k, (man, trousers, pose, setting) in enumerate(SIXTH):
    i = len(MEN) + len(MORE) + len(THIRD) + len(FOURTH) + len(FIFTH) + k
    if pose is None: continue  # thrown away with its pose (poses.py); the id is not reused
    assert pose in ARMS, f"m{i:02d}: {pose} is an arms-down stance (looks like standing at attention); take a relaxed one: {', '.join(ARMS)}"
    jobs.append({"id": f"m{i:02d}", "color": "white", "seed": 3100 + i * 47, "steps": 8, "pose": POSE_NAMES.index(pose), "pose_name": pose, "guidance": 1.8, "neg": NEG_SIXTH, "min_tone": 0.52,
      "prompt": f"{TEES6[k % 2]}, back view, {man}, {ARMS[pose]}, {trousers}, {setting}, lookbook photo, soft overcast light"})
# The seventh set: the approved relaxed poses in turn, dark or mid trousers (light ones break the black twin's hem),
# tall hair standing lower in the picture (`lower`), sixteen different people and places.
SEVENTH = [
  # (man, trousers, pose name, setting, lower)
  ("a broad man in his thirties with a neat side part", "charcoal chinos", "pose-g", "cobbled old town lane with cafes, blurred", 0),
  ("a tall Black man with a short high-top fade, tattooed forearms", "black jeans", "pose-i", "modern glass atrium, blurred", 60),
  ("a solid East Asian man with a clean undercut", "navy trousers", "pose-k", "autumn park avenue, blurred", 0),
  ("a stocky bearded man with a shaved head", "dark jeans", "pose-g", "fish market pier, blurred", 0),
  ("a well-built Latino man with short curly hair", "olive chinos", "pose-i", "whitewashed hillside village, blurred", 0),
  ("a broad young man with a blond crew cut, a forearm tattoo", "black chinos", "pose-k", "university courtyard with arches", 0),
  ("a solid South Asian man with neat wavy hair", "dark grey jeans", "pose-g", "botanical garden path, blurred", 0),
  ("a tall man with a high curly afro", "navy chinos", "pose-i", "tram stop on a city street, blurred", 60),
  ("a well-built man in his fifties with short grey hair and beard", "charcoal jeans", "pose-k", "harbour promenade with boats", 0),
  ("a broad Middle Eastern man with a neat quiff", "black trousers", "pose-g", "covered market arcade, blurred", 0),
  ("a stocky red-haired man with a buzz cut, tattooed forearms", "mid-blue jeans", "pose-i", "pine forest trail, soft light", 0),
  ("a solid Pacific Islander man with a tied-back bun", "dark olive cargo pants", "pose-k", "palm-lined beach road, blurred", 60),
  ("a well-built young Black man with neat short twists", "charcoal trousers", "pose-g", "brick warehouse district, blurred", 0),
  ("a broad Nordic man with a short beard and swept-back hair", "navy jeans", "pose-i", "snowy mountain town square", 0),
  ("a fit man in his forties with a short textured crop", "dark brown chinos", "pose-k", "vineyard hills path, blurred", 0),
  ("a stocky East Asian man with short spiky hair", "black jeans", "pose-g", "neon-lit alley at night, blurred", 0),
]
# Thrown away, all sixteen: the hand-on-hip pose came out as a hand pushed behind the back, and hands were
# deformed in nearly every photo (drawn without hand keypoints, SD 1.5 at this size can't be trusted with visible hands).
SEVENTH_REJECTED = True
for k, (man, trousers, pose, setting, lower) in enumerate([] if SEVENTH_REJECTED else SEVENTH):
    i = len(MEN) + len(MORE) + len(THIRD) + len(FOURTH) + len(FIFTH) + len(SIXTH) + k
    jobs.append({"id": f"m{i:02d}", "color": "white", "seed": 2100 + i * 53, "steps": 8, "pose": POSE_NAMES.index(pose), "pose_name": pose, "guidance": 1.8, "neg": NEG_SIXTH, "min_tone": 0.52,
      "prompt": f"{TEES6[k % 2]}, back view, {man}, {ARMS[pose]}, {trousers}, {setting}, lookbook photo, soft overcast light", **({"lower": lower} if lower else {})})
if only: jobs = [j for j in jobs if j["id"] in sys.argv[2:]] if len(sys.argv) > 2 else jobs[:only]
# Prompt rules learnt from thrown-away photos (the lookbook sets and on):
# light that tints or darkens the tee, loose hair over the back, sleeveless tops.
BAD_LIGHT = ("sunset", "dusk", "golden", "backlit", "sunrise")
RULES_FROM = len(MEN) + len(MORE) + len(THIRD) + len(FOURTH) + len(FIFTH)  # new sets from here on (the photos before are kept as they are)
for j in jobs:
    if int(j["id"][1:]) < RULES_FROM: continue
    p = j["prompt"].lower()
    assert not any(b in p for b in BAD_LIGHT), f"{j['id']}: light that tints or darkens a white tee ({p})"
    assert not ("long" in p and "hair" in p and not any(t in p for t in ("tied", "bun", "ponytail"))), f"{j['id']}: long hair must be tied back (it falls over the print)"
    assert "short-sleeved" in p, f"{j['id']}: say short-sleeved (else tank tops)"
    assert j.get("pose_name") in ARMS and ARMS[j["pose_name"]].lower() in p, f"{j['id']}: a relaxed pose with its arms in the prompt (arms-down stances look like standing at attention)"
# Varied: a set spreads over the relaxed poses (no pose twice before all have been used).
new = [j["pose_name"] for j in jobs if int(j["id"][1:]) >= RULES_FROM]
for a in range(0, len(new), len(ARMS)):
    assert len(set(new[a : a + len(ARMS)])) == len(new[a : a + len(ARMS)]), f"poses repeat before all are used: {new}"
json.dump(jobs, open("jobs.json", "w"), indent=1); print(len(jobs))
