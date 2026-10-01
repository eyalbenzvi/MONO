"""
MONO studio model test: SDXL-Lightning on CPU.

  python3 scripts/studio/modeltest_sdxl_lightning.py [--steps 8|4] [--out data/studio/modeltest/sdxl-lightning]

stabilityai/stable-diffusion-xl-base-1.0 (text encoders, VAE, configs) with the
ByteDance/SDXL-Lightning distilled UNet (8-step by default), EulerDiscreteScheduler
with timestep_spacing="trailing", guidance 0, float32 on CPU. Lightning is CFG-free:
at guidance 0 the negative prompt is never used, so it is recorded but has no effect.

To fit 16 GB of RAM the prompts are encoded first and the text encoders freed before
the UNet is loaded. Writes <subject>-s<seed>.png and a partial results.json (the
oneink runs and the quality note are added afterwards).
"""
import argparse, gc, json, os, resource, threading, time

import psutil
import torch
from huggingface_hub import hf_hub_download, snapshot_download
from accelerate import init_empty_weights
from accelerate.utils import set_module_tensor_to_device
from safetensors import safe_open
from diffusers import (AutoencoderKL, EulerDiscreteScheduler, StableDiffusionXLPipeline,
                       UNet2DConditionModel)
from transformers import CLIPTextModel, CLIPTextModelWithProjection, CLIPTokenizer

BASE = "stabilityai/stable-diffusion-xl-base-1.0"
LIGHTNING = "ByteDance/SDXL-Lightning"
CKPT = {8: "sdxl_lightning_8step_unet.safetensors", 4: "sdxl_lightning_4step_unet.safetensors"}
W, H = 832, 1216
SEEDS = [7001, 7002]

PROMPTS = {
    "octopus": "One octopus study sheet, natural history plate, the living octopus large in the centre with its eight arms curling outward, below it a small sketch of its beak and a row of sucker details, thin scale lines and tiny illegible handwritten note marks around the edges. Fine black ink engraving with cross hatching for the shading, light from the upper left, centred with wide white margins on plain white paper. No text, no frame, no border, no ornaments, no colour, no grey wash.",
    "biplane": "One vintage biplane, technical side elevation drawing, the whole aircraft in clean side view with two stacked wings, struts and bracing wires, a two-blade propeller and spoked wheels, a thin ground line beneath it and faint columns of small specification marks on either side. Precise fine black ink line work, even light, centred with wide white margins on plain white paper. No text, no frame, no border, no ornaments, no colour, no grey wash.",
    "canal": "A row of old canal houses, front view across the water, tall narrow palazzo fronts with arched windows, balconies, shutters, flower boxes and chimneys, a small moored boat and reflections in the canal below. Dense pen and ink drawing with fine hatching and stippling, drawn edge to edge, the ground ending in a clean straight line with empty white sky above. No text, no frame, no border, no ornaments, no colour, no grey wash.",
}
NEG = ("text, letters, numbers, signature, watermark, logo, frame, border, ornament, decorative corners, "
       "panel, colour, grey wash, gradient, blurry, photo, 3d render, cropped, cut off, extra limbs, "
       "missing limbs, fused, deformed, two heads, landscape background")
NEGATIVES = {s: NEG.replace(", landscape background", "") if s == "canal" else NEG for s in PROMPTS}


class PeakRSS:
    """Samples this process's resident memory every 50 ms."""
    def __init__(self):
        self.proc, self.peak, self._stop = psutil.Process(), 0, None

    def __enter__(self):
        self.peak = self.proc.memory_info().rss
        self._stop = threading.Event()
        def run():
            while not self._stop.wait(0.05):
                self.peak = max(self.peak, self.proc.memory_info().rss)
        self._t = threading.Thread(target=run, daemon=True)
        self._t.start()
        return self

    def __exit__(self, *a):
        self._stop.set()
        self._t.join()
        self.peak = max(self.peak, self.proc.memory_info().rss)

    @property
    def gb(self):
        return round(self.peak / 2**30, 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=8, choices=[8, 4])
    ap.add_argument("--out", default="data/studio/modeltest/sdxl-lightning")
    ap.add_argument("--only", default="", help="comma list of subject-seed, e.g. octopus-7001")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    torch.set_num_threads(os.cpu_count())
    torch.set_grad_enabled(False)
    dt = torch.float32

    t0 = time.time()
    base = snapshot_download(BASE, allow_patterns=[
        "model_index.json", "scheduler/*", "tokenizer/*", "tokenizer_2/*", "unet/config.json",
        "text_encoder/config.json", "text_encoder/model.safetensors",
        "text_encoder_2/config.json", "text_encoder_2/model.safetensors",
        "vae/config.json", "vae/diffusion_pytorch_model.safetensors"])
    ckpt = hf_hub_download(LIGHTNING, CKPT[a.steps])
    download_seconds = round(time.time() - t0, 1)

    # Phase 1: encode every prompt, then free the text encoders.
    t0 = time.time()
    with PeakRSS() as enc_mem:
        tok = CLIPTokenizer.from_pretrained(base, subfolder="tokenizer")
        tok2 = CLIPTokenizer.from_pretrained(base, subfolder="tokenizer_2")
        te = CLIPTextModel.from_pretrained(base, subfolder="text_encoder", torch_dtype=dt)
        te2 = CLIPTextModelWithProjection.from_pretrained(base, subfolder="text_encoder_2", torch_dtype=dt)
        enc = StableDiffusionXLPipeline(vae=None, text_encoder=te, text_encoder_2=te2, tokenizer=tok,
                                        tokenizer_2=tok2, unet=None, scheduler=None)
        embeds, tokens = {}, {}
        for s, p in PROMPTS.items():
            pe, _, pooled, _ = enc.encode_prompt(p, device="cpu", num_images_per_prompt=1,
                                                 do_classifier_free_guidance=False)
            embeds[s] = (pe, pooled)
            tokens[s] = len(tok(p).input_ids)
        del enc, te, te2
        gc.collect()
    encode_seconds = round(time.time() - t0, 1)

    # Phase 2: the Lightning UNet (shipped fp16, upcast to fp32), VAE, scheduler.
    t0 = time.time()
    with PeakRSS() as load_mem:
        # Built on the meta device and filled one tensor at a time, upcast as it is read, so the
        # fp16 file and the fp32 model are never both in memory (that peaks past 16 GB).
        with init_empty_weights():
            unet = UNet2DConditionModel.from_config(UNet2DConditionModel.load_config(base, subfolder="unet"))
        with safe_open(ckpt, framework="pt", device="cpu") as f:
            for k in f.keys():
                set_module_tensor_to_device(unet, k, "cpu", value=f.get_tensor(k).to(dt))
        unet = unet.eval()
        gc.collect()
        vae = AutoencoderKL.from_pretrained(base, subfolder="vae", torch_dtype=dt)
        sched = EulerDiscreteScheduler.from_pretrained(base, subfolder="scheduler", timestep_spacing="trailing")
        pipe = StableDiffusionXLPipeline(vae=vae, text_encoder=None, text_encoder_2=None, tokenizer=None,
                                         tokenizer_2=None, unet=unet, scheduler=sched)
        pipe.set_progress_bar_config(disable=True)
        # The session's memory cap is about 14 GB; a full fp32 VAE decode at 832x1216 next to
        # the 10 GB UNet risks it, so the VAE decodes in overlapping tiles.
        vae.enable_tiling()
    unet_load_seconds = round(time.time() - t0, 1)

    only = set(x for x in a.only.split(",") if x)
    res_path = os.path.join(a.out, "results.json")
    results = json.load(open(res_path)) if os.path.exists(res_path) else {}
    images = {(r["subject"], r["seed"]): r for r in results.get("images", [])}
    for seed in SEEDS:
        for s in PROMPTS:
            if only and f"{s}-{seed}" not in only:
                continue
            pe, pooled = embeds[s]
            with PeakRSS() as mem:
                t = time.time()
                img = pipe(prompt_embeds=pe, pooled_prompt_embeds=pooled, num_inference_steps=a.steps,
                           guidance_scale=0.0, width=W, height=H,
                           generator=torch.Generator("cpu").manual_seed(seed)).images[0]
                secs = round(time.time() - t, 1)
            name = f"{s}-s{seed}.png"
            img.save(os.path.join(a.out, name))
            images[(s, seed)] = {"subject": s, "seed": seed, "file": name, "seconds": secs,
                                 "peak_ram_gb": mem.gb}
            print(f"{name}: {secs}s, peak {mem.gb} GB", flush=True)
            results.update(_meta(a, base, download_seconds, encode_seconds, unet_load_seconds,
                                 enc_mem, load_mem, tokens))
            order = {(sub, sd): i for i, (sd, sub) in enumerate((sd, sub) for sd in SEEDS for sub in PROMPTS)}
            results["images"] = sorted(images.values(), key=lambda r: order[(r["subject"], r["seed"])])
            json.dump(results, open(res_path, "w"), indent=2)


def _meta(a, base, download_seconds, encode_seconds, unet_load_seconds, enc_mem, load_mem, tokens):
    return {
        "model": "sdxl-lightning",
        "model_ids": {
            "base": BASE + " (text_encoder, text_encoder_2, tokenizers, vae, scheduler + unet config)",
            "unet": f"{LIGHTNING} / {CKPT[a.steps]}",
        },
        "licences": {
            BASE: "CreativeML Open RAIL++-M",
            LIGHTNING: "CreativeML Open RAIL++-M (inherits SDXL base licence)",
        },
        "fallback_used": None,
        "settings": {
            "steps": a.steps, "scheduler": "EulerDiscreteScheduler(timestep_spacing='trailing')",
            "guidance_scale": 0.0, "width": W, "height": H, "dtype": "float32", "device": "cpu",
            "vae_tiling": True,
            "torch_threads": torch.get_num_threads(),
            "negative_prompt": "not used: guidance 0 (Lightning is CFG-free), so the negative has no effect",
            "negatives_recorded": NEGATIVES,
            "prompt_tokens_clip": tokens,
            "prompt_truncation": "SDXL's CLIP encoders read 77 tokens; prompt text beyond that is dropped",
        },
        "load_seconds": round(encode_seconds + unet_load_seconds, 1),
        "load_breakdown": {
            "download_seconds_excluded": download_seconds,
            "text_encoders_load_and_encode_seconds": encode_seconds,
            "unet_vae_load_seconds": unet_load_seconds,
            "peak_ram_gb_text_encode": enc_mem.gb,
            "peak_ram_gb_unet_load": load_mem.gb,
        },
        "process_maxrss_gb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 2**20, 2),
    }


if __name__ == "__main__":
    main()
