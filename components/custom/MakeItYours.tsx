"use client";

import { Icon } from "@/components/Icon";
import { loadRender } from "@/components/custom/useCustom";
import type { TemplateId } from "@/lib/custom/spec";

/** Warm what the editor needs (its chunk, the templates, the place list and the sky) the moment its entry is pointed at. */
export function prefetchEditor() {
  import("@/components/custom/EditorSheet");
  loadRender().then((m) => Promise.all([m.loadCities(), m.loadSky()]).catch(() => {}));
}

/**
 * The one quiet line under a base design's title: "Your place, your date →"
 * (a sky) or "Your year →" (the moon), and once a print is made personal, its
 * summary with "Edit". Nothing at all for any other design.
 */
export function MakeItYours({ template, summary, onOpen }: { template: TemplateId | null; summary: string | null; onOpen: () => void }) {
  if (!template) return null;
  const warm = { onPointerEnter: prefetchEditor, onFocus: prefetchEditor, onTouchStart: prefetchEditor };
  if (summary)
    return (
      <p className="mt-1 text-sm text-neutral-400" data-custom-summary>
        {summary} ·{" "}
        <button type="button" onClick={onOpen} {...warm} className="-my-2 inline-flex h-10 items-center text-neutral-300 underline underline-offset-4 hover:text-white">
          Edit
        </button>
      </p>
    );
  return (
    <button type="button" onClick={onOpen} {...warm} className="-my-1.5 mt-0 inline-flex h-10 items-center gap-1 text-sm text-neutral-400 transition-colors hover:text-white" data-make-it-yours>
      {template === "sky" ? "Your place, your date" : "Your year"}
      <Icon name="arrow-right" className="h-3.5 w-3.5" />
    </button>
  );
}
