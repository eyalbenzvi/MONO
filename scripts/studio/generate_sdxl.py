"""
The studio's SDXL generator (from the model test, data/studio/modeltest): SDXL base 1.0
with the ByteDance SDXL-Lightning 8-step UNet, on CPU, no external service.

  python3 scripts/studio/generate_sdxl.py --jobs <jobs.json> [--steps 8|4]
      jobs: [{"out", "seed", "prompt", "size"?: "832x1216"}, ...]  (a job whose file exists is skipped)

Lightning is CFG-free (guidance 0): there is no negative prompt, so what must not be in the
picture goes in the prompt itself, early. The prompt is read in full: 77-token windows
through both text encoders end to end (generate.py's encode), not cut at 77 as a plain
SDXL pipeline would. Every prompt is encoded first and the text encoders freed, then the
UNet is filled tensor by tensor and the VAE decodes in tiles, to stay under 15 GB of RAM.
About 5 minutes an image on 4 cores. Licences: SDXL base and SDXL-Lightning, CreativeML
Open RAIL++-M (commercial use allowed).
"""
import argparse, gc, json, os, sys, time

import torch
from huggingface_hub import hf_hub_download, snapshot_download
from accelerate import init_empty_weights
from accelerate.utils import set_module_tensor_to_device
from safetensors import safe_open
from diffusers import AutoencoderKL, EulerDiscreteScheduler, StableDiffusionXLPipeline, UNet2DConditionModel
from transformers import CLIPTextModel, CLIPTextModelWithProjection, CLIPTokenizer

sys.path.insert(0, os.path.dirname(__file__))
from generate import encode  # noqa: E402  (long prompts in 77-token windows)

BASE = "stabilityai/stable-diffusion-xl-base-1.0"
LIGHTNING = "ByteDance/SDXL-Lightning"
CKPT = {8: "sdxl_lightning_8step_unet.safetensors", 4: "sdxl_lightning_4step_unet.safetensors"}


def rss():
    return int(open("/proc/self/statm").read().split()[1]) * os.sysconf("SC_PAGE_SIZE") / 1e9


def trim():
    # Hand freed heap back to the OS (glibc keeps it otherwise, and the UNet then lands on top).
    try:
        import ctypes
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except OSError:
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", required=True)
    ap.add_argument("--steps", type=int, default=8, choices=[8, 4])
    # bfloat16 UNet and VAE: half the memory, for a container capped under 14 GB (fp32 was OOM-killed).
    ap.add_argument("--bf16", action="store_true")
    a = ap.parse_args()
    jobs = [j for j in json.load(open(a.jobs)) if not os.path.exists(j["out"])]
    if not jobs:
        return print("nothing to do")
    torch.set_num_threads(os.cpu_count())
    torch.set_grad_enabled(False)
    dt = torch.float32
    udt = torch.bfloat16 if a.bf16 else dt
    base = snapshot_download(BASE, allow_patterns=[
        "model_index.json", "scheduler/*", "tokenizer/*", "tokenizer_2/*", "unet/config.json",
        "text_encoder/config.json", "text_encoder/model.safetensors",
        "text_encoder_2/config.json", "text_encoder_2/model.safetensors",
        "vae/config.json", "vae/diffusion_pytorch_model.safetensors"])
    ckpt = hf_hub_download(LIGHTNING, CKPT[a.steps])

    # 1. Every prompt encoded, then the text encoders freed.
    enc = StableDiffusionXLPipeline(
        vae=None, unet=None, scheduler=None,
        tokenizer=CLIPTokenizer.from_pretrained(base, subfolder="tokenizer"),
        tokenizer_2=CLIPTokenizer.from_pretrained(base, subfolder="tokenizer_2"),
        text_encoder=CLIPTextModel.from_pretrained(base, subfolder="text_encoder", torch_dtype=dt),
        text_encoder_2=CLIPTextModelWithProjection.from_pretrained(base, subfolder="text_encoder_2", torch_dtype=dt))
    embeds = {}
    for j in jobs:
        if j["prompt"] not in embeds:
            pe, pooled, _ = encode(enc, j["prompt"])
            embeds[j["prompt"]] = (pe.to(udt), pooled.to(udt))
    te = (enc.text_encoder, enc.text_encoder_2)
    enc.text_encoder = enc.text_encoder_2 = None
    del enc, te
    gc.collect()
    trim()
    print(f"encoded, rss {rss():.1f} GB", flush=True)

    # 2. The Lightning UNet, upcast tensor by tensor (fp16 file and fp32 model never both in memory).
    with init_empty_weights():
        unet = UNet2DConditionModel.from_config(UNet2DConditionModel.load_config(base, subfolder="unet"))
    with safe_open(ckpt, framework="pt", device="cpu") as f:
        for k in f.keys():
            set_module_tensor_to_device(unet, k, "cpu", value=f.get_tensor(k).to(udt), dtype=udt)
    unet = unet.eval()
    gc.collect()
    trim()
    print(f"unet loaded, rss {rss():.1f} GB", flush=True)
    vae = AutoencoderKL.from_pretrained(base, subfolder="vae", torch_dtype=udt)
    vae.enable_tiling()
    sched = EulerDiscreteScheduler.from_pretrained(base, subfolder="scheduler", timestep_spacing="trailing")
    pipe = StableDiffusionXLPipeline(vae=vae, text_encoder=None, text_encoder_2=None, tokenizer=None,
                                     tokenizer_2=None, unet=unet, scheduler=sched)
    pipe.set_progress_bar_config(disable=True)

    for j in jobs:
        w, h = (int(x) for x in (j.get("size") or "832x1216").split("x"))
        pe, pooled = embeds[j["prompt"]]
        t = time.time()
        img = pipe(prompt_embeds=pe, pooled_prompt_embeds=pooled, num_inference_steps=a.steps, guidance_scale=0.0,
                   width=w, height=h, generator=torch.Generator("cpu").manual_seed(int(j["seed"]))).images[0]
        os.makedirs(os.path.dirname(j["out"]) or ".", exist_ok=True)
        img.save(j["out"])
        print(f"{j['out']}: {time.time() - t:.0f}s", flush=True)


if __name__ == "__main__":
    main()
