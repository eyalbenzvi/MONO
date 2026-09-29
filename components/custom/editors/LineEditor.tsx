"use client";

import { useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { LINE_REPEATS, decodeStroke, type CustomSpec, type LineParams } from "@/lib/custom/spec";
import { EXAMPLE_LINES, exampleStroke, strokeSpec } from "@/lib/custom/stroke";
import { Segmented, Switch } from "./Segmented";
import { useReportSpec } from "./useReportSpec";
import type { EditorProps } from "./types";

/** How many points a drawn line had, in bands (analytics: how people draw, never what). */
const bucket = (n: number) => (n < 10 ? "<10" : n < 50 ? "10-49" : n < 200 ? "50-199" : "200+");

/**
 * Your Line: a square pad (touch, pen or mouse, one stroke at a time;
 * drawing again replaces it), "Clear", and "Example lines" for a page
 * without a pointer; the repeat and the mirror. The words are the caption's title (CaptionField, cap[0]).
 */
export default function LineEditor({ made, arrival, onChange }: EditorProps) {
  const a = arrival?.t === "line" ? arrival.p : null;
  const [s, setS] = useState<string | null>(a?.s ?? exampleStroke(0));
  const [n, setN] = useState<LineParams["n"]>(a?.n ?? 12);
  const [mirror, setMirror] = useState(a?.m === 1);
  const [example, setExample] = useState(0);
  const pad = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<[number, number][] | null>(null);

  const spec: CustomSpec | null = s ? { t: "line", v: 1, p: { s, n, ...(mirror ? { m: 1 as const } : {}) } } : null;
  useReportSpec(spec, onChange);

  const at = (e: React.PointerEvent): [number, number] => {
    const r = pad.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 1000, ((e.clientY - r.top) / r.height) * 1000];
  };
  const shown = drawing ?? (s ? (decodeStroke(s) ?? []).map(([x, y]) => [(x / 255) * 1000, (y / 255) * 1000] as [number, number]) : []);

  return (
    <>
      <div>
        <div className="mb-1 flex items-baseline justify-between text-xs font-medium text-neutral-400">
          <span id="make-pad">Draw one line</span>
          <span className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                const next = (example + 1) % EXAMPLE_LINES.length;
                setExample(next);
                setS(exampleStroke(next));
              }}
              className="h-8 text-neutral-300 underline underline-offset-4 hover:text-white"
            >
              Example lines
            </button>
            <button type="button" onClick={() => setS(null)} className="h-8 text-neutral-300 underline underline-offset-4 hover:text-white">
              Clear
            </button>
          </span>
        </div>
        <div
          ref={pad}
          role="img"
          aria-labelledby="make-pad"
          data-pad
          className="relative aspect-square w-full touch-none select-none rounded-2xl bg-white/[0.04] ring-1 ring-white/10"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrawing([at(e)]);
          }}
          onPointerMove={(e) => drawing && setDrawing((d) => (d ? [...d, at(e)] : d))}
          onPointerUp={() => {
            if (!drawing) return;
            const next = strokeSpec(drawing, 1000);
            if (next) {
              setS(next);
              track("line_draw", { points_bucket: bucket(drawing.length) });
            }
            setDrawing(null);
          }}
          onPointerCancel={() => setDrawing(null)}
        >
          <svg viewBox="0 0 1000 1000" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {shown.length > 1 && <polyline points={shown.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(" ")} fill="none" stroke="white" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
          {!s && !drawing && <p className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">Draw here</p>}
        </div>
      </div>
      <Segmented label="Repeats" options={LINE_REPEATS} value={n} onChange={setN} />
      <Switch label="Mirror" checked={mirror} onChange={setMirror} />
    </>
  );
}
