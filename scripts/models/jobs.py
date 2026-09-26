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
  "standing still on a quiet city sidewalk in soft daylight, hands in his pockets",
  "standing still on a calm city street in warm evening light, hands in his pockets",
  "standing still in a quiet pedestrian passage in soft light, hands in his pockets",
  "standing still on a quiet sidewalk in soft morning light, hands in his pockets",
]
MEN = ["a young man with short brown hair", "a man in his thirties with short dark hair", "a young Black man with short curly hair",
       "an East Asian man with short black hair", "a man in his fifties with short grey hair", "a South Asian man with short dark hair"]
only = int(sys.argv[1]) if len(sys.argv) > 1 else None
jobs = []; k = 0
for color in ["white", "black"]:
    for i, moment in enumerate(MOMENTS):
        man = MEN[k % len(MEN)]; k += 1
        jobs.append({"id": f"life-{color}-{i}", "color": color, "seed": 9100 + k * 31, "steps": 8,
          "prompt": f"straight-on symmetrical photo from directly behind at chest height, {man} {moment}, facing directly away from the camera, head straight, perfectly upright, shoulders level and square to the camera, centred in the frame, whole back visible, wearing a slim-fit plain {color} crew-neck t-shirt, the fabric taut and completely smooth across the back, deep {color} cotton, background softly out of focus, soft natural light, pleasant mood, 50mm"})
if only: jobs = [j for j in jobs if int(j["id"][-1]) < only]
json.dump(jobs, open("jobs.json", "w"), indent=1); print(len(jobs))
