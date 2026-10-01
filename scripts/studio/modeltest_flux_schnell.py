"""
Model test: FLUX.1 [schnell] on the CPU, for the one-ink studio comparison.

  python scripts/studio/modeltest_flux_schnell.py <model-dir> <gguf> <out-dir>
      [--size 832x1216] [--jobs octopus:7001,biplane:7001,...] [--bench] [--bench-size 704x1024 ...] [--fit] [--budget-min 80]

<model-dir> is a local copy of the FLUX.1-schnell diffusers folder (configs,
tokenizers, CLIP-L, T5-XXL, VAE; the transformer weights are not needed) and
<gguf> a city96/FLUX.1-schnell-gguf file. To fit 15 GB of RAM the prompts are
encoded first (CLIP + T5 in bf16), the encoders freed, then the quantised
transformer loaded and the latents denoised from prompt_embeds and
pooled_prompt_embeds; the VAE decodes. FLUX schnell takes no negative prompt
and no guidance (guidance 0, 4 steps, max_sequence_length 256).

--bench times one double-stream and one single-stream block at the requested
size and prints the projected seconds per step and per image, before denoising.
Each image's seconds (denoise + decode, model load excluded), per-step seconds
and peak RAM are written to <out-dir>/runs.json as they finish.
"""
import argparse, gc, json, os, threading, time

import psutil
import torch

PROMPTS = {
    "octopus": "One octopus study sheet, natural history plate, the living octopus large in the centre with its eight arms curling outward, below it a small sketch of its beak and a row of sucker details, thin scale lines and tiny illegible handwritten note marks around the edges. Fine black ink engraving with cross hatching for the shading, light from the upper left, centred with wide white margins on plain white paper. No text, no frame, no border, no ornaments, no colour, no grey wash.",
    "biplane": "One vintage biplane, technical side elevation drawing, the whole aircraft in clean side view with two stacked wings, struts and bracing wires, a two-blade propeller and spoked wheels, a thin ground line beneath it and faint columns of small specification marks on either side. Precise fine black ink line work, even light, centred with wide white margins on plain white paper. No text, no frame, no border, no ornaments, no colour, no grey wash.",
    "canal": "A row of old canal houses, front view across the water, tall narrow palazzo fronts with arched windows, balconies, shutters, flower boxes and chimneys, a small moored boat and reflections in the canal below. Dense pen and ink drawing with fine hatching and stippling, drawn edge to edge, the ground ending in a clean straight line with empty white sky above. No text, no frame, no border, no ornaments, no colour, no grey wash.",
}
DEFAULT_JOBS = [(s, 7001) for s in PROMPTS] + [(s, 7002) for s in PROMPTS]
STEPS, GUIDANCE, MAX_SEQ = 4, 0.0, 256


class PeakRAM:
    """Samples this process's resident memory; peak() since the last reset()."""

    def __init__(self):
        self.proc, self.max = psutil.Process(), 0
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        while True:
            self.max = max(self.max, self.proc.memory_info().rss)
            time.sleep(0.2)

    def reset(self):
        self.max = self.proc.memory_info().rss

    def peak_gb(self):
        return round(max(self.max, self.proc.memory_info().rss) / 1e9, 2)


def encode(model_dir, subjects):
    from transformers import CLIPTextModel, CLIPTokenizer, T5EncoderModel, T5TokenizerFast
    from diffusers import FluxPipeline

    t = time.time()
    pipe = FluxPipeline.from_pretrained(
        model_dir, transformer=None, vae=None, torch_dtype=torch.bfloat16,
        text_encoder=CLIPTextModel.from_pretrained(model_dir, subfolder="text_encoder", torch_dtype=torch.bfloat16),
        text_encoder_2=T5EncoderModel.from_pretrained(model_dir, subfolder="text_encoder_2", torch_dtype=torch.bfloat16),
        tokenizer=CLIPTokenizer.from_pretrained(model_dir, subfolder="tokenizer"),
        tokenizer_2=T5TokenizerFast.from_pretrained(model_dir, subfolder="tokenizer_2"))
    load = time.time() - t
    embeds = {}
    t = time.time()
    with torch.inference_mode():
        for s in subjects:
            pe, ppe, _ = pipe.encode_prompt(PROMPTS[s], prompt_2=None, max_sequence_length=MAX_SEQ)
            embeds[s] = (pe.clone(), ppe.clone())
    enc = time.time() - t
    del pipe
    gc.collect()
    return embeds, load, enc


def load_transformer(model_dir, gguf):
    from diffusers import FluxPipeline, FluxTransformer2DModel, GGUFQuantizationConfig

    tr = FluxTransformer2DModel.from_single_file(
        gguf, config=model_dir, subfolder="transformer",
        quantization_config=GGUFQuantizationConfig(compute_dtype=torch.bfloat16),
        torch_dtype=torch.bfloat16)
    return FluxPipeline.from_pretrained(
        model_dir, transformer=tr, text_encoder=None, text_encoder_2=None,
        tokenizer=None, tokenizer_2=None, torch_dtype=torch.bfloat16)


def bench(pipe, w, h, embeds):
    """Times one block of each kind at this size and projects a step and an image."""
    tr = pipe.transformer
    n_img, n_txt, d = (w // 16) * (h // 16), MAX_SEQ, tr.config.num_attention_heads * tr.config.attention_head_dim
    out = {}
    with torch.inference_mode():
        hs = torch.randn(1, n_img, d, dtype=torch.bfloat16)
        ehs = torch.randn(1, n_txt, d, dtype=torch.bfloat16)
        temb = tr.time_text_embed(torch.tensor([1.0]).to(torch.bfloat16), embeds[1])
        ids = torch.cat([torch.zeros(n_txt, 3), pipe._prepare_latent_image_ids(1, h // 16, w // 16, "cpu", torch.float32)])
        rot = tr.pos_embed(ids)
        t = time.time()
        tr.transformer_blocks[0](hidden_states=hs, encoder_hidden_states=ehs, temb=temb, image_rotary_emb=rot)
        out["double_block_s"] = time.time() - t
        t = time.time()
        tr.single_transformer_blocks[0](hidden_states=hs, encoder_hidden_states=ehs, temb=temb, image_rotary_emb=rot)
        out["single_block_s"] = time.time() - t
    out["projected_step_s"] = round(out["double_block_s"] * len(tr.transformer_blocks)
                                    + out["single_block_s"] * len(tr.single_transformer_blocks), 1)
    out["projected_image_s"] = round(out["projected_step_s"] * STEPS, 1)
    out["tokens"] = n_img + n_txt
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("model_dir"); ap.add_argument("gguf"); ap.add_argument("out")
    ap.add_argument("--size", default="832x1216")
    ap.add_argument("--jobs", default=None)
    ap.add_argument("--bench", action="store_true")
    ap.add_argument("--bench-size", action="append", default=[])
    ap.add_argument("--fit", action="store_true",
                    help="with --bench and --budget-min: fall back to the first --bench-size that fits")
    ap.add_argument("--budget-min", type=float, default=None,
                    help="skip a job when the time left is under its projected time")
    a = ap.parse_args()
    t0 = time.time()
    torch.set_num_threads(os.cpu_count())
    w, h = map(int, a.size.split("x"))
    jobs = [(j.split(":")[0], int(j.split(":")[1])) for j in a.jobs.split(",")] if a.jobs else DEFAULT_JOBS
    os.makedirs(a.out, exist_ok=True)
    ram = PeakRAM()
    log = {"size": [w, h], "steps": STEPS, "guidance_scale": GUIDANCE, "max_sequence_length": MAX_SEQ,
           "threads": torch.get_num_threads(), "gguf": os.path.basename(a.gguf), "images": []}
    path = os.path.join(a.out, "runs.json")

    def save():
        with open(path, "w") as f:
            json.dump(log, f, indent=2)

    cache = os.path.join(a.model_dir, "prompt_embeds.pt")
    if os.path.exists(cache):
        embeds, log["encoder_load_seconds"], log["encode_seconds"], log["encode_peak_ram_gb"] = torch.load(cache)
    else:
        embeds, log["encoder_load_seconds"], log["encode_seconds"] = encode(a.model_dir, list(PROMPTS))
        log["encode_peak_ram_gb"] = ram.peak_gb()
        torch.save((embeds, log["encoder_load_seconds"], log["encode_seconds"], log["encode_peak_ram_gb"]), cache)
    print("encoded", log["encoder_load_seconds"], log["encode_seconds"], log["encode_peak_ram_gb"], flush=True)
    t = time.time()
    ram.reset()
    pipe = load_transformer(a.model_dir, a.gguf)
    log["load_seconds"] = round(time.time() - t, 1)
    log["load_peak_ram_gb"] = ram.peak_gb()
    print("transformer loaded", log["load_seconds"], log["load_peak_ram_gb"], flush=True)
    save()
    projected = None
    if a.bench:
        log["bench"] = {}
        for sz in [a.size] + a.bench_size:
            bw, bh = map(int, sz.split("x"))
            log["bench"][sz] = bench(pipe, bw, bh, embeds[jobs[0][0]])
            print("bench", sz, log["bench"][sz], flush=True)
        projected = log["bench"][a.size]["projected_image_s"]
        if a.fit and a.budget_min:
            # The spec size first; a smaller one only when the spec size cannot finish in the time left.
            left = a.budget_min * 60 - (time.time() - t0)
            for sz in [a.size] + a.bench_size:
                if log["bench"][sz]["projected_image_s"] * 1.1 < left:
                    break
            if sz != a.size:
                log["size_fallback"] = {"from": a.size, "to": sz, "reason":
                    f"{left:.0f} s left in the budget, {a.size} projected at {projected:.0f} s per image"}
                w, h = map(int, sz.split("x"))
                log["size"] = [w, h]
                projected = log["bench"][sz]["projected_image_s"]
            print("size", w, h, flush=True)
        save()
    for subject, seed in jobs:
        left = a.budget_min * 60 - (time.time() - t0) if a.budget_min else None
        if left is not None and projected and left < projected:
            log.setdefault("skipped", []).append({"subject": subject, "seed": seed,
                                                   "reason": f"{left:.0f} s left, ~{projected:.0f} s needed"})
            print("skip", subject, seed, flush=True)
            save()
            continue
        pe, ppe = embeds[subject]
        steps = []
        last = [time.time()]

        def on_step(p, i, ts, kw):
            steps.append(round(time.time() - last[0], 1))
            last[0] = time.time()
            print(f"  {subject} s{seed} step {i + 1}/{STEPS}: {steps[-1]} s", flush=True)
            return kw

        ram.reset()
        t = last[0] = time.time()
        with torch.inference_mode():
            img = pipe(prompt_embeds=pe, pooled_prompt_embeds=ppe, width=w, height=h,
                       num_inference_steps=STEPS, guidance_scale=GUIDANCE, max_sequence_length=MAX_SEQ,
                       generator=torch.Generator("cpu").manual_seed(seed),
                       callback_on_step_end=on_step).images[0]
        secs = round(time.time() - t, 1)
        name = f"{subject}-s{seed}.png"
        img.save(os.path.join(a.out, name))
        log["images"].append({"subject": subject, "seed": seed, "file": name, "seconds": secs,
                              "step_seconds": steps, "peak_ram_gb": ram.peak_gb(), "size": [w, h]})
        projected = secs
        print("done", name, secs, flush=True)
        save()
    log["total_seconds"] = round(time.time() - t0, 1)
    save()


if __name__ == "__main__":
    main()
