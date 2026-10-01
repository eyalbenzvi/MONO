"""
Model test, SSD-1B baseline: the studio's current generator (segmind/SSD-1B with
the LCM LoRA, 8 steps, guidance 1.0, float32 on CPU, as generate.py --lcm --steps 8)
on the shared three-subject test, two seeds each.

  python scripts/studio/modeltest_ssd1b.py [out-dir]   (default data/studio/modeltest/ssd1b)

Writes <subject>-s<seed>.png and timings.json (load seconds, per image seconds and
peak RAM). The pipeline setup and the long-prompt encoder are generate.py's own.
At guidance 1.0 LCM runs without classifier-free guidance, so (as in generate.py)
the negative prompt is recorded but takes no part.
"""
import json, os, sys, threading, time
import psutil
import torch
from diffusers import StableDiffusionXLPipeline, LCMScheduler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate import encode

MODEL = "segmind/SSD-1B"
LORA = "latent-consistency/lcm-lora-ssd-1b"
STEPS, GUIDANCE, W, H = 8, 1.0, 832, 1216
SEEDS = (7001, 7002)
PROMPTS = {
    "octopus": "One octopus study sheet, natural history plate, the living octopus large in the centre with its eight arms curling outward, below it a small sketch of its beak and a row of sucker details, thin scale lines and tiny illegible handwritten note marks around the edges. Fine black ink engraving with cross hatching for the shading, light from the upper left, centred with wide white margins on plain white paper. No text, no frame, no border, no ornaments, no colour, no grey wash.",
    "biplane": "One vintage biplane, technical side elevation drawing, the whole aircraft in clean side view with two stacked wings, struts and bracing wires, a two-blade propeller and spoked wheels, a thin ground line beneath it and faint columns of small specification marks on either side. Precise fine black ink line work, even light, centred with wide white margins on plain white paper. No text, no frame, no border, no ornaments, no colour, no grey wash.",
    "canal": "A row of old canal houses, front view across the water, tall narrow palazzo fronts with arched windows, balconies, shutters, flower boxes and chimneys, a small moored boat and reflections in the canal below. Dense pen and ink drawing with fine hatching and stippling, drawn edge to edge, the ground ending in a clean straight line with empty white sky above. No text, no frame, no border, no ornaments, no colour, no grey wash.",
}
NEG = ("text, letters, numbers, signature, watermark, logo, frame, border, ornament, decorative corners, panel, "
       "colour, grey wash, gradient, blurry, photo, 3d render, cropped, cut off, extra limbs, missing limbs, fused, "
       "deformed, two heads, landscape background")


def negative(subject):
    return NEG.replace(", landscape background", "") if subject == "canal" else NEG


class PeakRSS:
    """Peak resident memory of this process (GB), sampled every 50 ms while active."""
    def __init__(self):
        self.proc, self.peak, self.on = psutil.Process(), 0, False

    def _run(self):
        while self.on:
            self.peak = max(self.peak, self.proc.memory_info().rss)
            time.sleep(0.05)

    def __enter__(self):
        self.peak, self.on = self.proc.memory_info().rss, True
        self.t = threading.Thread(target=self._run, daemon=True)
        self.t.start()
        return self

    def __exit__(self, *e):
        self.on = False
        self.t.join()
        self.gb = round(self.peak / 2**30, 2)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "data/studio/modeltest/ssd1b"
    os.makedirs(out, exist_ok=True)
    torch.set_num_threads(4)
    t = time.time()
    with PeakRSS() as m:
        pipe = StableDiffusionXLPipeline.from_pretrained(MODEL, torch_dtype=torch.float32, use_safetensors=True, variant="fp16")
        pipe.load_lora_weights(LORA)
        pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
    res = {"load_seconds": round(time.time() - t, 1), "load_peak_ram_gb": m.gb, "images": []}
    print(f"loaded in {res['load_seconds']} s, {m.gb} GB", flush=True)
    for seed in SEEDS:
        for subj, prompt in PROMPTS.items():
            path = os.path.join(out, f"{subj}-s{seed}.png")
            with PeakRSS() as m:
                t = time.time()
                with torch.no_grad():
                    cond, pooled, _ = encode(pipe, prompt)
                img = pipe(prompt_embeds=cond, pooled_prompt_embeds=pooled, num_inference_steps=STEPS,
                           guidance_scale=GUIDANCE, width=W, height=H,
                           generator=torch.Generator().manual_seed(seed)).images[0]
                secs = round(time.time() - t, 1)
            img.save(path)
            res["images"].append({"subject": subj, "seed": seed, "seconds": secs, "peak_ram_gb": m.gb})
            print(f"{path}: {secs} s, {m.gb} GB", flush=True)
            json.dump(res, open(os.path.join(out, "timings.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
