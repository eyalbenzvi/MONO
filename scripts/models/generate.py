"""
Model photos (T2): men photographed from behind in a plain white or black
tee, in scenes matched to each category (jobs.py writes the list). Run by
hand on any machine (CPU is fine, ~1 min a photo):

  pip install torch diffusers transformers accelerate safetensors peft
  python scripts/models/jobs.py && python scripts/models/generate.py jobs.json <out-dir>
  python scripts/models/analyze.py <out-dir> jobs.json

Model: Realistic Vision 5.1 (CreativeML OpenRAIL-M) with the sd-vae-ft-mse
VAE and the LCM LoRA (6 steps). These are generated images, not photos of
real people; the site says so (About).
"""
import sys, time, json, os, torch
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel, AutoencoderKL, LCMScheduler
from PIL import Image
torch.set_num_threads(4)
vae = AutoencoderKL.from_pretrained("stabilityai/sd-vae-ft-mse", torch_dtype=torch.float32)
# The pose is locked (ControlNet OpenPose): every photo stands the same natural,
# straight-on way (poses/*.png, skeletons taken from approved photos), so
# every generation comes out usable; the prompt only varies the man and the street.
controlnet = ControlNetModel.from_pretrained("lllyasviel/sd-controlnet-openpose", torch_dtype=torch.float32)
pipe = StableDiffusionControlNetPipeline.from_pretrained("SG161222/Realistic_Vision_V5.1_noVAE", vae=vae, controlnet=controlnet, torch_dtype=torch.float32, safety_checker=None)
POSES = [Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "poses", f)).convert("RGB") for f in sorted(os.listdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "poses")))]

def pose_for(j):
    """The job's pose skeleton; "lower": moved down that many pixels, for tall hair (a bun or an afro came out cut off at the top)."""
    pose = POSES[j.get("pose", 0) % len(POSES)]
    if not j.get("lower"): return pose
    moved = Image.new("RGB", pose.size)
    moved.paste(pose, (0, j["lower"]))
    return moved
pipe.load_lora_weights("latent-consistency/lcm-lora-sdv1-5"); pipe.fuse_lora()
pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
jobs = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
NEG = "white pants, white shorts, light trousers, arms pressed to body, long sleeves, sweater, jacket, hoodie, angle, perspective, three-quarter view, side view, head turned, turned body, leaning, arms hanging at sides, hands at sides, face, profile, head turned, dark grey shirt, charcoal shirt, wrinkled shirt, creases, folds, baggy shirt, loose shirt, twisted torso, turning around, face, looking at camera, front view, stiff pose, arms pressed to sides, standing against a wall, mugshot, symmetrical pose, grey shirt, logo, print, graphic, text, letters, pattern, stripes, drawing on shirt, deformed, extra arms, extra fingers, cartoon, 3d render, painting, blurry shirt, watermark, crowd, cars, signs, graffiti"
# Every lesson from a thrown-away photo is checked on each try (checks.py), so
# a bad one is retried with the next seed at once, never found later.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from checks import measure, reason
from rembg import new_session
person_session = new_session("isnet-general-use")
# CLIP reads 77 tokens; anything past that is silently dropped — refuse instead.
for j in jobs:
    for text in (j["prompt"], j.get("neg", NEG)):
        n = len(pipe.tokenizer(text)["input_ids"])
        if n > pipe.tokenizer.model_max_length: raise SystemExit(f"{j['id']}: {n} tokens, over {pipe.tokenizer.model_max_length}: {text[:60]}…")
for j in jobs:
    f = os.path.join(out, j["id"] + ".png")
    if os.path.exists(f): continue
    t = time.time()
    for attempt in range(8):
        img = pipe(j["prompt"], image=pose_for(j), controlnet_conditioning_scale=0.9, negative_prompt=j.get("neg", NEG) + (", black shirt" if j.get("color") == "white" else ", white shirt"), num_inference_steps=j.get("steps", 6), guidance_scale=j.get("guidance", 2.0), width=640, height=880, generator=torch.Generator().manual_seed(j["seed"] + attempt * 101)).images[0]
        why = reason(measure(img, j, person_session), j)
        print(j["id"], attempt, "ok" if not why else f"retry ({why})", round(time.time() - t, 1), flush=True)
        if not why: break
    # Never a failed try under the photo's name (analyze would pick it up): kept aside to look at.
    img.save(f if not why else os.path.join(out, j["id"] + ".failed.png"))
