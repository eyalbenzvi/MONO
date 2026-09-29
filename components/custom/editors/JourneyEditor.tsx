"use client";

import { useEffect, useRef, useState } from "react";
import { CityField } from "@/components/custom/CityField";
import { loadCities, type Places } from "@/lib/custom/data";
import type { CustomSpec } from "@/lib/custom/spec";
import { JOURNEY_MAX, PRODUCT, journeyProblem } from "@/lib/custom/specs/journey";
import { WordsField, useWords } from "./Field";
import type { EditorProps } from "./types";

const LINK = "h-10 text-neutral-300 underline underline-offset-4 hover:text-white disabled:opacity-30";

/**
 * Your Journey: the places in the order you went (one place field adds the
 * next; each can go), and your words.
 */
export default function JourneyEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "journey" ? arrival.p : null;
  const [places, setPlaces] = useState<Places | null>(null);
  useEffect(() => {
    let live = true;
    loadCities()
      .then((p) => live && setPlaces(p))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const [ids, setIds] = useState<number[]>(a?.c ?? PRODUCT.example.c);
  const [adding, setAdding] = useState(0);
  const words = useWords(a?.w ?? "");

  const problem = journeyProblem(ids);
  const w = words.value;
  const spec: CustomSpec | null = places && !problem && w !== null && ids.every((id) => places.byId(id)) ? { t: "journey", v: 1, p: { c: ids, ...(w ? { w } : {}) } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null, data: { places: places?.list } });
  }, [key, places]);

  const shown = problem && (touched || ids.length >= 2) ? problem : null;

  return (
    <>
      <div>
        <p className="mb-1 text-xs font-medium text-neutral-400" id="make-journey-stops">
          The places, in order <span className="text-neutral-500">up to {JOURNEY_MAX}</span>
        </p>
        <ol aria-labelledby="make-journey-stops" className="space-y-0.5">
          {ids.map((id, i) => {
            const c = places?.byId(id);
            const name = c ? `${c.name}, ${c.country}` : "Loading places…";
            return (
              <li key={`${i}-${id}`} className="flex items-center gap-3 text-sm text-white">
                <span className="w-4 text-right font-mono text-neutral-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <button type="button" onClick={() => setIds((xs) => xs.filter((_, j) => j !== i))} aria-label={`Remove ${c?.name ?? "place"}`} className={LINK}>
                  Remove
                </button>
              </li>
            );
          })}
        </ol>
        {shown && <p className="mt-1 text-xs text-neutral-300">{shown}</p>}
      </div>
      {ids.length < JOURNEY_MAX && (
        // A fresh field for each place added (it clears once one is chosen).
        <CityField
          key={adding}
          places={places}
          value={undefined}
          onChange={(c) => {
            if (!c) return;
            setIds((xs) => [...xs, c.id]);
            setAdding((n) => n + 1);
          }}
          error=""
          onBlur={() => {}}
        />
      )}
      <WordsField words={words} hint={made.wordsHint ?? ""} touched={touched} />
    </>
  );
}
