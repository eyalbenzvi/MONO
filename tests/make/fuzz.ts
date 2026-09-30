/**
 * What every Make template's fuzz checks (tests/make/*.test.ts): the print
 * the catalogue would accept (no solid block, not weak by its own line, no
 * flags) and no text wider than the print. Measured with resvg, as the
 * catalogue's audit measures its own designs.
 */
import { FONT_FAMILY, textWidth, type Family } from "@/lib/custom/kit";
import { WEAK_QUALITY, assessPrint, solidBlock, svgInk } from "../../scripts/gen/quality";

/** The family a text's font-family names (lib/custom/kit FONT_FAMILY). */
const familyOf = (attrs: string): Family => {
  const f = /font-family="([^"]*)"/.exec(attrs)?.[1] ?? "";
  return (Object.entries(FONT_FAMILY).find(([, v]) => v === f)?.[0] as Family | undefined) ?? "mono";
};

/** A text's width in print units, in its own face (lib/custom/kit textWidth: the font files' advances), scaled by an enclosing group's scale when there is one. */
export function wideTexts(svg: string, max = 292): string[] {
  const out: string[] = [];
  const scale = [1];
  for (const m of svg.matchAll(/<g\b(?:[^>]*?scale\(([\d.]+)[^)]*\))?[^>]*>|<\/g>|<text([^>]*)>([^<]*)<\/text>/g)) {
    if (m[0] === "</g>") scale.pop();
    else if (m[0].startsWith("<g")) scale.push(scale[scale.length - 1] * Number(m[1] ?? 1));
    else {
      const size = Number(/font-size="([\d.]+)"/.exec(m[2])?.[1] ?? 0);
      const spacing = Number(/letter-spacing="([\d.]+)"/.exec(m[2])?.[1] ?? 0);
      const t = m[3].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      if (textWidth(t, size, { spacing, family: familyOf(m[2]), bold: /font-weight="bold"/.test(m[2]) }) * scale[scale.length - 1] > max) out.push(m[3]);
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
