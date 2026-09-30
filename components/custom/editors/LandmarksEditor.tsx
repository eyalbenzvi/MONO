"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { artThumbPath } from "@/lib/custom/art";
import type { CustomSpec } from "@/lib/custom/spec";
import { FIRST_YEAR, LAST_YEAR } from "@/lib/custom/specKit";
import { JOURNAL_NAME_MAX, LANDMARKS, LANDMARKS_MAX, LANDMARKS_MIN, LANDMARK_IDS, PRODUCT, REGIONS, shownLandmarks, type Landmark, type Region, type Visit } from "@/lib/custom/specs/landmarks";
import { assetUrl } from "@/lib/catalog";
import { Field, useLexicon } from "./Field";
import { yearOf } from "./RowsField";
import { Segmented } from "./Segmented";
import { TextField, allOk, useText } from "./TextField";
import { INPUT, type EditorProps } from "./types";
import { previewOf, usePreviewKey } from "./useReportSpec";

const LINK = "h-11 px-1 text-xs text-neutral-300 underline underline-offset-4 hover:text-white";

const ALL = "All" as const;

/** Your Landmarks: whose journal, and three to nine of the fifty landmarks (picked from their drawings, by region or found by name), each with the year you were there. */
export default function LandmarksEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "landmarks" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const name = useText(a?.n ?? "", JOURNAL_NAME_MAX, lex);
  const [rows, setRows] = useState<{ id: Landmark; year: string }[]>(a ? a.x.map(([id, y]) => ({ id, year: y ? String(y) : "" })) : []);
  const years = rows.map((r) => yearOf(r.year, FIRST_YEAR, LAST_YEAR));
  const ok = allOk(lex, name) && rows.length >= LANDMARKS_MIN && rows.length <= LANDMARKS_MAX && years.every((y) => y !== null);
  const x: Visit[] = rows.map((r, i) => (years[i] ? [r.id, years[i]!] : [r.id]));
  const spec: CustomSpec | null = ok ? { t: "landmarks", v: 1, p: { ...(name.value ? { n: name.value } : {}), x } } : null;

  // Fewer than three picked yet: the example's after them, to three (none picked: the example's journal).
  const px: Visit[] = x.length ? [...x, ...ex.x.filter(([id]) => !rows.some((r) => r.id === id))].slice(0, Math.max(LANDMARKS_MIN, x.length)) : ex.x;
  const preview: CustomSpec | null = !spec && allOk(lex, name) && years.every((y) => y !== null) ? { t: "landmarks", v: 1, p: { ...(name.value ? { n: name.value } : {}), x: px } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  const previewKey = usePreviewKey(spec, preview);
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null, ...previewOf(previewKey) });
  }, [key, previewKey]);

  const [region, setRegion] = useState<Region | typeof ALL>(ALL);
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => shownLandmarks(region, filter), [region, filter]);

  const toggle = (id: Landmark) => setRows((rs) => (rs.some((r) => r.id === id) ? rs.filter((r) => r.id !== id) : rs.length < LANDMARKS_MAX ? [...rs, { id, year: "" }] : rs));
  const move = (i: number) => setRows((rs) => rs.map((r, j) => (j === i - 1 ? rs[i] : j === i ? rs[i - 1] : r)));

  return (
    <>
      <TextField id="make-landmarks-name" label="Whose journal" hint="optional" state={name} max={JOURNAL_NAME_MAX} placeholder={ex.n} />
      <Field label="Landmarks" hint={`${rows.length} of ${LANDMARKS_MIN} to ${LANDMARKS_MAX}`} error={touched && rows.length < LANDMARKS_MIN ? `Choose at least ${LANDMARKS_MIN}.` : null} htmlFor="make-landmarks-filter">
        <input id="make-landmarks-filter" type="search" value={filter} placeholder={`Find one of the ${LANDMARK_IDS.length}, or a place`} autoComplete="off" onChange={(e) => setFilter(e.target.value)} className={INPUT} />
      </Field>
      <Segmented label="Region" options={[ALL, ...REGIONS]} value={region} onChange={setRegion} />
      <div>
        {shown.length === 0 && <p className="py-2 text-sm text-neutral-400">No landmark matches{region === ALL ? "" : ` in ${region}`}.</p>}
        <div id="make-landmarks-pick" role="group" aria-label="Landmarks" className="grid max-h-[26rem] grid-cols-3 gap-2 overflow-y-auto rounded-control p-px sm:grid-cols-4">
          {shown.map((id) => {
            const on = rows.some((r) => r.id === id);
            return (
              <button key={id} type="button" aria-pressed={on} onClick={() => toggle(id)} disabled={!on && rows.length >= LANDMARKS_MAX} className={`flex flex-col items-center gap-1 rounded-control p-2 text-center text-[11px] leading-tight ring-1 transition disabled:opacity-40 ${on ? "bg-white/15 text-white ring-white" : "text-neutral-300 ring-white/10 hover:bg-white/5"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a baked thumbnail (scripts/images/bakeMake.ts), the static export's own file */}
                <img src={assetUrl(artThumbPath(`landmarks/${id}`))} alt="" width={64} height={64} loading="lazy" className="h-16 w-16 object-contain" />
                <span>{LANDMARKS[id]}</span>
              </button>
            );
          })}
        </div>
      </div>
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.id} className="grid grid-cols-[1fr_5.5rem_auto] items-end gap-2">
              <p className="flex h-11 items-center truncate text-sm text-white">{LANDMARKS[r.id]}</p>
              <Field label={`Year ${i + 1}`} hint="optional" error={years[i] === null ? `Between ${FIRST_YEAR} and ${LAST_YEAR}.` : null} htmlFor={`make-landmarks-y${i}`}>
                <input id={`make-landmarks-y${i}`} value={r.year} inputMode="numeric" maxLength={4} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))} className={INPUT} />
              </Field>
              <div className="flex">
                {i > 0 && (
                  <button type="button" className={LINK} onClick={() => move(i)} aria-label={`Move ${LANDMARKS[r.id]} up`}>
                    Up
                  </button>
                )}
                <button type="button" className={LINK} onClick={() => toggle(r.id)} aria-label={`Remove ${LANDMARKS[r.id]}`}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
