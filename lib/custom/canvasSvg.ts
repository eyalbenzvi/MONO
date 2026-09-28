/**
 * A computed print drawn straight onto a canvas: the handful of SVG elements
 * the templates write (rect, circle, line, path, text; flat fills and strokes;
 * groups that translate and scale) drawn with the canvas's own primitives, path data through Path2D (which
 * reads SVG path data as it is). Several times faster than decoding the SVG
 * as an image, which is what lets the editor's preview follow the typing.
 * Text is set in DejaVu Sans Mono, registered once through the FontFace API
 * from the same subset files (scripts/tools/buildFonts.py).
 */
import { assetUrl } from "@/lib/catalog";

const FILES = [
  ["/fonts/dejavu-sans-mono.woff2", "normal"],
  ["/fonts/dejavu-sans-mono-bold.woff2", "bold"],
] as const;
/** The family the canvas uses (its own name, so a system DejaVu can't stand in for the subset). */
export const FAMILY = "MONO DejaVu Sans Mono";

let fonts: Promise<void> | null = null;
/** Registers the print font with the document (once). A missing file falls back to the monospace face. */
export function loadCanvasFonts(): Promise<void> {
  fonts ??= Promise.all(
    FILES.map(([file, weight]) =>
      fetch(assetUrl(file))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(file))))
        .then((buf) => new FontFace(FAMILY, buf, { weight }).load())
        .then((face) => void document.fonts.add(face))
        .catch(() => {}),
    ),
  ).then(() => {});
  return fonts;
}

const ELEMENT = /<(rect|circle|line|path|text)\b([^>]*?)(?:\/>|>([^<]*)<\/text>)|<g\b([^>]*)>|<\/g>/g;
/** A group's transform: translate(x y) and scale(k [k]), in that order or alone (all the templates write). */
const TRANSFORM = /(translate|scale)\(\s*([-\d.e]+)(?:[\s,]+([-\d.e]+))?\s*\)/g;
const ATTR = /([\w:-]+)="([^"]*)"/g;
const entities = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/**
 * Draws a 300 × 400 print into the context's current transform scaled to
 * w × h. Inks and ground are the SVG's own colours.
 */
export function drawSvg(ctx: CanvasRenderingContext2D, svg: string, w: number, h: number) {
  ctx.save();
  ctx.scale(w / 300, h / 400);
  for (const [whole, tag, attrText, content, groupAttrs] of svg.matchAll(ELEMENT)) {
    if (!tag) {
      if (whole === "</g>") ctx.restore();
      else {
        ctx.save();
        const t = /transform="([^"]*)"/.exec(groupAttrs ?? "")?.[1] ?? "";
        for (const [, op, x, y] of t.matchAll(TRANSFORM)) {
          if (op === "translate") ctx.translate(Number(x), Number(y ?? 0));
          else ctx.scale(Number(x), Number(y ?? x));
        }
      }
      continue;
    }
    const a: Record<string, string> = {};
    for (const [, k, v] of attrText.matchAll(ATTR)) a[k] = v;
    const n = (k: string, d = 0) => (a[k] !== undefined ? Number(a[k]) : d);
    const fill = a.fill && a.fill !== "none" ? a.fill : null;
    const stroke = a.stroke && a.stroke !== "none" ? a.stroke : null;
    ctx.lineWidth = n("stroke-width", 1);
    ctx.lineCap = (a["stroke-linecap"] as CanvasLineCap) ?? "butt";
    ctx.lineJoin = (a["stroke-linejoin"] as CanvasLineJoin) ?? "miter";
    if (tag === "text") {
      const size = n("font-size", 16);
      ctx.font = `${a["font-weight"] === "bold" ? "bold " : ""}${size}px "${FAMILY}", monospace`;
      ctx.fillStyle = fill ?? "#000";
      ctx.textBaseline = "alphabetic";
      const text = entities(content ?? "");
      const spacing = n("letter-spacing");
      const chars = [...text];
      const widths = chars.map((c) => ctx.measureText(c).width);
      // SVG letter-spacing follows every character, and the anchor counts it.
      const total = widths.reduce((s, x) => s + x + spacing, 0);
      const anchor = a["text-anchor"] ?? "start";
      let x = n("x") - (anchor === "middle" ? total / 2 : anchor === "end" ? total : 0);
      ctx.textAlign = "left";
      if (!spacing) ctx.fillText(text, x, n("y"));
      else
        chars.forEach((c, i) => {
          ctx.fillText(c, x, n("y"));
          x += widths[i] + spacing;
        });
      continue;
    }
    const p = new Path2D();
    if (tag === "rect") {
      const r = n("rx");
      if (r && typeof p.roundRect === "function") p.roundRect(n("x"), n("y"), n("width"), n("height"), r);
      else p.rect(n("x"), n("y"), n("width"), n("height"));
    }
    else if (tag === "circle") p.arc(n("cx"), n("cy"), n("r"), 0, Math.PI * 2);
    else if (tag === "line") (p.moveTo(n("x1"), n("y1")), p.lineTo(n("x2"), n("y2")));
    else p.addPath(new Path2D(a.d ?? ""));
    // SVG's default fill is black; the templates always say what they mean.
    if (fill || (a.fill === undefined && tag !== "line")) (ctx.fillStyle = fill ?? "#000"), ctx.fill(p);
    if (stroke) (ctx.strokeStyle = stroke), ctx.stroke(p);
  }
  ctx.restore();
}

/** The print alone on a new canvas of w × h pixels. */
export function printCanvas(svg: string, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  drawSvg(ctx, svg, w, h);
  return c;
}
