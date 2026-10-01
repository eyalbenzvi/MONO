"""
Generate an illustration on this machine's CPU with an open model (no outside
service): Segmind SSD-1B (Apache 2.0), optionally with the LCM LoRA
(openrail++) for a few-step draft. Both licences allow commercial use.

  python scripts/studio/generate.py <out.png> "<subject>" [--steps 30] [--seed 1] [--lcm] [--size 832x1216]

The house style (docs/content/studio.md) is put before the subject, and the
negative prompt keeps out text, frames, colour and grey wash.
"""
import sys, time
import torch
from diffusers import StableDiffusionXLPipeline, LCMScheduler

STYLE = (
    "detailed black and white engraving illustration, 19th century scientific plate, "
    "bold confident pen and ink line work, cross-hatching and stippling, high contrast, crisp lines, "
    "isolated on plain white paper, vertical composition, "
)
NEGATIVE = (
    "text, letters, words, labels, caption, signature, watermark, logo, frame, border, "
    "colour, color, grey wash, gradient, blurry, photo, 3d render, low contrast, cropped, deformed"
)


def main():
    a = sys.argv[1:]
    out, subject = a[0], a[1]
    opt = lambda k, d: a[a.index(k) + 1] if k in a else d
    steps = int(opt("--steps", "30"))
    seed = int(opt("--seed", "1"))
    w, h = (int(v) for v in opt("--size", "832x1216").split("x"))
    lcm = "--lcm" in a
    torch.set_num_threads(4)
    pipe = StableDiffusionXLPipeline.from_pretrained("segmind/SSD-1B", torch_dtype=torch.float32, use_safetensors=True, variant="fp16")
    guidance = 7.0
    if lcm:
        pipe.load_lora_weights("latent-consistency/lcm-lora-ssd-1b")
        pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
        guidance = 1.0
    t = time.time()
    img = pipe(
        prompt=STYLE + subject,
        negative_prompt=None if lcm else NEGATIVE,
        num_inference_steps=steps,
        guidance_scale=guidance,
        width=w,
        height=h,
        generator=torch.Generator().manual_seed(seed),
    ).images[0]
    img.save(out)
    print(f"{out}: {w}x{h}, {steps} steps, {time.time() - t:.0f} s")


if __name__ == "__main__":
    main()
