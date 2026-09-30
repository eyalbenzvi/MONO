/**
 * A computed print drawn straight onto a canvas: the handful of SVG elements
 * the templates write (rect, circle, line, path, text; flat fills and strokes;
 * groups that translate and scale) drawn with the canvas's own primitives, path data through Path2D (which
 * reads SVG path data as it is). Several times faster than decoding the SVG
 * as an image, which is what lets the editor's preview follow the typing.
 * Text is set in the family the SVG names (DejaVu Sans Mono, or the Make
 * prints' serif, condensed or blackletter), each registered once through the
 * FontFace API from the same subset files (scripts/tools/buildFonts.py,
 * buildPrintFonts.py).
 */
import { assetUrl } from "@/lib/catalog";

/** The family the canvas uses (its own name, so a system DejaVu can't stand in for the subset). */
export const FAMILY = "MONO DejaVu Sans Mono";
/** Each SVG family (lib/custom/kit FONT_FAMILY, first name) and the canvas's own name for it. */
const FAMILIES: Record<string, string> = {
  "DejaVu Sans Mono": FAMILY,
  "Libre Caslon Text": "MONO Libre Caslon Text",
  Oswald: "MONO Oswald",
  UnifrakturMaguntia: "MONO UnifrakturMaguntia",
  "IBM Plex Mono": "MONO IBM Plex Mono",
  "Space Grotesk": "MONO Space Grotesk",
  Cinzel: "MONO Cinzel",
  "Playfair Display": "MONO Playfair Display",
};
const FILES = [
  ["/fonts/dejavu-sans-mono.woff2", FAMILY, "normal"],
  ["/fonts/dejavu-sans-mono-bold.woff2", FAMILY, "bold"],
  ["/fonts/libre-caslon-text.woff2", FAMILIES["Libre Caslon Text"], "normal"],
  ["/fonts/libre-caslon-text-bold.woff2", FAMILIES["Libre Caslon Text"], "bold"],
  ["/fonts/oswald.woff2", FAMILIES.Oswald, "normal"],
  ["/fonts/oswald-bold.woff2", FAMILIES.Oswald, "bold"],
  ["/fonts/unifraktur-maguntia.woff2", FAMILIES.UnifrakturMaguntia, "normal"],
  ["/fonts/ibm-plex-mono.woff2", FAMILIES["IBM Plex Mono"], "normal"],
  ["/fonts/ibm-plex-mono-bold.woff2", FAMILIES["IBM Plex Mono"], "bold"],
  ["/fonts/space-grotesk.woff2", FAMILIES["Space Grotesk"], "normal"],
  ["/fonts/space-grotesk-bold.woff2", FAMILIES["Space Grotesk"], "bold"],
  ["/fonts/cinzel.woff2", FAMILIES.Cinzel, "normal"],
  ["/fonts/cinzel-bold.woff2", FAMILIES.Cinzel, "bold"],
  ["/fonts/playfair-display.woff2", FAMILIES["Playfair Display"], "normal"],
  ["/fonts/playfair-display-bold.woff2", FAMILIES["Playfair Display"], "bold"],
] as const;
/** The canvas font stack for an SVG font-family: its own face, then the generic the SVG names. */
const canvasFamily = (svgFamily: string | undefined) => {
  const [first, generic] = (svgFamily ?? "").split(",").map((f) => f.trim());
  return `"${FAMILIES[first] ?? FAMILY}", ${generic || "monospace"}`;
};

let fonts: Promise<void> | null = null;
/** Registers the print fonts with the document (once). A missing file falls back to the generic face. */
export function loadCanvasFonts(): Promise<void> {
  fonts ??= Promise.all(
    FILES.map(([file, family, weight]) =>
      fetch(assetUrl(file))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(file))))
        .then((buf) => new FontFace(family, buf, { weight }).load())
        .then((face) => void document.fonts.add(face))
        .catch(() => {}),
    ),
  ).then(() => {});
  return fonts;
}

const ELEMENT = /<(rect|circle|line|path|text)\b([^>]*?)(?:\/>|>([^<]*)<\/text>)|<g\b([^>]*)>|<\/g>/g;
/** A group's transform: translate(x y), scale(k [k]) and rotate(a [cx cy]), in the order written (all the templates write). */
const TRANSFORM = /(translate|scale|rotate)\(\s*([-\d.e]+)(?:[\s,]+([-\d.e]+))?(?:[\s,]+([-\d.e]+))?\s*\)/g;
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
        for (const [, op, x, y, z] of t.matchAll(TRANSFORM)) {
          if (op === "translate") ctx.translate(Number(x), Number(y ?? 0));
          else if (op === "scale") ctx.scale(Number(x), Number(y ?? x));
          else {
            // rotate(a cx cy) turns about (cx, cy), as SVG's does.
            const [cx, cy] = [Number(y ?? 0), Number(z ?? 0)];
            ctx.translate(cx, cy);
            ctx.rotate((Number(x) * Math.PI) / 180);
            ctx.translate(-cx, -cy);
          }
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
    ctx.setLineDash(a["stroke-dasharray"] ? a["stroke-dasharray"].split(/[\s,]+/).map(Number) : []);
    if (tag === "text") {
      const size = n("font-size", 16);
      ctx.font = `${a["font-weight"] === "bold" ? "bold " : ""}${size}px ${canvasFamily(a["font-family"])}`;
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
    if (fill || (a.fill === undefined && tag !== "line")) (ctx.fillStyle = fill ?? "#000"), ctx.fill(p, a["fill-rule"] === "evenodd" ? "evenodd" : "nonzero");
    if (stroke) (ctx.strokeStyle = stroke), ctx.stroke(p);
  }
  ctx.restore();
}

/** The print alone on a new canvas of w × h pixels (`readable`: kept in memory, for a caller reading its pixels back: raster layInk). */
export function printCanvas(svg: string, w: number, h: number, readable = false): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", readable ? { willReadFrequently: true } : undefined)!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  drawSvg(ctx, svg, w, h);
  return c;
}
