"use client";

import { useEffect, useRef, useState } from "react";
import { artThumbPath, type ArtFile } from "@/lib/custom/art";
import { loadArt } from "@/lib/custom/data";
import type { CustomSpec } from "@/lib/custom/spec";
import { FIRST_YEAR, LAST_YEAR } from "@/lib/custom/specKit";
import { JOURNAL_NAME_MAX, LANDMARKS, LANDMARKS_MAX, LANDMARKS_MIN, LANDMARK_IDS, PRODUCT, type Landmark, type Visit } from "@/lib/custom/specs/landmarks";
import { assetUrl } from "@/lib/catalog";
import { Field, useLexicon } from "./Field";
import { yearOf } from "./RowsField";
import { TextField, allOk, useText } from "./TextField";
import { INPUT, type EditorProps } from "./types";

const LINK = "h-10 px-1 text-xs text-neutral-300 underline underline-offset-4 hover:text-white";

/** Your Landmarks: whose journal, and three to nine landmarks (picked from their drawings), each with the year you were there. */
export default function LandmarksEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "landmarks" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const name = useText(a?.n ?? "", JOURNAL_NAME_MAX, lex);
  const [rows, setRows] = useState<{ id: Landmark; year: string }[]>(a ? a.x.map(([id, y]) => ({ id, year: y ? String(y) : "" })) : []);
  const [art, setArt] = useState<Record<string, ArtFile>>({});
  const ids = rows.map((r) => r.id).join(",");
  useEffect(() => {
    let live = true;
    for (const id of ids.split(",").filter(Boolean)) {
      const key = `landmarks/${id}`;
      loadArt(key)
        .then((f) => live && setArt((m) => (m[key] ? m : { ...m, [key]: f })))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [ids]);

  const years = rows.map((r) => yearOf(r.year, FIRST_YEAR, LAST_YEAR));
  const ok = allOk(lex, name) && rows.length >= LANDMARKS_MIN && rows.length <= LANDMARKS_MAX && years.every((y) => y !== null);
  const x: Visit[] = rows.map((r, i) => (years[i] ? [r.id, years[i]!] : [r.id]));
  const spec: CustomSpec | null = ok ? { t: "landmarks", v: 1, p: { ...(name.value ? { n: name.value } : {}), x } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  const loaded = rows.filter((r) => art[`landmarks/${r.id}`]).length;
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null, data: { art } });
    // Redrawn as each drawing arrives.
  }, [key, loaded, art]);

  const toggle = (id: Landmark) => setRows((rs) => (rs.some((r) => r.id === id) ? rs.filter((r) => r.id !== id) : rs.length < LANDMARKS_MAX ? [...rs, { id, year: "" }] : rs));
  const move = (i: number) => setRows((rs) => rs.map((r, j) => (j === i - 1 ? rs[i] : j === i ? rs[i - 1] : r)));

  return (
    <>
      <TextField id="make-landmarks-name" label="Whose journal" hint="optional" state={name} max={JOURNAL_NAME_MAX} placeholder={ex.n} />
      <Field label="Landmarks" hint={`${rows.length} of ${LANDMARKS_MIN} to ${LANDMARKS_MAX}`} error={touched && rows.length < LANDMARKS_MIN ? `Choose at least ${LANDMARKS_MIN}` : null} htmlFor="make-landmarks-pick">
        <div id="make-landmarks-pick" role="group" aria-label="Landmarks" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {LANDMARK_IDS.map((id) => {
            const on = rows.some((r) => r.id === id);
            return (
              <button key={id} type="button" aria-pressed={on} onClick={() => toggle(id)} disabled={!on && rows.length >= LANDMARKS_MAX} className={`flex flex-col items-center gap-1 rounded-xl p-2 text-center text-[11px] leading-tight ring-1 transition disabled:opacity-40 ${on ? "bg-white/15 text-white ring-white" : "text-neutral-300 ring-white/10 hover:bg-white/5"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a baked thumbnail (scripts/images/bakeMake.ts), the static export's own file */}
                <img src={assetUrl(artThumbPath(`landmarks/${id}`))} alt="" width={64} height={64} loading="lazy" className="h-16 w-16 object-contain" />
                <span>{LANDMARKS[id]}</span>
              </button>
            );
          })}
        </div>
      </Field>
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.id} className="grid grid-cols-[1fr_5.5rem_auto] items-end gap-2">
              <p className="flex h-11 items-center truncate text-sm text-white">{LANDMARKS[r.id]}</p>
              <Field label={`Year ${i + 1}`} hint="optional" error={years[i] === null ? `${FIRST_YEAR} to ${LAST_YEAR}` : null} htmlFor={`make-landmarks-y${i}`}>
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
