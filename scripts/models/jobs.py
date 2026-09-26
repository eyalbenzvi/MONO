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
  "walking away down a quiet city street in warm evening light, both hands tucked in his front jeans pockets, elbows out",
  "standing relaxed with both hands tucked in his front jeans pockets, elbows out, facing a softly blurred city skyline at dusk",
  "walking away through a calm sunlit pedestrian passage, holding a coffee cup in one hand, other hand in pocket",
  "walking away along a quiet sidewalk in soft morning light, a tote bag in one hand",
]
MEN = ["a young man with short brown hair", "a man in his thirties with short dark hair", "a young Black man with short curly hair",
       "an East Asian man with short black hair", "a man in his fifties with short grey hair", "a South Asian man with short dark hair"]
only = int(sys.argv[1]) if len(sys.argv) > 1 else None
jobs = []; k = 0
for color in ["white", "black"]:
    for i, moment in enumerate(MOMENTS):
        man = MEN[k % len(MEN)]; k += 1
        jobs.append({"id": f"life-{color}-{i}", "color": color, "seed": 9100 + k * 31, "steps": 8,
          "prompt": f"photo from directly behind, {man} {moment}, head facing forward away from the camera, shoulders square to the camera, whole back visible, wearing a smooth fitted plain {color} crew-neck t-shirt without wrinkles, pure {color} cotton, background softly out of focus, warm natural light, pleasant mood, 50mm"})
if only: jobs = [j for j in jobs if int(j["id"][-1]) < only]
json.dump(jobs, open("jobs.json", "w"), indent=1); print(len(jobs))
