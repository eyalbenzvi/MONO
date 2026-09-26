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
from diffusers import StableDiffusionPipeline, AutoencoderKL, LCMScheduler
torch.set_num_threads(4)
vae = AutoencoderKL.from_pretrained("stabilityai/sd-vae-ft-mse", torch_dtype=torch.float32)
pipe = StableDiffusionPipeline.from_pretrained("SG161222/Realistic_Vision_V5.1_noVAE", vae=vae, torch_dtype=torch.float32, safety_checker=None)
pipe.load_lora_weights("latent-consistency/lcm-lora-sdv1-5"); pipe.fuse_lora()
pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
jobs = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
NEG = "arms hanging at sides, hands at sides, face, profile, head turned, dark grey shirt, charcoal shirt, wrinkled shirt, creases, folds, baggy shirt, loose shirt, twisted torso, turning around, face, looking at camera, front view, stiff pose, arms pressed to sides, standing against a wall, mugshot, symmetrical pose, grey shirt, logo, print, graphic, text, letters, pattern, stripes, drawing on shirt, deformed, extra arms, extra fingers, cartoon, 3d render, painting, blurry shirt, watermark, crowd, cars, signs, graffiti"
for j in jobs:
    f = os.path.join(out, j["id"] + ".png")
    if os.path.exists(f): continue
    t = time.time()
    # The tee must come out in the colour asked for: check the middle of the back, retry with other seeds.
    for attempt in range(8):
        img = pipe(j["prompt"], negative_prompt=NEG + (", black shirt" if j.get("color") == "white" else ", white shirt"), num_inference_steps=j.get("steps", 6), guidance_scale=2.0, width=512, height=704, generator=torch.Generator().manual_seed(j["seed"] + attempt * 101)).images[0]
        g = img.convert("L").crop((200, 230, 312, 380)); px = list(g.getdata()); m = sum(px) / len(px)
        ok = (m > 150) if j.get("color") == "white" else (m < 22) if j.get("color") == "black" else True
        print(j["id"], attempt, round(m), "ok" if ok else "retry", round(time.time() - t, 1), flush=True)
        if ok: break
    img.save(f)
