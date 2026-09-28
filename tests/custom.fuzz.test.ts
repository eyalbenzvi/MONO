import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import shirts from "../data/shirts.json";
import { renderCustomSvg, FIRST_YEAR, LAST_YEAR, TITLE_MAX, type City, type CustomSpec } from "@/lib/custom";
import { decodeCities } from "@/lib/custom/data";
import { customModelIds } from "@/lib/custom/models";
import { WEAK_QUALITY, assessPrint, solidBlock, svgInk } from "../scripts/gen/quality";
import { mulberry32 } from "../scripts/gen/core";
import { modelFor } from "@/lib/models";

const ROOT = path.resolve(__dirname, "..");
const readJson = (f: string) => JSON.parse(readFileSync(path.join(ROOT, f), "utf8"));
const SKY = { stars: readJson("data/sky/stars.json"), lines: (readJson("data/sky/constellations.json") as { lines: [number, number][][] }[]).flatMap((c) => c.lines) };
const places = decodeCities(readJson("data/cities/cities.json"));

/** What the audit measures, the monospace way: a text's width in print units (DejaVu Sans Mono's advance is 0.602 em). */
function textWidths(svg: string): { text: string; width: number }[] {
  return [...svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)].map(([, attrs, t]) => {
    const size = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? 0);
    const spacing = Number(/letter-spacing="([\d.]+)"/.exec(attrs)?.[1] ?? 0);
    const chars = [...t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")].length;
    return { text: t, width: chars * (0.602 * size + spacing) };
  });
}

/** A print that may be applied: not a solid block, and not weak by the catalogue's own line. */
function check(svg: string, color: "black" | "white") {
  const raster = svgInk(svg, color);
  const a = assessPrint(raster);
  return { solid: solidBlock(raster).reject, quality: a.quality, flags: a.flags, wide: textWidths(svg).filter((t) => t.width > 292) };
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayCount = Math.round((Date.UTC(LAST_YEAR, 11, 31) - Date.UTC(FIRST_YEAR, 0, 1)) / 86400000);
const dateOf = (k: number) => new Date(Date.UTC(FIRST_YEAR, 0, 1) + k * 86400000).toISOString().slice(0, 10);

describe("personalised prints: every input makes a printable print", () => {
  it("2,000 random skies (and the edges: longest names, the poles' nearest cities, the equator, the range's ends) pass the solid-block and quality checks, and no caption line is wider than the print", () => {
    const rnd = mulberry32(0x5eed);
    const list = places.list;
    const longest = [...list].sort((a, b) => b.name.length - a.name.length || a.id - b.id).slice(0, 20);
    const byLat = [...list].sort((a, b) => a.lat - b.lat);
    const equator = [...list].sort((a, b) => Math.abs(a.lat) - Math.abs(b.lat))[0];
    const edges: [City, string, string | undefined][] = [
      ...longest.map((c) => [c, dateOf(Math.floor(rnd() * dayCount)), "23:59"] as [City, string, string]),
      [byLat[0], "1900-01-01", "00:00"],
      [byLat[byLat.length - 1], "2100-12-31", undefined],
      [equator, "1900-01-01", undefined],
      [equator, "2100-12-31", "12:00"],
    ];
    const random: [City, string, string | undefined][] = Array.from({ length: 2000 }, () => [list[Math.floor(rnd() * list.length)], dateOf(Math.floor(rnd() * (dayCount + 1))), rnd() < 0.5 ? undefined : `${pad(Math.floor(rnd() * 24))}:${pad(Math.floor(rnd() * 60))}`]);
    const failures: string[] = [];
    for (const [city, d, t] of [...edges, ...random]) {
      const spec: CustomSpec = { t: "sky", v: 1, p: { c: city.id, d, ...(t ? { t } : {}) } };
      const color = rnd() < 0.5 ? "black" : "white";
      const r = check(renderCustomSvg(spec, color, { sky: SKY, city }), color);
      if (r.solid || r.quality < WEAK_QUALITY || r.flags.length || r.wide.length) failures.push(`${city.name} ${d} ${t ?? ""} ${color}: ${JSON.stringify(r)}`);
    }
    expect(failures.slice(0, 5)).toEqual([]);
    expect(longest[0].name.length).toBeGreaterThan(0);
    expect(TITLE_MAX).toBeLessThanOrEqual(41);
  }, 300_000);

  it("200 moon years, north and south, pass too", () => {
    const rnd = mulberry32(0x3007);
    const failures: string[] = [];
    for (let i = 0; i < 200; i++) {
      const y = i === 0 ? FIRST_YEAR : i === 1 ? LAST_YEAR : FIRST_YEAR + Math.floor(rnd() * (LAST_YEAR - FIRST_YEAR + 1));
      const spec: CustomSpec = { t: "moon", v: 1, p: { y, ...(rnd() < 0.5 ? { s: 1 as const } : {}) } };
      const color = rnd() < 0.5 ? "black" : "white";
      const r = check(renderCustomSvg(spec, color, {}), color);
      if (r.solid || r.quality < WEAK_QUALITY || r.flags.length || r.wide.length) failures.push(`${y} ${JSON.stringify(r)}`);
    }
    expect(failures.slice(0, 5)).toEqual([]);
  }, 120_000);
});

describe("personalised prints: the model photos they're drawn on", () => {
  it("the list postbuild keeps is exactly what modelFor returns for the ten base designs in both colours, and every file is there", () => {
    const base = (shirts as unknown as { n: number; variant: string }[]).filter((s) => s.variant === "sky-night" || s.variant === "moon-year");
    const ids = customModelIds(shirts as unknown as { n: number; variant: string }[]);
    const wanted = new Set(base.flatMap((s) => (["black", "white"] as const).map((c) => modelFor(s, c)!.id)));
    expect(new Set(ids)).toEqual(wanted);
    for (const id of ids) expect(existsSync(path.join(ROOT, "public", "models", `${id}.webp`)), id).toBe(true);
  });
});
