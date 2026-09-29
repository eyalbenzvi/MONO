/**
 * Each template's drawing, loaded when a page first needs it: the four dated
 * products share lib/custom (index); every other template is its own chunk,
 * so a product's page carries only its own drawing code.
 */
import type { BaseColor } from "@/types/shirt";
import type { City, CustomSpec, TemplateId } from "./spec";
import type { SkyData } from "./templates/sky";

/** What a template may need besides its spec: the sky's stars and the place (Your Night Sky). */
export interface RenderData {
  sky?: SkyData;
  city?: City;
  /** The place list (data/cities): Your Place draws its cities as the globe's only land. */
  places?: City[];
}
export type Renderer = (spec: CustomSpec, color: BaseColor, data: RenderData) => string;

/** A template's chunk: its drawing, and what it loads first (data of its own, published at build time), when it needs any. */
export interface TemplateModule {
  render: Renderer;
  prepare?: (spec: CustomSpec) => Promise<RenderData>;
}
/** Templates with a chunk of their own (each module exports `render`, and `prepare` when it needs data). */
const OWN: Partial<Record<TemplateId, () => Promise<TemplateModule>>> = {
  taste: () => import("./templates/taste"),
  code: () => import("./templates/code"),
  line: () => import("./templates/line"),
  voice: () => import("./templates/voice"),
  house: () => import("./templates/house"),
  number: () => import("./templates/number"),
  place: () => import("./templates/place"),
  ascii: () => import("./templates/ascii"),
  weeks: () => import("./templates/weeks"),
  elements: () => import("./templates/elements"),
  crossword: () => import("./templates/crossword"),
  journey: () => import("./templates/journey"),
  snowflake: () => import("./templates/snowflake"),
  maze: () => import("./templates/maze"),
  automaton: () => import("./templates/automaton"),
  julia: () => import("./templates/julia"),
  rings: () => import("./templates/rings"),
  family: () => import("./templates/family"),
  orbits: () => import("./templates/orbits"),
  tartan: () => import("./templates/tartan"),
  musicbox: () => import("./templates/musicbox"),
  monogram: () => import("./templates/monogram"),
  chess: () => import("./templates/chess"),
  metro: () => import("./templates/metro"),
  route: () => import("./templates/route"),
  island: () => import("./templates/island"),
  qr: () => import("./templates/qr"),
};

/** What a template needs loaded before it draws a spec ({} for most). */
export async function prepareData(spec: CustomSpec): Promise<RenderData> {
  const own = OWN[spec.t];
  const m = own ? await own() : null;
  return m?.prepare ? m.prepare(spec) : {};
}

export async function loadRenderer(t: TemplateId): Promise<Renderer> {
  const own = OWN[t];
  if (own) return (await own()).render;
  return (await import("./index")).renderCustomSvg;
}
