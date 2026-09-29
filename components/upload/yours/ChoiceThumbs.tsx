"use client";

import { useEffect, useState } from "react";
import { radioKeys } from "@/components/ui";
import { track } from "@/lib/analytics";
import { formatPrice } from "@/lib/format";
import { STORE_POLICY } from "@/lib/store-policy";
import type { Preview, PreviewOk, Settings, Source, Tee } from "@/lib/upload/client";

export type Choice = Tee | "both";

interface Option<T extends string> {
  value: T;
  label: string;
  tag?: string;
}

/** One choice as a pill of text (a radiogroup; arrows move). The stage shows what it makes. */
function Segments<T extends string>({ label, options, value, onChange }: { label: string; options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  const values = options.map((o) => o.value);
  const set = (v: T) => {
    onChange(v);
    track("upload_compare", { control: label.toLowerCase(), value: v });
  };
  const keys = radioKeys(values, value, set);
  const id = `choice-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <p id={id} className="mb-1.5 text-xs font-medium text-neutral-400">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="inline-flex max-w-full flex-wrap gap-1 rounded-3xl bg-white/[0.06] p-1 ring-1 ring-white/10">
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            aria-label={`${o.label}${o.tag ? `, ${o.tag}` : ""}`}
            onClick={() => set(o.value)}
            {...keys(i)}
            className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition ${o.value === value ? "bg-white text-black" : "text-neutral-300 hover:text-white"}`}
            data-choice={o.value}
          >
            {o.label}
            {o.tag && <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{o.tag}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A setting's result (cached), worked out when the page is idle: an option that fails is hidden once known. */
function useAlt(source: Source, settings: Settings, delay: number): Preview | null {
  const [p, setP] = useState<Preview | null>(null);
  const key = JSON.stringify(settings);
  useEffect(() => {
    setP(null);
    let live = true;
    // The engine is loaded on demand (the page shows its first print before it is needed here).
    const t = setTimeout(() => void import("@/lib/upload/client").then((c) => c.convertWith(source, settings)).then((r) => live && setP(r)), delay);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // The settings are compared by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, key, delay]);
  return p;
}
/** Whether an option can be offered: not yet known (kept), or known to print. */
const prints = (p: Preview | null) => !p || p.ok;

/** A photograph's styles: its tone in dots, its edges as lines, or read as a drawing (a sketch shot on paper, cleaned to its strokes). */
const STYLES = ["dots", "lines", "drawing"] as const;
const STYLE_LABEL: Record<Settings["mode"], string> = { dots: "Dots", lines: "Lines", drawing: "Drawing" };

/**
 * Style (a photograph), Print size and Tee, each a pill of text; the stage
 * shows the choice. The other styles and sizes are worked out when the page
 * is idle, and an option that won't print is left out (never shown only to
 * be refused). The tee the rule picks is marked Suggested.
 */
export function ChoiceThumbs({ source, settings, preview, choice, onSettings, onChoice }: { source: Source; settings: Settings; preview: PreviewOk; choice: Choice; onSettings: (patch: Partial<Settings>) => void; onChoice: (c: Choice) => void }) {
  // A photograph has a style; so does one read as a Drawing (its class is then line work).
  const photo = preview.cls === "photo" || settings.mode === "drawing";
  const [modeA, modeB] = STYLES.filter((m) => m !== settings.mode);
  const altA = useAlt(source, { ...settings, mode: modeA, size: preview.size }, photo ? 150 : 1e9);
  const altB = useAlt(source, { ...settings, mode: modeB, size: preview.size }, photo ? 600 : 1e9);
  const altMode = (m: Settings["mode"]) => (m === modeA ? altA : altB);
  const otherSize = preview.size === "full" ? "small" : "full";
  const altSize = useAlt(source, { ...settings, size: otherSize }, photo ? 1200 : 300);
  // A file too small for Full comes back at Small: Full isn't on offer.
  const sizeOk = prints(altSize) && !(altSize?.ok && altSize.autoSmall && otherSize === "full");
  return (
    <div className="space-y-4">
      {photo && (
        <Segments
          label="Style"
          value={settings.mode}
          onChange={(v) => onSettings({ mode: v })}
          // Another style is offered once it's known to print (never shown, then taken away while it's being tried).
          options={STYLES.filter((v) => v === settings.mode || altMode(v)?.ok).map((v) => ({ value: v, label: STYLE_LABEL[v] }))}
        />
      )}
      <Segments
        label="Print size"
        value={preview.size}
        onChange={(v) => onSettings({ size: v })}
        options={(["full", "small"] as const).filter((v) => v === preview.size || sizeOk).map((v) => ({ value: v, label: v === "full" ? "Full" : "Small" }))}
      />
      <Segments
        label="Tee"
        value={choice}
        onChange={onChoice}
        options={(["black", "white", "both"] as const)
          .filter((v) => v === choice || (v === "both" ? preview.tees.length === 2 : preview.tees.includes(v)))
          .map((v) => ({ value: v, label: v === "both" ? `Both · ${formatPrice(STORE_POLICY.customPairPrice)}` : v === "black" ? "Black" : "White", tag: v === preview.tee ? "Suggested" : undefined }))}
      />
    </div>
  );
}
