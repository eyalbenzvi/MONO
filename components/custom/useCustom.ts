"use client";

import { useEffect, useState } from "react";
import { templateFor, type City, type CustomSpec } from "@/lib/custom/spec";
import { STORE_POLICY } from "@/lib/store-policy";
import { useUiStore } from "@/store/useUiStore";
import type { BaseColor, ShirtProduct } from "@/types/shirt";

type Render = typeof import("./customRender");
let render: Promise<Render> | null = null;
/** The drawing chunk (templates, place list, sky), loaded once. */
export const loadRender = () => (render ??= import("./customRender"));

/** What a spec looks like on the page, once drawn: the picture, and its title and summary. */
interface Drawn {
  spec: CustomSpec;
  color: BaseColor;
  svg: string;
  title: string;
  summary: string;
}

async function draw(spec: CustomSpec, color: BaseColor): Promise<Omit<Drawn, "spec" | "color">> {
  const m = await loadRender();
  let city: City | undefined;
  const data: { sky?: Awaited<ReturnType<Render["loadSky"]>>; city?: City } = {};
  if (spec.t === "sky") {
    const [sky, places] = await Promise.all([m.loadSky(), m.loadCities()]);
    city = places.byId(spec.p.c);
    if (!city) throw new Error("unknown city");
    Object.assign(data, { sky, city });
  }
  return { svg: m.renderCustomSvg(spec, color, data), title: m.customTitle(spec, city), summary: m.customSummary(spec, city) };
}

/** A spec drawn for a colour (null until it's ready; the last one stays while the next is drawn). */
function useDrawn(spec: CustomSpec | null, color: BaseColor): Drawn | null {
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  useEffect(() => {
    if (!spec) return setDrawn(null);
    let live = true;
    draw(spec, color)
      .then((d) => live && setDrawn({ ...d, spec, color }))
      .catch(() => live && setDrawn(null));
    return () => {
      live = false;
    };
  }, [spec, color]);
  // While the next one is drawn, the last stays (no flash of the original).
  return spec ? drawn : null;
}

/**
 * A product page's personalised print, if one is applied (useUiStore.custom,
 * set from the address or the editor): its title, summary, price and
 * picture. `preview` is what the open editor shows (the picture only; the
 * title and price move when it's used).
 */
export function useCustom(shirt: ShirtProduct | undefined, color: BaseColor, preview?: CustomSpec | null) {
  const applied = useUiStore((s) => (shirt ? s.custom[shirt.id] : undefined)) ?? null;
  const shown = useDrawn(preview ?? applied, color);
  const titled = useDrawn(applied, color);
  return {
    template: shirt ? templateFor(shirt) : null,
    spec: applied,
    title: applied && titled ? titled.title : (shirt?.title ?? ""),
    summary: applied && titled ? titled.summary : null,
    price: (shirt?.price ?? 0) + (applied ? STORE_POLICY.customPremium : 0),
    /** The picture to draw instead of the baked one (null: the original's). */
    svg: (preview ?? applied) ? (shown?.svg ?? null) : null,
  };
}

/**
 * Arriving on a personalised print's link (`?make=…`, and `&edit=1` from the
 * bag): the spec is checked against the place list and applied when it's for
 * this design's template; anything else is ignored and the original shows.
 * Returns whether the editor should open (and takes `edit` out of the address).
 */
export function useCustomArrival(shirt: ShirtProduct | undefined, hydrated: boolean): boolean {
  const [edit, setEdit] = useState(false);
  const setCustom = useUiStore((s) => s.setCustom);
  useEffect(() => {
    const template = shirt ? templateFor(shirt) : null;
    if (!hydrated || !shirt || !template) return;
    const q = new URLSearchParams(window.location.search);
    const make = q.get("make");
    if (q.has("edit")) {
      q.delete("edit");
      const rest = q.toString();
      window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
      setEdit(true);
    }
    if (!make) return;
    let live = true;
    loadRender()
      .then((m) => m.loadCities().then((places) => m.decodeMake(make, places.byId)))
      .then((spec) => {
        if (live && spec && spec.t === template) setCustom(shirt.id, spec);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [hydrated, shirt, setCustom]);
  return edit;
}
