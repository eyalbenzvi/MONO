/**
 * What every Make template's fuzz checks (tests/make/*.test.ts): the print
 * the catalogue would accept (no solid block, not weak by its own line, no
 * flags) and no text wider than the print. Measured with resvg, as the
 * catalogue's audit measures its own designs.
 */
import { WEAK_QUALITY, assessPrint, solidBlock, svgInk } from "../../scripts/gen/quality";

/** A text's width in print units, the monospace way (DejaVu Sans Mono's advance is 0.602 em), scaled by an enclosing group's scale when there is one. */
export function wideTexts(svg: string, max = 292): string[] {
  const out: string[] = [];
  const scale = [1];
  for (const m of svg.matchAll(/<g\b(?:[^>]*?scale\(([\d.]+)[^)]*\))?[^>]*>|<\/g>|<text([^>]*)>([^<]*)<\/text>/g)) {
    if (m[0] === "</g>") scale.pop();
    else if (m[0].startsWith("<g")) scale.push(scale[scale.length - 1] * Number(m[1] ?? 1));
    else {
      const size = Number(/font-size="([\d.]+)"/.exec(m[2])?.[1] ?? 0);
      const spacing = Number(/letter-spacing="([\d.]+)"/.exec(m[2])?.[1] ?? 0);
      const chars = [...m[3].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")].length;
      if (chars * (0.602 * size + spacing) * scale[scale.length - 1] > max) out.push(m[3]);
    }
  }
  return out;
}

/** Whether a print passes; the numbers when it doesn't. */
export function gate(svg: string, color: "black" | "white"): string | null {
  const raster = svgInk(svg, color);
  const a = assessPrint(raster);
  const solid = solidBlock(raster).reject;
  const wide = wideTexts(svg);
  return solid || a.quality < WEAK_QUALITY || a.flags.length || wide.length ? JSON.stringify({ solid, quality: a.quality, flags: a.flags, wide }) : null;
}
