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
}
export type Renderer = (spec: CustomSpec, color: BaseColor, data: RenderData) => string;

/** Templates with a chunk of their own (each module exports `render`). */
const OWN: Partial<Record<TemplateId, () => Promise<{ render: Renderer }>>> = {
  code: () => import("./templates/code"),
};

export async function loadRenderer(t: TemplateId): Promise<Renderer> {
  const own = OWN[t];
  if (own) return (await own()).render;
  return (await import("./index")).renderCustomSvg;
}
