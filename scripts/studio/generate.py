"""
Generate an illustration on this machine's CPU with an open model (no outside
service): Segmind SSD-1B (Apache 2.0), optionally with the LCM LoRA
(openrail++) for a few-step draft. Both licences allow commercial use.

  python scripts/studio/generate.py <out.png> "<subject>" [--steps 30] [--seed 1] [--lcm] [--size 832x1216] [--style plate|realistic]
  python scripts/studio/generate.py --batch <jobs.tsv> [--steps 8] [--lcm]   (lines: out<TAB>seed<TAB>subject)
  python scripts/studio/generate.py --jobs <jobs.json> [--steps 22]   ([{"out", "seed", "prompt", "negative"?, "size"?}])

The text encoders read 77 tokens at a time; a long prompt (a full brief of
200 words or more) is encoded in 77-token chunks and read whole,
not cut off. A --jobs prompt is the whole prompt: no house style is put before it.

The house style (docs/content/studio.md) is put before the subject, and the
negative prompt keeps out text, frames, colour and grey wash.
"""
import json, sys, time
import torch
from diffusers import StableDiffusionXLPipeline, LCMScheduler

STYLES = {
    "plate": (
    "detailed black and white engraving illustration, 19th century scientific plate, "
    "bold confident pen and ink line work, cross-hatching and stippling, high contrast, crisp lines, "
    "isolated on plain white paper, vertical composition, "
    ),
    # Closer to life: true proportions, light and texture, still ink on paper.
    "realistic": (
        "hyperrealistic black and white pen and ink drawing, photorealistic detail, true proportions, "
        "natural light and deep shadows, rich realistic textures, masterful fine cross-hatching and stippling, "
        "high contrast, on plain white paper, vertical composition, "
    ),
}
NEGATIVE = (
    "text, letters, words, labels, caption, signature, watermark, logo, frame, border, "
    "colour, color, grey wash, gradient, blurry, photo, 3d render, low contrast, cropped, deformed"
)


def chunks(tok, text, n=None):
    """Token ids in 77-token windows (start, 75 tokens, end, padding), at least n of them."""
    ids = tok(text, add_special_tokens=False).input_ids
    parts = [ids[i:i + 75] for i in range(0, len(ids), 75)] or [[]]
    while n and len(parts) < n:
        parts.append([])
    pad = tok.pad_token_id if tok.pad_token_id is not None else tok.eos_token_id
    return [[tok.bos_token_id] + p + [tok.eos_token_id] + [pad] * (75 - len(p)) for p in parts]


def encode(pipe, text, n=None):
    """SDXL conditioning for a long prompt: each window through both text encoders
    (their penultimate layers, side by side), the windows end to end; the pooled
    embedding from the first window."""
    c1, c2 = chunks(pipe.tokenizer, text, n), chunks(pipe.tokenizer_2, text, n)
    k = max(len(c1), len(c2))
    c1, c2 = chunks(pipe.tokenizer, text, k), chunks(pipe.tokenizer_2, text, k)
    embs, pooled = [], None
    for a, b in zip(c1, c2):
        h1 = pipe.text_encoder(torch.tensor([a]), output_hidden_states=True).hidden_states[-2]
        o2 = pipe.text_encoder_2(torch.tensor([b]), output_hidden_states=True)
        if pooled is None:
            pooled = o2[0]
        embs.append(torch.cat([h1, o2.hidden_states[-2]], dim=-1))
    return torch.cat(embs, dim=1), pooled, k


def main():
    a = sys.argv[1:]
    opt = lambda k, d: a[a.index(k) + 1] if k in a else d
    steps = int(opt("--steps", "30"))
    seed = int(opt("--seed", "1"))
    w, h = (int(v) for v in opt("--size", "832x1216").split("x"))
    lcm = "--lcm" in a
    style = STYLES[opt("--style", "plate")]
    torch.set_num_threads(4)
    pipe = StableDiffusionXLPipeline.from_pretrained("segmind/SSD-1B", torch_dtype=torch.float32, use_safetensors=True, variant="fp16")
    guidance = 7.0
    if lcm:
        pipe.load_lora_weights("latent-consistency/lcm-lora-ssd-1b")
        pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
        guidance = 1.0
    if "--jobs" in a:
        jobs = [(j["out"], int(j["seed"]), j["prompt"], j.get("negative", NEGATIVE), j.get("size")) for j in json.load(open(opt("--jobs", "")))]
    elif "--batch" in a:
        jobs = [l.rstrip("\n").split("\t") for l in open(opt("--batch", "")) if l.strip()]
        jobs = [(o, int(s), style + subj, NEGATIVE, None) for o, s, subj in jobs]
    else:
        jobs = [(a[0], seed, style + a[1], NEGATIVE, None)]
    for out, seed, prompt, negative, size in jobs:
        jw, jh = (int(v) for v in size.split("x")) if size else (w, h)
        t = time.time()
        with torch.no_grad():
            cond, pooled, k = encode(pipe, prompt)
            if lcm:
                kw = dict(prompt_embeds=cond, pooled_prompt_embeds=pooled)
            else:
                ncond, npooled, nk = encode(pipe, negative, k)
                if nk > k:
                    cond, pooled, k = encode(pipe, prompt, nk)
                kw = dict(prompt_embeds=cond, pooled_prompt_embeds=pooled, negative_prompt_embeds=ncond, negative_pooled_prompt_embeds=npooled)
        img = pipe(
            **kw,
            num_inference_steps=steps,
            guidance_scale=guidance,
            width=jw,
            height=jh,
            generator=torch.Generator().manual_seed(seed),
        ).images[0]
        img.save(out)
        print(f"{out}: {jw}x{jh}, {steps} steps, {time.time() - t:.0f} s", flush=True)


if __name__ == "__main__":
    main()
