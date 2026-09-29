"use client";

import { useEffect, useState } from "react";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { STAGE_BG } from "@/components/stage";
import { radioKeys } from "@/components/ui";
import { track } from "@/lib/analytics";
import { formatPrice } from "@/lib/format";
import { STORE_POLICY } from "@/lib/store-policy";
import { codeOf, convertWith, type Preview, type PreviewOk, type Settings, type Source, type Tee } from "@/lib/upload/client";
import type { ShirtProduct } from "@/types/shirt";

/** Why an option fails, short enough for under a thumbnail. */
const SHORT: Record<string, string> = {
  faint: "Too faint",
  solid: "Too much ink",
  solidDots: "Too much ink",
  dense: "Too much ink",
  denseDots: "Too much ink",
  plain: "Too plain",
  weak: "Won't print well",
  stroke: "Lines too fine",
  gap: "Gaps too narrow",
  duplicate: "Already ours",
  smallForSmall: "File too small",
  smallForFull: "File too small",
};
export const shortReason = (code: string) => SHORT[code] ?? "Won't print";

interface Option<T extends string> {
  value: T;
  label: string;
  /** The picture: a print canvas and its tee, or null while it's worked out. */
  picture: { canvas: HTMLCanvasElement | null; tee: Tee } | null;
  /** Why it can't be picked, or nothing. */
  off?: string;
  tag?: string;
}

/** One row of choices, each a small picture of the real result (a radiogroup; a failing one is dimmed, says why, and can't be picked). */
function Row<T extends string>({ label, options, value, onChange, shirt, both }: { label: string; options: Option<T>[]; value: T; onChange: (v: T) => void; shirt: ShirtProduct; both?: T }) {
  const pickable = options.filter((o) => !o.off).map((o) => o.value);
  const keys = radioKeys(pickable, value, onChange);
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-neutral-400" id={`thumbs-${label}`}>
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={`thumbs-${label}`} className="grid grid-cols-3 gap-2">
        {options.map((o) => {
          const i = pickable.indexOf(o.value);
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={o.off ? true : undefined}
              aria-label={`${o.label}${o.tag ? `, ${o.tag}` : ""}${o.off ? `: ${o.off}` : ""}`}
              onClick={() => {
                if (o.off) return;
                onChange(o.value);
                track("upload_compare", { control: label.toLowerCase() });
              }}
              {...(i >= 0 ? keys(i) : { tabIndex: -1 })}
              className={`rounded-2xl p-1 text-left transition ${active ? "ring-2 ring-white" : "ring-1 ring-white/10 hover:ring-white/30"} ${o.off ? "cursor-not-allowed" : ""}`}
              data-choice={o.value}
            >
              <div className={`overflow-hidden rounded-xl ${STAGE_BG} ${o.off ? "opacity-35" : ""}`}>
                {o.picture?.canvas ? (
                  o.value === both ? (
                    <div className="relative">
                      <CustomMockup shirt={shirt} svg={o.picture.canvas} color={o.picture.tee} className="w-full" label={o.label} />
                    </div>
                  ) : (
                    <CustomMockup shirt={shirt} svg={o.picture.canvas} color={o.picture.tee} className="w-full" label={o.label} />
                  )
                ) : (
                  <div className="aspect-[512/704] w-full animate-pulse bg-white/[0.04] motion-reduce:animate-none" aria-hidden />
                )}
              </div>
              <p className="mt-1 px-1 text-xs font-semibold text-white">{o.label}</p>
              {o.tag && <p className="px-1 text-[10px] uppercase tracking-[0.12em] text-neutral-400">{o.tag}</p>}
              {o.off && <p className="px-1 text-[11px] leading-tight text-neutral-400">{o.off}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A setting's result (cached), worked out when the page is idle. */
function useAlt(source: Source, settings: Settings, delay: number): Preview | null {
  const [p, setP] = useState<Preview | null>(null);
  const key = JSON.stringify(settings);
  useEffect(() => {
    setP(null);
    let live = true;
    const t = setTimeout(() => void convertWith(source, settings).then((r) => live && setP(r)), delay);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // The settings are compared by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, key, delay]);
  return p;
}

const pictureOf = (p: Preview | null, tee: Tee): Option<string>["picture"] => (!p ? null : { canvas: p.canvas(p.ok ? (p.tees.includes(tee) ? tee : p.tee) : (p.tee ?? tee)), tee: p.ok ? (p.tees.includes(tee) ? tee : p.tee) : (p.tee ?? tee) });

export type Choice = Tee | "both";

/** A photograph's styles: its tone in dots, its edges as lines, or read as a drawing (a sketch shot on paper, cleaned to its strokes). */
const STYLES = ["dots", "lines", "drawing"] as const;
const STYLE_LABEL: Record<Settings["mode"], string> = { dots: "Dots", lines: "Lines", drawing: "Drawing" };
/** Words' widths, and the settings each is. */
type WordsWidth = "full" | "medium" | "small";
const WIDTHS: WordsWidth[] = ["full", "medium", "small"];
const WIDTH_LABEL: Record<WordsWidth, string> = { full: "Full · 28 cm", medium: "Medium · 18 cm", small: "Small · 12 cm" };
const WIDTH_PATCH: Record<WordsWidth, Partial<Settings>> = { full: { size: "full", span: "full" }, medium: { size: "full", span: "medium" }, small: { size: "small" } };

/**
 * Style (a photograph only), Size and Tee, each as small pictures of the
 * real result. The current setting uses the current print; the other Style
 * and Size are worked out when the page is idle (the other Style first).
 */
export function ChoiceThumbs({ shirt, source, settings, preview, choice, onSettings, onChoice }: { shirt: ShirtProduct; source: Source; settings: Settings; preview: PreviewOk; choice: Choice; onSettings: (patch: Partial<Settings>) => void; onChoice: (c: Choice) => void }) {
  const tee: Tee = choice === "both" ? preview.tee : choice;
  // A photograph has a style; so does one read as a Drawing (its class is then line work).
  const photo = preview.cls === "photo" || settings.mode === "drawing";
  const [modeA, modeB] = STYLES.filter((m) => m !== settings.mode);
  const otherSize = preview.size === "full" ? "small" : "full";
  // Words have three widths: Full (28 cm), Medium (Full's box at 18 cm) and Small (12 cm).
  const words = preview.cls === "words";
  const width: WordsWidth = preview.size === "small" ? "small" : settings.span === "medium" ? "medium" : "full";
  const [widthA, widthB] = WIDTHS.filter((v) => v !== width);
  const altWidthA = useAlt(source, { ...settings, ...WIDTH_PATCH[widthA] }, words ? 300 : 1e9);
  const altWidthB = useAlt(source, { ...settings, ...WIDTH_PATCH[widthB] }, words ? 700 : 1e9);
  const altWidth = (v: WordsWidth) => (v === widthA ? altWidthA : altWidthB);
  const altA = useAlt(source, { ...settings, mode: modeA, size: preview.size }, photo ? 150 : 1e9);
  const altB = useAlt(source, { ...settings, mode: modeB, size: preview.size }, photo ? 600 : 1e9);
  const altMode = (m: Settings["mode"]) => (m === modeA ? altA : altB);
  const altSize = useAlt(source, { ...settings, size: otherSize }, words ? 1e9 : photo ? 1200 : 300);
  const off = (p: Preview | null) => (p && !p.ok ? shortReason(p.code) : p && p.ok && p.autoSmall && otherSize === "full" ? "File too small" : undefined);
  const current = { canvas: preview.canvas(tee), tee };
  const bothOk = preview.tees.length === 2;
  return (
    <div className="space-y-4">
      {photo && (
        <Row
          label="Style"
          shirt={shirt}
          value={settings.mode}
          onChange={(v) => onSettings({ mode: v })}
          options={STYLES.map((v) => ({ value: v, label: STYLE_LABEL[v], picture: v === settings.mode ? current : pictureOf(altMode(v), tee), off: v === settings.mode ? undefined : off(altMode(v)) }))}
        />
      )}
      {words ? (
        <div>
          <Row
            label="Size"
            shirt={shirt}
            value={width}
            onChange={(v) => onSettings(WIDTH_PATCH[v])}
            options={WIDTHS.map((v) => ({ value: v, label: WIDTH_LABEL[v], picture: v === width ? current : pictureOf(altWidth(v), tee), off: v === width ? undefined : off(altWidth(v)) }))}
          />
          {preview.capMm ? (
            <p className="mt-1.5 text-xs text-neutral-400" data-cap-readout>
              Letters {(preview.capMm / 10).toFixed(1)} cm tall{settings.layout === "fill" ? ", the largest" : ""}.
            </p>
          ) : null}
        </div>
      ) : (
        <Row
          label="Size"
          shirt={shirt}
          value={preview.size}
          onChange={(v) => onSettings({ size: v })}
          options={(["full", "small"] as const).map((v) => ({ value: v, label: v === "full" ? "Full" : "Small", picture: v === preview.size ? current : pictureOf(altSize, tee), off: v === preview.size ? undefined : off(altSize) }))}
        />
      )}
      <Row
        label="Tee"
        shirt={shirt}
        value={choice}
        both="both"
        onChange={onChoice}
        options={(["black", "white", "both"] as const).map((v) => {
          const t: Tee = v === "both" ? preview.tee : v;
          const r = preview.perTee[t];
          return {
            value: v,
            label: v === "both" ? `Both · ${formatPrice(STORE_POLICY.customPairPrice)}` : v === "black" ? "Black" : "White",
            picture: { canvas: preview.canvas(t), tee: t },
            tag: v === preview.tee ? "Suggested" : undefined,
            off: v === "both" ? (bothOk ? undefined : "One tee only") : !r.ok ? `${shortReason(codeOf(r.reason ?? ""))} on ${v}` : preview.tees.includes(v) ? undefined : `Prints weaker on ${v}`,
          };
        })}
      />
    </div>
  );
}
