import { readFileSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { describe, expect, it } from "vitest";
import { solidBlock } from "@/lib/custom/quality";
import {
  BOXES,
  MAX_TONE,
  OUT_H,
  OUT_W,
  PX_PER_MM,
  SLAB_PX,
  TOP,
  classify,
  clean,
  convert,
  downscale,
  grey,
  inkFor,
  lanczos,
  midtoneShare,
  place,
  sanitiseSvg,
  shapesOf,
  screenTone,
  tooSmall,
  type Pixels,
} from "@/lib/upload/convert";
import { REASONS } from "@/lib/upload/reasons";
import { logo, photo, scan } from "./fixtures";
import { BLOCK, parityTones } from "./parity";

const share = (m: Uint8Array) => m.reduce((a, b) => a + b, 0) / m.length;

function box(m: Uint8Array, w = OUT_W, h = OUT_H) {
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (m[y * w + x]) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  return { x0, y0, x1, y1 };
}

const SVG_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient></defs><circle cx="80" cy="100" r="60" fill="none" stroke="#000" stroke-width="12"/><rect x="170" y="50" width="100" height="100" fill="url(#g)"/><path d="M20 190 L280 190" stroke="#111" stroke-width="6"/></svg>`;

function svgRaster(svg: string): Pixels {
  const img = new Resvg(svg, { fitTo: { mode: "width", value: 1500 }, background: "white" }).render();
  return { w: img.width, h: img.height, data: new Uint8ClampedArray(img.pixels) };
}

describe("uploads: classification", () => {
  it("a scan (tinted paper, a shadow, grain) is line work", () => {
    const p = scan();
    expect(classify(p)).toBe("line");
    const c = convert({ pixels: p }, { size: "full" });
    expect(c).toMatchObject({ cls: "line", mode: "line", darkOnLight: true, tone: null, w: OUT_W, h: OUT_H });
    // The shadow stays paper: only the strokes print (about 2% of the scan).
    expect(share(c.ink)).toBeGreaterThan(0.005);
    expect(share(c.ink)).toBeLessThan(0.08);
  });

  it("a flat logo is line work, either way round; light on dark is kept as a light print", () => {
    const dark = convert({ pixels: logo() }, { size: "full" });
    const light = convert({ pixels: logo(1200, 1200, true) }, { size: "full" });
    expect([dark.cls, light.cls]).toEqual(["line", "line"]);
    expect(dark.darkOnLight).toBe(true);
    expect(light.darkOnLight).toBe(false);
    // The same shapes: the light logo's ink is its light marks, not its dark ground.
    const diff = dark.ink.reduce((a, v, i) => a + (v !== light.ink[i] ? 1 : 0), 0) / dark.ink.length;
    expect(diff).toBeLessThan(0.01);
  });

  it("a photograph is a photograph, screened as dots by default", () => {
    const p = photo();
    expect(classify(p)).toBe("photo");
    const c = convert({ pixels: p }, { size: "full" });
    expect(c.cls).toBe("photo");
    expect(c.mode).toBe("dots");
    expect(c.tone).not.toBeNull();
    expect(c.midtones).toBeGreaterThan(0.5);
  });

  it("midtones: a scan's soft stroke edges and paper don't count, a photograph's greys do", () => {
    const s = downscale(scan(), 512);
    const p = downscale(photo(), 512);
    expect(midtoneShare(grey(s), s.w, s.h)).toBeLessThan(0.08);
    expect(midtoneShare(grey(p), p.w, p.h)).toBeGreaterThan(0.3);
  });

  it("an SVG, rasterised (resvg here, the worker's canvas in the browser), is a vector: thresholded, trimmed and fitted", () => {
    const svg = sanitiseSvg(SVG_LOGO);
    expect(svg.ok).toBe(true);
    const c = convert({ svgRaster: svgRaster(SVG_LOGO) }, { size: "full" });
    expect(c).toMatchObject({ cls: "vector", mode: "vector", darkOnLight: true });
    const b = box(c.ink);
    // Wider than tall: fitted to the full width, starting at the catalogue's top margin.
    expect(b.x0).toBeLessThanOrEqual(1);
    expect(b.x1).toBeGreaterThanOrEqual(OUT_W - 2);
    expect(b.y0).toBe(TOP);
  });

  it("a photograph as Lines: edges of print width, trimmed and fitted", () => {
    const c = convert({ pixels: photo() }, { size: "full", mode: "lines" });
    expect(c).toMatchObject({ cls: "photo", mode: "lines", tone: null, darkOnLight: true });
    expect(share(c.ink)).toBeGreaterThan(0.005);
    expect(share(c.ink)).toBeLessThan(0.45);
    expect(box(c.ink).y0).toBe(TOP);
  });

  it("Dots or Lines asked of line work are ignored: line work stays line", () => {
    expect(convert({ pixels: scan() }, { size: "full", mode: "dots" }).mode).toBe("line");
  });
});

describe("uploads: SVG sanitising", () => {
  const bad = {
    script: `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>`,
    scriptNs: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/2000/svg"><s:script>1</s:script></svg>`,
    scriptSpaced: `<svg xmlns="http://www.w3.org/2000/svg">< SCRIPT >1</SCRIPT></svg>`,
    onload: `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>`,
    onclickNewline: `<svg xmlns="http://www.w3.org/2000/svg"><rect\nONCLICK = "x()" width="10" height="10"/></svg>`,
    foreignObject: `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject></svg>`,
    externalHref: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://evil.example/x.svg#a"/></svg>`,
    href: `<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="10" height="10"/></a></svg>`,
    dataHref: `<svg xmlns="http://www.w3.org/2000/svg"><use href = 'data:image/svg+xml;base64,AAAA'/></svg>`,
    image: `<svg xmlns="http://www.w3.org/2000/svg"><image href="#x" width="10" height="10"/></svg>`,
    feImage: `<svg xmlns="http://www.w3.org/2000/svg"><filter id="f"><feImage href="#x"/></filter></svg>`,
    entity: `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaa">]><svg xmlns="http://www.w3.org/2000/svg"><text>&a;</text></svg>`,
    externalUrl: `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(https://evil.example/p.svg#p)" width="10" height="10"/></svg>`,
    importStyle: `<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(#x);</style></svg>`,
    stylesheet: `<?xml-stylesheet href="https://evil.example/s.css"?><svg xmlns="http://www.w3.org/2000/svg"/>`,
    animateHref: `<svg xmlns="http://www.w3.org/2000/svg"><a><set attributeName="href" to="javascript:alert(1)"/></a></svg>`,
    notSvg: `<html><body>hello</body></html>`,
  };
  for (const [name, svg] of Object.entries(bad))
    it(`refuses ${name}`, () => {
      expect(sanitiseSvg(svg)).toEqual({ ok: false, reason: "This SVG has parts we can’t print." });
    });

  it("passes a plain drawing with in-file references (gradients, <use href='#…'>, url(#…))", () => {
    const svg = `<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><defs><path id="p" d="M0 0h5"/></defs><use xlink:href="#p"/><use href = " #p"/><rect fill="url( '#g' )" width="1" height="1"/><text font-family="DejaVu Sans Mono">only words</text></svg>`;
    expect(sanitiseSvg(svg)).toEqual({ ok: true, svg: svg.trim() });
    expect(sanitiseSvg(SVG_LOGO).ok).toBe(true);
  });

  it("the refusal line is the reasons file's", () => {
    expect(REASONS.svg).toBe("This SVG has parts we can’t print.");
  });
});

describe("uploads: placement on the catalogue's grid", () => {
  const square = (n: number, w = 400, h = 400) => {
    const m = new Uint8Array(w * h);
    for (let y = 100; y < 100 + n; y++) for (let x = 50; x < 50 + n; x++) m[y * w + x] = 1;
    return m;
  };

  it("Full: trimmed to the ink, fitted whole, from the top margin, centred across", () => {
    const b = box(place(square(200), 400, 400, "full"));
    // A square fits by the width: 1500 wide, starting at TOP.
    expect(b).toEqual({ x0: 0, y0: TOP, x1: OUT_W - 1, y1: TOP + OUT_W - 1 });
    expect(TOP).toBe(60);
  });

  it("Small: a 12 × 12 cm square at the same top, centred across", () => {
    const b = box(place(square(200), 400, 400, "small"));
    const s = BOXES.small;
    expect(s.w).toBe(Math.round(120 * PX_PER_MM));
    expect(b.y0).toBe(TOP);
    expect(b.x0).toBe(s.x);
    expect(b.x1).toBe(s.x + s.w - 1);
    expect(Math.abs(s.x + s.w / 2 - OUT_W / 2)).toBeLessThanOrEqual(1);
  });

  it("a tall picture fits by its height and is centred", () => {
    const m = new Uint8Array(100 * 400);
    for (let y = 0; y < 400; y++) for (let x = 20; x < 60; x++) m[y * 100 + x] = 1;
    const b = box(place(m, 100, 400, "full"));
    expect(b.y0).toBe(TOP);
    expect(b.y1).toBe(TOP + BOXES.full.h - 1);
    expect(Math.abs((b.x0 + b.x1) / 2 - OUT_W / 2)).toBeLessThanOrEqual(1);
  });

  it("nothing inked, nothing placed", () => {
    expect(share(place(new Uint8Array(100), 10, 10, "full"))).toBe(0);
  });

  it("clean: specks under 0.3 mm² go, pinholes under 0.3 mm² fill, larger ones stay", () => {
    const [w, h] = [200, 200];
    const m = new Uint8Array(w * h);
    for (let y = 50; y < 150; y++) for (let x = 50; x < 150; x++) m[y * w + x] = 1;
    // 0.3 mm² at 1 px = 0.187 mm is 8.6 px: a 2 × 2 hole fills, a 4 × 4 hole stays; a 2 × 2 speck goes, a 4 × 4 stays.
    for (const [x0, y0, n, v] of [[70, 70, 2, 0], [100, 100, 4, 0], [10, 10, 2, 1], [170, 170, 4, 1]]) for (let y = y0; y < y0 + n; y++) for (let x = x0; x < x0 + n; x++) m[y * w + x] = v;
    clean(m, w, h, PX_PER_MM);
    expect(m[70 * w + 70]).toBe(1);
    expect(m[100 * w + 100]).toBe(0);
    expect(m[10 * w + 10]).toBe(0);
    expect(m[170 * w + 170]).toBe(1);
  });

  it("the size limits: short side 1,100 px for Full, 800 for Small", () => {
    expect(tooSmall(1099, 3000, "full")).toBe(true);
    expect(tooSmall(1100, 3000, "full")).toBe(false);
    expect(tooSmall(799, 900, "small")).toBe(true);
    expect(tooSmall(800, 900, "small")).toBe(false);
  });

  it("downscale: area averaged, premultiplied (a transparent pixel's colour never bleeds)", () => {
    const p: Pixels = { w: 4, h: 2, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 255, 255, 255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 255, 255]) };
    const d = downscale(p, 2);
    expect([d.w, d.h]).toEqual([2, 1]);
    expect(Array.from(d.data)).toEqual([255, 0, 0, 128, 0, 0, 255, 255]);
    expect(downscale(p, 10)).toBe(p);
  });
});

describe("uploads: the photograph's screen (port of scripts/photos/halftone.py)", () => {
  const REF = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "halftone-parity.json"), "utf8")) as Record<string, { w: number; h: number; ink: number; blocks: number[] }>;

  it("matches halftone.py on three tones: ink over every 32 × 32 block within 2% on average", () => {
    const [bw, bh] = [Math.floor(OUT_W / BLOCK), Math.floor(OUT_H / BLOCK)];
    for (const t of parityTones()) {
      const ref = REF[t.name];
      expect([ref.w, ref.h]).toEqual([t.w, t.h]);
      const src = Float32Array.from(t.data, (v) => v / 255);
      const ink = screenTone(lanczos(src, t.w, t.h, OUT_W, OUT_H));
      let diff = 0;
      for (let by = 0; by < bh; by++)
        for (let bx = 0; bx < bw; bx++) {
          let s = 0;
          for (let y = 0; y < BLOCK; y++) for (let x = 0; x < BLOCK; x++) s += ink[(by * BLOCK + y) * OUT_W + bx * BLOCK + x];
          diff += Math.abs(s / (BLOCK * BLOCK) - ref.blocks[by * bw + bx]);
        }
      expect(diff / (bw * bh), t.name).toBeLessThan(0.02);
      expect(Math.abs(share(ink) - ref.ink), t.name).toBeLessThan(0.005);
    }
  });

  it("strictly two-tone, a dark mass capped to a mesh (never a solid slab), a stroke kept solid", () => {
    const D = new Float32Array(OUT_W * OUT_H);
    for (let y = 400; y < 900; y++) for (let x = 300; x < 1200; x++) D[y * OUT_W + x] = 1;
    for (let y = 1200; y < 1210; y++) for (let x = 300; x < 1200; x++) D[y * OUT_W + x] = 1;
    const ink = screenTone(D);
    expect(ink.every((v) => v === 0 || v === 1)).toBe(true);
    let mass = 0;
    for (let y = 500; y < 800; y++) for (let x = 400; x < 1100; x++) mass += ink[y * OUT_W + x];
    // MAX_TONE is a tone: round dots at 0.8 cover about 86% of their cells (halftone.py's screen does the same).
    expect(mass / (300 * 700)).toBeGreaterThan(0.8);
    expect(mass / (300 * 700)).toBeLessThan(0.88);
    // The 10 px stroke (narrower than SLAB_PX) prints solid.
    let stroke = 0;
    for (let y = 1200; y < 1210; y++) for (let x = 400; x < 1100; x++) stroke += ink[y * OUT_W + x];
    expect(stroke / (10 * 700)).toBe(1);
    expect(SLAB_PX).toBe(19);
    expect(solidBlock({ w: OUT_W, h: OUT_H, ink: Float32Array.from(ink) }).reject).toBeNull();
  });

  it("dots 8–80%: the lightest tone prints nothing, a faint one the smallest dot", () => {
    const flat = (v: number) => share(screenTone(new Float32Array(OUT_W * OUT_H).fill(v)));
    expect(flat(0.03)).toBe(0);
    const faint = flat(0.08);
    expect(faint).toBeGreaterThan(0.05);
    expect(faint).toBeLessThan(0.11);
    expect(flat(1)).toBeGreaterThan(0.8);
    expect(flat(1)).toBeLessThan(0.88);
    expect(MAX_TONE).toBe(0.8);
  });

  it("never inverted: a black tee's ink draws the lights, a white tee's the darks", () => {
    const c = convert({ pixels: photo() }, { size: "full" });
    const [black, white] = [inkFor(c, "black"), inkFor(c, "white")];
    const { lum, alpha } = c.tone!;
    let [bl, bd, wl, wd, nl, nd] = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < lum.length; i++) {
      if (alpha[i] < 1) continue;
      if (lum[i] > 0.75) (nl++, (bl += black[i]), (wl += white[i]));
      else if (lum[i] < 0.25) (nd++, (bd += black[i]), (wd += white[i]));
    }
    expect(bl / nl).toBeGreaterThan(bd / nd);
    expect(wd / nd).toBeGreaterThan(wl / nl);
    // The default ink is the picture's own side: a dark picture on white.
    expect(Buffer.compare(c.ink, inkFor(c, c.darkOnLight ? "white" : "black"))).toBe(0);
  });

  it("a flat backdrop is taken off (never a field of dots); a busy one is kept", () => {
    const flat = convert({ pixels: photo(1600, 1200, 3, true) }, { size: "full" });
    const busy = convert({ pixels: photo() }, { size: "full" });
    // The corner of the picture's box: backdrop on a ball, picture in a busy frame.
    const corner = (c: typeof flat) => {
      let a = 0;
      for (let y = TOP; y < TOP + 60; y++) for (let x = 0; x < 60; x++) a += c.tone!.alpha[y * OUT_W + x];
      return a / 3600;
    };
    expect(corner(flat)).toBeLessThan(0.05);
    expect(corner(busy)).toBeGreaterThan(0.95);
    // With the backdrop off, the print is the ball: trimmed to it, so it spans the width.
    const b = box(flat.ink);
    expect(b.x1 - b.x0).toBeGreaterThan(OUT_W * 0.9);
  });
});

describe("uploads: speed", () => {
  it("a 12 MP photograph converts well inside the budget (≤ 1.5 s at 4× throttle in a browser; generous here)", () => {
    const big = photo(4000, 3000, 5);
    convert({ pixels: big }, { size: "full" });
    const t = performance.now();
    const runs = 3;
    for (let i = 0; i < runs; i++) convert({ pixels: big }, { size: "full" });
    const ms = (performance.now() - t) / runs;
    console.log(`12 MP photograph: ${ms.toFixed(0)} ms a conversion`);
    expect(ms).toBeLessThan(3000);
  }, 60_000);
});

describe("uploads: an SVG built to hang or to reach out is refused", () => {
  const wrap = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`;
  it("nested <use> past the limit (ten million shapes from a few lines), and CSS escapes", () => {
    let body = '<g id="l0"><rect width="1" height="1"/></g>';
    for (let i = 1; i <= 7; i++) body += `<g id="l${i}">${Array.from({ length: 10 }, () => `<use href="#l${i - 1}"/>`).join("")}</g>`;
    expect(sanitiseSvg(wrap(body)).ok).toBe(false);
    expect(sanitiseSvg(wrap('<style>rect{fill:u\\72l(https://evil.example/x.svg#a)}</style><rect width="1" height="1"/>')).ok).toBe(false);
    expect(sanitiseSvg(wrap('<rect style="fill:u\\72l(#a)" width="1" height="1"/>')).ok).toBe(false);
    // An ordinary drawing with a few reused shapes still passes.
    expect(sanitiseSvg(wrap('<defs><circle id="c" r="1"/></defs><use href="#c"/><use href="#c" x="3"/>')).ok).toBe(true);
  });
  it("a backslash outside the styles (a file path in <desc>) is text, not a CSS escape", () => {
    expect(sanitiseSvg(wrap('<style>rect{fill:#000}</style><desc>C:\\Users\\me\\art.ai</desc><rect width="1" height="1"/>')).ok).toBe(true);
  });
  it("counting stays linear: a big map with ids, and a file nested thousands deep, are checked at once", () => {
    const map = wrap(Array.from({ length: 80_000 }, (_, i) => `<path id="p${i}" d="M0 0h1"/>`).join(""));
    let t = performance.now();
    expect(shapesOf(map)).toBe(80_001); // the <svg> counts too
    expect(performance.now() - t).toBeLessThan(1500);
    const deep = wrap(`${Array.from({ length: 20_000 }, (_, i) => `<g id="g${i}">`).join("")}<rect width="1" height="1"/>${"</g>".repeat(20_000)}`);
    t = performance.now();
    expect(shapesOf(deep)).toBe(20_002);
    expect(performance.now() - t).toBeLessThan(1500);
  });
});
