"use client";

import { useState } from "react";
import { cleanWords, type CustomSpec } from "@/lib/custom/spec";
import { LINE_MAX, METRO_LINES, METRO_STATIONS, PRODUCT, STATION_MAX, metroProblem } from "@/lib/custom/specs/metro";
import { Field, nameLine, useLexicon } from "./Field";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

const LINK = "h-10 text-neutral-300 underline underline-offset-4 hover:text-white disabled:opacity-30";
const PILL = "h-10 rounded-full px-3.5 text-sm font-semibold ring-1 transition";
const STYLE_NAME = ["solid", "double", "dashed", "dotted"];

interface Station {
  name: string;
  mask: number;
}

/** Your Metro Map: the lines (people or eras), the stations in order with the lines that stop at each, and the caption (CaptionField). */
export default function MetroEditor({ arrival, touched, onChange }: EditorProps) {
  // The example's shape (its lines, its stations and who stops where) with its names as placeholders; a link's print fills the names in.
  const ex = PRODUCT.example;
  const a = arrival?.t === "metro" ? arrival.p : null;
  const [lines, setLines] = useState<string[]>(a ? a.l : ex.l.map(() => ""));
  const [stations, setStations] = useState<Station[]>((a ?? ex).s.map((name, j) => ({ name: a ? name : "", mask: (a ?? ex).k[j] })));
  const lex = useLexicon(true);

  const problem = (text: string, max: number) => {
    const t = text.trim();
    if (!t) return touched ? "Type a name" : "";
    const c = cleanWords(t, max);
    if (!c) return nameLine(t, max);
    return lex ? lex.wordsProblem(c) : null;
  };
  const lineErrors = lines.map((l) => problem(l, LINE_MAX));
  const stationErrors = stations.map((s) => problem(s.name, STATION_MAX));
  const all = (1 << lines.length) - 1;
  const masks = stations.map((s) => s.mask & all);
  const mapProblem = metroProblem(lines.length, masks);
  const fine = (e: string | null) => e === null;
  const spec: CustomSpec | null =
    lex && lineErrors.every(fine) && stationErrors.every(fine) && !mapProblem
      ? { t: "metro", v: 1, p: { l: lines.map((l) => cleanWords(l, LINE_MAX)!), s: stations.map((s) => cleanWords(s.name, STATION_MAX)!), k: masks } }
      : null;

  useReportSpec(spec, onChange);

  const setStation = (j: number, s: Partial<Station>) => setStations((xs) => xs.map((x, i) => (i === j ? { ...x, ...s } : x)));
  const removeLine = (i: number) => {
    setLines((xs) => xs.filter((_, t) => t !== i));
    // The bits above the line removed move down one.
    setStations((xs) => xs.map((x) => ({ ...x, mask: (x.mask & ((1 << i) - 1)) | ((x.mask >> (i + 1)) << i) })));
  };

  return (
    <>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] items-end gap-3">
            <Field label={`Line ${i + 1}`} hint={STYLE_NAME[i]} error={lineErrors[i]} htmlFor={`make-metro-line${i}`}>
              <input id={`make-metro-line${i}`} value={l} maxLength={LINE_MAX + 4} placeholder={ex.l[i] ?? "Noa"} autoComplete="off" onChange={(e) => setLines((xs) => xs.map((x, t) => (t === i ? e.target.value : x)))} aria-invalid={!!lineErrors[i]} className={INPUT} />
            </Field>
            <button type="button" onClick={() => removeLine(i)} disabled={lines.length <= METRO_LINES[0]} aria-label={`Remove line ${i + 1}`} className={LINK}>
              Remove
            </button>
          </div>
        ))}
        {lines.length < METRO_LINES[1] && (
          <button type="button" onClick={() => setLines((xs) => [...xs, ""])} className={`${LINK} w-fit`}>
            Add a line
          </button>
        )}
      </div>
      <div className="space-y-3">
        {stations.map((s, j) => (
          <div key={j} className="space-y-1.5">
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <Field label={`Station ${j + 1}`} error={stationErrors[j]} htmlFor={`make-metro-station${j}`}>
                <input id={`make-metro-station${j}`} value={s.name} maxLength={STATION_MAX + 4} placeholder={ex.s[j] ?? "Tel Aviv"} autoComplete="off" onChange={(e) => setStation(j, { name: e.target.value })} aria-invalid={!!stationErrors[j]} className={INPUT} />
              </Field>
              <button type="button" onClick={() => setStations((xs) => xs.filter((_, i) => i !== j))} disabled={stations.length <= METRO_STATIONS[0]} aria-label={`Remove station ${j + 1}`} className={LINK}>
                Remove
              </button>
            </div>
            <div role="group" aria-label={`Lines that stop at station ${j + 1}`} className="flex flex-wrap gap-1.5">
              {lines.map((l, i) => {
                const on = !!(s.mask & (1 << i));
                return (
                  <button key={i} type="button" aria-pressed={on} onClick={() => setStation(j, { mask: s.mask ^ (1 << i) })} className={`${PILL} ${on ? "bg-white text-black ring-white" : "text-neutral-300 ring-white/15 hover:bg-white/10"}`}>
                    {l.trim() || `Line ${i + 1}`}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {stations.length < METRO_STATIONS[1] && (
          <button type="button" onClick={() => setStations((xs) => [...xs, { name: "", mask: 1 }])} className={`${LINK} w-fit`}>
            Add a station
          </button>
        )}
        {mapProblem && <p className="text-xs text-neutral-300">{mapProblem}.</p>}
      </div>
    </>
  );
}
