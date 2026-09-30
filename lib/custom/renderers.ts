/**
 * Each template's drawing, loaded when a page first needs it: the four dated
 * products share lib/custom (index); every other template is its own chunk,
 * so a product's page carries only its own drawing code.
 */
import type { BaseColor } from "@/types/shirt";
import type { Lines } from "./kit";
import type { City, CustomSpec, TemplateId } from "./spec";
import type { Countries } from "./data";
import type { SkyData } from "./templates/sky";

/** What a template may need besides its spec: the sky's stars and the place (Your Night Sky). */
export interface RenderData {
  sky?: SkyData;
  city?: City;
  /** The place list (data/cities): Your Place draws its cities as the globe's only land. */
  places?: City[];
  /** The countries (data/countries): Your Countries' map. */
  countries?: Countries;
}
export type Renderer = (spec: CustomSpec, color: BaseColor, data: RenderData) => string;

/** A template's caption lines as ours (before the visitor's own, `cap`): what the caption editor shows for a line not yet rewritten. */
export type Captioner = (spec: CustomSpec, data: RenderData) => Lines;

/** A template's chunk: its drawing, its caption's lines, and what it loads first (data of its own, published at build time), when it needs any. */
export interface TemplateModule {
  render: Renderer;
  /** Every template has one; optional only while the templates move to it. */
  captionOf: Captioner;
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
  editions: () => import("./templates/editions"),
  sayings: () => import("./templates/sayings"),
  label: () => import("./templates/label"),
  credits: () => import("./templates/credits"),
  card: () => import("./templates/card"),
  receipt: () => import("./templates/receipt"),
  message: () => import("./templates/message"),
  birth: () => import("./templates/birth"),
  sign: () => import("./templates/sign"),
  signpost: () => import("./templates/signpost"),
  tour: () => import("./templates/tour"),
  lineup: () => import("./templates/lineup"),
  patch: () => import("./templates/patch"),
  sampler: () => import("./templates/sampler"),
  countries: () => import("./templates/countries"),
  telegram: () => import("./templates/telegram"),
};

/** What a template needs loaded before it draws a spec ({} for most). */
export async function prepareData(spec: CustomSpec): Promise<RenderData> {
  const own = OWN[spec.t];
  const m = own ? await own() : null;
  return m?.prepare ? m.prepare(spec) : {};
}

/** A template's caption lines (ours), from its chunk (the dated four from lib/custom). */
export async function loadCaptioner(t: TemplateId): Promise<Captioner> {
  const own = OWN[t];
  if (own) return (await own()).captionOf;
  return (await import("./index")).customCaption;
}

export async function loadRenderer(t: TemplateId): Promise<Renderer> {
  const own = OWN[t];
  if (own) return (await own()).render;
  return (await import("./index")).renderCustomSvg;
}
