"""
The model photos to generate (see generate.py): pleasant, candid shots
from directly behind — a relaxed man walking away or standing easy, hands
in his pockets or holding something (never pressed to his sides), shoulders
square to the camera so the whole back shows, a smooth fitted tee (a
wrinkled back hides the print), soft warm light, a quiet city background
softly out of focus. The tee is the subject.
"""
import json, sys
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
if only: jobs = [j for j in jobs if j["id"] in sys.argv[2:]] if len(sys.argv) > 2 else jobs[:only]
json.dump(jobs, open("jobs.json", "w"), indent=1); print(len(jobs))
